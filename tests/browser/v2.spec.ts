import { test, expect, type Page } from "@playwright/test";
import { startConversation, advanceConversation, conversationScore } from "../../src/domain/v2/controller";
import type { ConversationSession, TurnOperation } from "../../src/domain/v2/contracts";
import type { Locale } from "../../src/domain/scenario";
import { uiCopy } from "../../src/domain/v2/ui-copy";
import { encodeWav } from "../../src/domain/wav";

/** These are explicit protocol fixtures. They never call Gnani, an LLM or a database. */
async function fixtures(page: Page, options: { transcript?: string; holdReply?: boolean } = {}) {
  let session: ConversationSession;
  const requests: Record<string, unknown>[] = [];
  let release!: () => void;
  let received!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const pending = new Promise<void>((resolve) => { received = resolve; });
  await page.route("**/api/v2/**", (route) => route.abort());
  const wav = encodeWav(Float32Array.from({ length: 1600 }, (_, i) => Math.sin(i / 9) * 0.12), 16000);
  await page.route("**/api/v2/tts", (route) => route.fulfill({ contentType: "audio/wav", body: Buffer.from(wav) }));
  await page.route("**/api/v2/stt", (route) => route.fulfill({ json: {
    ok: true, transcript: options.transcript ?? "I will not share the practice code.",
    stt: { model: "prisma-v3.0", requestId: "explicit-browser-fixture" }, proof: "a".repeat(64), expiresAt: Date.now() + 120000,
  } }));
  await page.route("**/api/v2/conversation", async (route) => {
    const input = route.request().postDataJSON(); requests.push(input);
    if (input.action === "start") session = startConversation(crypto.randomUUID(), input.locale, Date.now());
    else if (input.action === "end") session = advanceConversation(session, {
      sessionId: session.sessionId, operationId: crypto.randomUUID(), expectedTurn: session.turn,
      reply: { origin: "button", id: "end" },
    }, null, "fixture", Date.now());
    else {
      if (options.holdReply) { received(); await held; }
      if (!session.ending) {
        const operation = input.operation as TurnOperation;
        const text = operation.reply.origin === "button" ? "" : operation.reply.text;
        session = advanceConversation(session, operation, { intent: "QUESTION", verify: false, confidence: 0.99, evidence: text }, "fixture", Date.now());
      }
    }
    try { await route.fulfill({ json: { ok: true, mode: "fixture", educationalSimulation: true,
      session, status: "ready", callerSource: "authored_fallback", result: session.ending ? conversationScore(session) : null } }); }
    catch { /* An intentionally aborted pending request may no longer accept a response. */ }
  });
  return { requests, pending, release: () => release() };
}

for (const locale of ["ta", "te"] as Locale[]) {
  test(`explicit ${locale} fixture completes a mobile typed call without pretending to be live`, async ({ page }) => {
    const f = await fixtures(page), c = uiCopy[locale];
    await page.goto(`/v2?fixture=1&l=${locale}`);
    await expect(page.getByTestId("v2-fixture")).toContainText(c.fixture);
    await expect(page.getByRole("button", { name: locale === "ta" ? "தமிழ்" : "తెలుగు", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (locale === "ta") await page.screenshot({ path: "test-results/v2-incoming-ta.png", fullPage: true });
    await page.getByRole("button", { name: c.answer, exact: true }).click();
    await expect(page.getByTestId("v2-caption")).toContainText(locale === "ta" ? "வணக்கம்" : "నమస్కారం");
    await page.getByRole("textbox", { name: c.compose }).fill(locale === "ta" ? "நீங்கள் யார்?" : "మీరు ఎవరు?");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect.poll(() => f.requests.filter((request) => request.action === "reply").length).toBe(1);
    await expect(page.getByTestId("v2-state")).toContainText(c.ready);
    expect((f.requests.find((request) => request.action === "reply")!.operation as TurnOperation).reply.origin).toBe("typed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (locale === "ta") await page.screenshot({ path: "test-results/v2-call-ta.png", fullPage: true });
    await page.getByRole("button", { name: c.end, exact: true }).click();
    await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
    await expect(page.getByTestId("v2-criterion-protect_secrets")).toContainText(c.hintSecret);
    await expect(page.getByTestId("v2-criterion-verify_independently")).toContainText(`${c.evidence}: 1`);
    await expect(page.getByTestId("v2-criterion-exit_safely")).toContainText(c.hintExit);
    await expect(page.getByText(c.educational, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: c.share, exact: true })).toHaveCount(0);
    await expect(page.getByTestId("v2-fixture")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (locale === "ta") await page.screenshot({ path: "test-results/v2-results-ta.png", fullPage: true });
  });
}

test("End stays available during a pending reply and a late response cannot reopen the call", async ({ page }) => {
  const f = await fixtures(page, { holdReply: true }), c = uiCopy.en;
  await page.goto("/v2?fixture=1&l=en");
  await page.getByRole("button", { name: c.answer, exact: true }).click();
  await page.getByRole("textbox", { name: c.compose }).fill("Who are you?");
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await f.pending;
  await expect(page.getByRole("button", { name: c.end, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: c.end, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  f.release();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: c.record, exact: true })).toHaveCount(0);
  expect(f.requests.filter((request) => request.action === "end")).toHaveLength(1);
});

for (const edited of [false, true]) {
  test(`actual browser recorder confirms fixture STT as ${edited ? "typed after editing" : "voice with signed context"}`, async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    const f = await fixtures(page), c = uiCopy.en;
    await page.goto("/v2?fixture=1&l=en");
    await page.getByRole("button", { name: c.answer, exact: true }).click();
    await page.getByRole("button", { name: c.record, exact: true }).click();
    await expect(page.getByRole("button", { name: c.stop, exact: true })).toBeVisible();
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: c.stop, exact: true }).click();
    const confirmation = page.getByRole("textbox", { name: c.confirmTitle });
    await expect(confirmation).toHaveValue("I will not share the practice code.");
    expect(f.requests.filter((request) => request.action === "reply")).toHaveLength(0);
    if (edited) { await confirmation.fill("I will verify independently."); await expect(page.getByText(c.edited)).toBeVisible(); }
    await page.getByRole("button", { name: c.confirmSend, exact: true }).click();
    await expect.poll(() => f.requests.filter((request) => request.action === "reply").length).toBe(1);
    const sent = f.requests.find((request) => request.action === "reply")!;
    expect((sent.operation as TurnOperation).reply.origin).toBe(edited ? "typed" : "voice");
    expect(Boolean(sent.confirmation)).toBe(!edited);
    await page.getByRole("button", { name: c.end, exact: true }).click();
    await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  });
}

test("microphone denial leaves typing and End fully usable", async ({ page }) => {
  const f = await fixtures(page), c = uiCopy.en;
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Denied", "NotAllowedError")); });
  await page.goto("/v2?fixture=1&l=en");
  await page.getByRole("button", { name: c.answer, exact: true }).click();
  await page.getByRole("button", { name: c.record, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: c.micError })).toBeVisible();
  await expect(page.getByRole("textbox", { name: c.compose })).toBeEnabled();
  await page.getByRole("button", { name: c.end, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  expect(f.requests.filter((request) => request.action === "reply")).toHaveLength(0);
});

test("closed preview offers V1 without credential jargon or provider requests", async ({ page }) => {
  const c = uiCopy.en;
  let requests = 0;
  await page.route("**/api/v2/**", (route) => { requests++; return route.abort(); });
  await page.goto("/v2?l=en");
  await expect(page.getByRole("heading", { name: c.unavailableTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: c.v1, exact: true })).toHaveAttribute("href", "https://scamsuno.vercel.app/?l=en");
  await expect(page.getByRole("button", { name: c.answer, exact: true })).toHaveCount(0);
  await expect(page.getByTestId("v2-fixture")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/credential|API key|environment variable|database/i);
  expect(requests).toBe(0);
});
