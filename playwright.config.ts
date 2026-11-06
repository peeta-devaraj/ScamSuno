import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { encodeWav } from "./src/domain/wav";

mkdirSync(".playwright-fixtures", { recursive: true });
const audio = resolve(".playwright-fixtures", "signal.wav");
const samples = Float32Array.from({ length: 32_000 }, (_, i) => 0.18 * Math.sin(i * Math.PI * 2 * 435 / 16000));
writeFileSync(audio, encodeWav(samples, 16000));

export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 50_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${audio}`],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/api/health",
    env: { GNANI_MODE: "mock", CLASSIFIER_MODE: "buttons", STT_ENABLED: "true", VERCEL_ENV: "development" },
    timeout: 90_000,
  },
});
