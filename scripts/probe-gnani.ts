import { loadEnvFile } from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { GnaniError, prisma, speechKey, timbre, type PrismaModel, type TimbreModel } from "../src/server/gnani/client";
import { locales } from "../src/domain/scenario";

try { loadEnvFile(".env.local"); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not load .env.local");
}

async function main() {
  if (!speechKey()) {
    console.error("Live probe blocked: GNANI_API_KEY is absent.");
    process.exitCode = 1;
    return;
  }
  const folder = "evidence/day0";
  await mkdir(folder, { recursive: true });
  const checks: Record<string, unknown>[] = [];
  const timestamp = new Date().toISOString();
  async function check<T>(name: string, operation: () => Promise<T>, summarize: (result: T) => object) {
    const start = performance.now();
    try {
      const value = await operation();
      checks.push({ name, ok: true, elapsedMs: Math.round(performance.now() - start), ...summarize(value) });
      return value;
    } catch (error) {
      const details = error instanceof GnaniError ? { status: error.status, code: error.code } : { code: "CHECK_FAILED" };
      checks.push({ name, ok: false, elapsedMs: Math.round(performance.now() - start), ...details });
      return undefined;
    }
  }
  let complete = true;
  const phrases = {
    en: "I will call the bank myself.", hi: "मैं खुद बैंक को फ़ोन करूँगी।",
    ta: "நானே வங்கிக்கு அழைத்துச் சரிபார்ப்பேன்.", te: "నేనే బ్యాంకుకు కాల్ చేసి తెలుసుకుంటాను.",
  };
  const ttsModels: TimbreModel[] = ["timbre-v3.0", "timbre-v2.5"];
  const sttModels: PrismaModel[] = ["prisma-v3.0", "prisma-v2.5"];
  for (const [index, locale] of locales.entries()) {
    let audio: Uint8Array | undefined;
    for (const model of ttsModels) {
      const result = await check(`${locale} ${model} WAV`, () => timbre(phrases[locale], locale, model, "wav"),
        (value) => ({ model, voice: value.voice, contentType: value.contentType, bytes: value.audio.length }));
      if (!result) continue;
      audio = result.audio;
      await check(`${locale} ${model} MP3`, () => timbre(phrases[locale], locale, model, "mp3"),
        (value) => ({ contentType: value.contentType, bytes: value.audio.length }));
      break;
    }
    const file = process.argv[index + 2];
    const input = file ? await readFile(file) : audio;
    let transcribed = false;
    if (input) {
      for (const model of sttModels) {
        const result = await check(`${locale} ${model} ${file ? "provided clip" : "Timbre round trip"}`,
          async () => {
            const response = await prisma(input, locale, model);
            if (!response.transcript.trim() || response.truncated) throw new GnaniError(200, "UNUSABLE_TRANSCRIPT");
            return response;
          }, (value) => ({
            model: value.model, requestId: value.request_id, language: value.detected_language_code,
            transcript: file ? undefined : value.transcript.replace(/\p{Nd}/gu, "•"),
          }));
        if (result) transcribed = true;
      }
    }
    complete &&= Boolean(audio && transcribed);
  }
  await writeFile(`${folder}/probe.json`, JSON.stringify({ timestamp, complete, checks }, null, 2) + "\n");
  console.log(`Live probe ${complete ? "passed" : "incomplete"}. See ${folder}/probe.json for measured results.`);
  if (!complete) process.exitCode = 1;
}

main().catch(() => {
  console.error("Probe stopped before it could complete. Check input file paths and workspace access.");
  process.exitCode = 1;
});
