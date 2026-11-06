import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadEnvFile } from "node:process";
import { callerAudio, type AudioEntry } from "../src/domain/audio";
import { lines, locales, type LineId } from "../src/domain/scenario";
import { GnaniError, speechKey, timbre, type TimbreModel } from "../src/server/gnani/client";

const checking = process.argv.includes("--check");
const manifestPath = "src/generated/audio-manifest.json";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function valid(entry: AudioEntry) {
  const prefix = `/audio/kyc_freeze/${entry.locale}/${entry.lineId}.${entry.sha256.slice(0, 12)}`;
  if (entry.url !== prefix + ".mp3" && entry.url !== prefix + ".wav") return false;
  const bytes = await readFile("public" + entry.url).catch(() => null);
  return bytes !== null && bytes.length === entry.bytes && hash(bytes) === entry.sha256;
}

async function main() {
  if (!checking) {
    try { loadEnvFile(".env.local"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not load .env.local");
    }
    if (!speechKey()) throw new GnaniError(503, "KEY_NOT_CONFIGURED");
  }
  const container = process.argv.includes("--wav") ? "wav" : "mp3";
  const model: TimbreModel = process.argv.includes("--v25") ? "timbre-v2.5" : "timbre-v3.0";
  const items = new Map(callerAudio.map((entry) => [`${entry.lineId}:${entry.locale}`, entry]));
  const missing: string[] = [];
  for (const locale of locales) {
    for (const lineId of Object.keys(lines) as LineId[]) {
      const key = `${lineId}:${locale}`;
      const entry = items.get(key);
      if (entry && (checking || (entry.model === model && entry.url.endsWith("." + container))) && await valid(entry)) continue;
      if (checking) {
        missing.push(key);
        continue;
      }
      const text = lines[lineId][locale];
      const result = await timbre(text, locale, model, container);
      const sha256 = hash(result.audio);
      const url = `/audio/kyc_freeze/${locale}/${lineId}.${sha256.slice(0, 12)}.${container}`;
      const path = "public" + url;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, result.audio);
      items.set(key, { lineId, locale, text, model: result.model, voice: result.voice, language: result.language,
        bytes: result.audio.length, sha256, url, generatedAt: new Date().toISOString() });
      await writeFile(manifestPath + ".tmp", JSON.stringify([...items.values()], null, 2) + "\n");
      await rename(manifestPath + ".tmp", manifestPath);
      console.log(`Generated ${key} with ${model}.`);
    }
  }
  if (missing.length) {
    console.error(`Missing or invalid Timbre assets (${missing.length}): ${missing.join(", ")}`);
    process.exitCode = 1;
  } else if (checking) console.log("All shipped captions have verified manifest entries and audio checksums.");
}

main().catch((error: unknown) => {
  console.error(error instanceof GnaniError ? error.message : "Could not generate or validate caller audio.");
  process.exitCode = 1;
});
