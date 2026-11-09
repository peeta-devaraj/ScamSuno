import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://scamsuno.vercel.app";
const assets = resolve("brag-output/composition/assets");
const chromePath = process.env.PLAYWRIGHT_CHROME ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

await mkdir(assets, { recursive: true });
const root = await fetch(origin, { redirect: "manual" });
if (root.status !== 307 || new URL(root.headers.get("location"), origin).href !== origin + "/v3?l=en") {
  throw new Error("The public root did not redirect to the English Trust or Trap entry.");
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 820 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    recordVideo: { dir: resolve("brag-output/.tools/capture"), size: { width: 412, height: 820 } },
  });
  let blocked = 0;
  await context.route("**/*", route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin && ["GET", "HEAD"].includes(req.method()) &&
      !/^\/api(?:\/|$)/.test(url.pathname)) return route.continue();
    blocked++;
    return route.abort();
  });
  const page = await context.newPage();
  const video = page.video();
  const response = await page.goto(origin + "/v3?l=en", { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error("Could not open the public V3 entry.");
  const answer = page.getByRole("button", { name: "Answer the practice call" });
  await answer.waitFor();
  if (!await answer.isEnabled()) throw new Error("The public entry is currently paused.");
  await page.screenshot({ path: resolve(assets, "v3-entry-en.png") });
  await delay(1700);
  for (const [name, wait] of [["தமிழ்", 1250], ["తెలుగు", 1300], ["English", 1100]]) {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name, pressed: true }).waitFor();
    await delay(wait);
  }
  await context.close();
  await video.saveAs(resolve(assets, "v3-entry-raw.webm"));
  console.log(JSON.stringify({
    capturedAt: new Date().toISOString(),
    origin, rootStatus: root.status, entryStatus: response.status(),
    viewport: [412, 820], signedIn: false,
    entryAnswerEnabled: true, languagesShown: ["en", "ta", "te", "en"],
    startedCall: false, blockedRequests: blocked, providerRoutesAllowed: false,
  }, null, 2));
} finally {
  await browser.close();
}
