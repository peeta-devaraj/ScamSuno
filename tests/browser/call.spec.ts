import { test, expect, type Page } from "@playwright/test";
import { encodeWav } from "../../src/domain/wav";

test.beforeEach(async ({ page }) => {
  // Keep tests independent of the production clips' speaking durations.
  const signal = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i * 0.08) * 0.1);
  await page.route("**/audio/**", (route) => route.fulfill({
    contentType: "audio/wav", body: Buffer.from(encodeWav(signal, 16_000)),
  }));
});

async function openCall(page: Page, locale = "en") {
  await page.goto(`/play?l=${locale}`);
  await expect(page.getByText("MOCK MODE", { exact: false })).toBeVisible();
}

async function answerWithoutMic(page: Page) {
  await openCall(page);
  await page.getByRole("button", { name: "Continue without mic" }).click();
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByText(/am I speaking with the account holder/)).toBeVisible();
}

test("mobile visitor verifies independently, downloads a PNG and opens the share view", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Can you survive");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "Start the call" }).click();
  await page.getByRole("button", { name: "Continue without mic" }).click();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("You declined the unknown call.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await page.getByRole("button", { name: "Go along with it" }).click();
  await page.getByRole("button", { name: "Ask who they are" }).click();
  await expect(page.getByText(/Please read it out to me/)).toBeVisible();
  await page.getByRole("button", { name: "Ask for a moment" }).click();
  await page.getByRole("button", { name: "Say I’ll call the bank myself" }).click();
  await expect(page.getByRole("heading", { name: "You verified independently" })).toBeVisible();
  await page.getByRole("button", { name: "See what happened" }).click();
  await expect(page.getByText("80 / 80")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Red flags in this call" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reserve Bank of India" })).toBeVisible();
  await page.getByRole("button", { name: "Get my card" }).click();
  const url = await page.getByRole("link", { name: "Download PNG" }).getAttribute("href");
  expect(url).toMatch(/^\/api\/card\?t=/);
  const card = await page.request.get(url!);
  expect(card.ok()).toBeTruthy();
  expect(card.headers()["content-type"]).toContain("image/png");
  const png = await card.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG" }).click();
  expect((await download).suggestedFilename()).toBe("ScamSuno-result.png");
  await page.goto(url!.replace("/api/card", "/r"));
  await expect(page.getByRole("heading", { name: "Verified independently" })).toBeVisible();
  await expect(page.getByText("Say I’ll call the bank myself")).toHaveCount(0);
});

test("early hangup excludes the untested code and verification behaviours", async ({ page }) => {
  await answerWithoutMic(page);
  await page.getByRole("button", { name: "Hang up" }).click();
  await expect(page.getByRole("heading", { name: "You ended the call safely" })).toBeVisible();
  await page.getByRole("button", { name: "See what happened" }).click();
  await expect(page.locator(".score-row").getByText("15 / 15")).toBeVisible();
  await expect(page.getByText("Not tested", { exact: true })).toHaveCount(2);
});

test("ambiguous typed reply falls back to choices; the call can end without a decision", async ({ page }) => {
  await answerWithoutMic(page);
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByRole("textbox", { name: "Type" }).fill("I'm not sure about that.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose a reply to continue.");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: i < 2 ? "Go along with it" : "Ask who they are" }).click();
  }
  await expect(page.getByRole("heading", { name: "The call ended without a clear decision" })).toBeVisible();
});

test("Hindi flow records through AudioWorklet, confirms mock transcription and masks a code", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.route("**/api/stt", (route) => route.continue({
    headers: { ...route.request().headers(), "x-mock-transcript": "482197" },
  }));
  await openCall(page, "hi");
  await page.getByRole("button", { name: "माइक्रोफ़ोन की अनुमति दें" }).click();
  await page.getByRole("button", { name: "कॉल उठाएँ" }).click();
  await page.getByRole("button", { name: "उनकी बात मान लें" }).click();
  await page.getByRole("button", { name: "उनकी बात मान लें" }).click();
  await expect(page.getByText(/छह अंकों का कोड/)).toBeVisible();
  await page.getByRole("button", { name: "बोलें" }).click();
  await expect(page.getByRole("button", { name: "रोकें" })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "रोकें" }).click();
  await expect(page.getByText("482197", { exact: true })).toBeVisible();
  await expect(page.getByText("mock", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "जवाब भेजें" }).click();
  await expect(page.getByRole("heading", { name: "कॉलर को वह मिल गया जो उसने माँगा" })).toBeVisible();
  await page.getByRole("button", { name: "देखें क्या हुआ" }).click();
  await expect(page.getByText("482197", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list").getByText("••••••", { exact: true })).toBeVisible();
  await page.getByText("आपके जवाब कैसे समझे गए", { exact: true }).click();
  await expect(page.getByText("detector", { exact: true })).toBeVisible();
});

test("microphone denial leaves the complete captions and quick replies path available", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Denied", "NotAllowedError"));
  });
  await openCall(page);
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Microphone access is blocked");
  await page.getByRole("button", { name: "Continue without mic" }).click();
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await page.getByRole("button", { name: "Say no" }).click();
  await page.getByRole("button", { name: "Say no" }).click();
  await expect(page.getByRole("heading", { name: "You ended the call safely" })).toBeVisible();
});
