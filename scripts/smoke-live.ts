import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { POST as stt } from "../app/api/stt/route";
import { POST as turn } from "../app/api/turn/route";
import { llmConfig } from "../src/server/classifier";
import { GnaniError, speechKey, timbre } from "../src/server/gnani/client";
import { locales } from "../src/domain/scenario";
import { encodeWav } from "../src/domain/wav";

function browserWav(audio: Uint8Array) {
  const decoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000",
    "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1"], { input: audio, maxBuffer: 2_000_000 });
  if (decoded.status !== 0) throw new Error("Could not decode the scripted fixture with ffmpeg");
  const view = new DataView(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.byteLength);
  const samples = Float32Array.from({ length: decoded.stdout.length / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768);
  return encodeWav(samples, 16_000);
}

async function main() {
  try { loadEnvFile(".env.local"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not load .env.local");
  }
  if (!speechKey() || process.env.GNANI_MODE === "mock") throw new Error("Live mode and Gnani credentials are required");
  const checks = [];
  const phrases = { en: "I will call my bank myself.", hi: "मैं अपने बैंक के आधिकारिक ऐप में खुद जाँच करूँगी।" };
  const url = "http://localhost";
  const turnRequest = (payload: object) => turn(new Request(url, { method: "POST", body: JSON.stringify(payload) }));
  for (const locale of locales) {
    const result = await timbre(phrases[locale], locale, "timbre-v3.0", "wav");
    const form = new FormData();
    form.set("locale", locale);
    form.set("scenarioId", "kyc_freeze");
    form.set("stateId", "INTRO");
    form.set("audio", new Blob([browserWav(result.audio)], { type: "audio/wav" }), "reply.wav");
    const response = await stt(new Request(url, { method: "POST", body: form }));
    const output = await response.json();
    const word = locale === "en" ? /\bbank\b/i : /बैंक|\bbank\b/i;
    const ok = response.ok && word.test(output.transcript) && Boolean(output.proof && output.stt?.gnaniRequestId);
    let verified: boolean | null = null;
    if (ok && llmConfig()) {
      const started = await (await turnRequest({ action: "start", scenarioId: "kyc_freeze", locale, sessionId: crypto.randomUUID() })).json();
      const reply = await turnRequest({ action: "reply", session: started.session, reply: {
        inputMode: "voice", text: output.transcript, stt: output.stt, proof: output.proof,
      } });
      const classified = await reply.json();
      verified = reply.ok && classified.terminal === "END_VERIFIED" && classified.session.turns[0]?.inputMode === "voice";
    }
    checks.push({ locale, ok, status: response.status, error: output.error?.code, model: output.stt?.model, requestId: output.stt?.gnaniRequestId,
      proofIssued: Boolean(output.proof), classifierVerified: verified });
  }
  await mkdir("evidence/day0", { recursive: true });
  await writeFile("evidence/day0/route-smoke.json", JSON.stringify({
    timestamp: new Date().toISOString(), input: "Timbre-generated scripted WAV, decoded and re-encoded by the app's browser PCM encoder", checks,
  }, null, 2) + "\n");
  if (checks.some((item) => !item.ok || item.classifierVerified === false)) process.exitCode = 1;
  console.log(`Live /api/stt smoke ${checks.every((item) => item.ok) ? "passed" : "incomplete"}. See evidence/day0/route-smoke.json.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof GnaniError ? error.message : "Could not complete the live route smoke.");
  process.exitCode = 1;
});
