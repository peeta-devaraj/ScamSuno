import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { z } from "zod";
import { intents, lines } from "../src/domain/scenario";
import { classify, llmConfig } from "../src/server/classifier";

const schema = z.object({
  id: z.string(), speech: z.string(), transcript: z.string(), demand: z.literal("otp"),
  expected_intent: z.enum(intents), expected_verify: z.boolean(), tags: z.array(z.string()),
});

async function main() {
  try { loadEnvFile(".env.local"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not load .env.local");
  }
  if (!llmConfig()) {
    console.error("Text evaluation blocked: a hosted classifier is required.");
    process.exitCode = 1;
    return;
  }
  const holdout = process.argv.includes("--holdout");
  const suite = holdout ? "holdout" : "dev";
  const input = await readFile(holdout ? "eval/text_cases_holdout.jsonl" : "eval/text_cases.jsonl", "utf8");
  const cases = input.trim().split(/\r?\n/).map((line) => schema.parse(JSON.parse(line)));
  const results = [];
  for (const item of cases) {
    const result = await classify(item.transcript, { demand: item.demand, lastLineEn: lines["kyc.demand"].en });
    results.push({ id: item.id, speech: item.speech, tags: item.tags, expected: item.expected_intent, actual: result.intent,
      expectedVerify: item.expected_verify, actualVerify: result.verify, degraded: result.degraded, source: result.source });
  }
  const eligible = results.filter((item) => !item.degraded);
  const confusion = Object.fromEntries(intents.map((expected) => [expected,
    Object.fromEntries(intents.map((actual) => [actual, eligible.filter((row) => row.expected === expected && row.actual === actual).length]))]));
  const summary = {
    timestamp: new Date().toISOString(), suite, model: llmConfig()?.model, conditions: "Scripted text, active OTP demand",
    attempted: results.length, labelled: eligible.length, providerFailures: results.length - eligible.length,
    intentMatches: eligible.filter((row) => row.expected === row.actual).length,
    verifyMatches: eligible.filter((row) => row.expectedVerify === row.actualVerify).length,
    unclear: eligible.filter((row) => row.actual === "UNCLEAR").length,
    unsafeCompliance: eligible.filter((row) => row.expected !== "COMPLY" && row.actual === "COMPLY").length,
    missedCompliance: eligible.filter((row) => row.expected === "COMPLY" && row.actual !== "COMPLY").length,
    confusion, results,
  };
  await mkdir("eval/results", { recursive: true });
  const file = `eval/results/${suite}-${Date.now()}.json`;
  await writeFile(file, JSON.stringify(summary, null, 2) + "\n");
  console.log(`Wrote ${file} (${summary.labelled} usable responses out of ${summary.attempted}).`);
  if (summary.providerFailures) process.exitCode = 1;
}

main().catch(() => { console.error("Could not run the text evaluation."); process.exitCode = 1; });
