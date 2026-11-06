import config from "../../config/gnani.json";
import { callerAudio } from "../domain/audio";
import { locales, SCENARIO } from "../domain/scenario";
import { llmConfig } from "./classifier";
import { mockMode, speechKey } from "./gnani/client";

export function health() {
  const mock = mockMode();
  const classifier = llmConfig();
  return {
    ok: true, mode: mock ? "mock" : "live",
    stt: { primaryModel: config.stt.primaryModel, fallbackModel: config.stt.fallbackModel,
      enabled: process.env.STT_ENABLED !== "false" && (mock || Boolean(speechKey())) },
    tts: { models: [...new Set(callerAudio.map(({ model }) => model))], lineCount: callerAudio.length },
    classifier: { mode: classifier ? "llm" : "buttons", model: classifier?.model ?? null, provider: classifier?.provider ?? null },
    shipped: { scenarios: [SCENARIO], locales },
    build: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  };
}
