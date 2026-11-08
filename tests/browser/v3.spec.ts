import { test, expect, type Page } from "@playwright/test";
import type { PublicSession } from "../../src/domain/v3/contracts";
import type { Locale } from "../../src/domain/scenario";
import type { TurnOperation } from "../../src/domain/v2/contracts";
import { uiCopy } from "../../src/domain/v3/ui-copy";
import { encodeWav } from "../../src/domain/wav";

// Public protocol fixtures only. No server scenario registry, hidden state, provider or database.
async function fixtures(page: Page, options: { heldReply?: boolean; categoryOnEnd?: string } = {}) {
  let session: PublicSession;
  const requests: Record<string, unknown>[] = [], responses: Record<string, unknown>[] = [];
  let received!: () => void, release!: () => void;
  const pending = new Promise<void>(resolve => { received = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const caption = { en: "Hello, I'm Arun from fictional Kalpanik Bank. May we discuss a service notice?",
    ta: "வணக்கம், கற்பனை கற்பனிக் வங்கியிலிருந்து அருண் பேசுகிறேன். ஒரு சேவைச் செய்தியைப் பற்றிப் பேசலாமா?",
    te: "నమస్కారం, కల్పిత కల్పనిక్ బ్యాంకు నుంచి అరుణ్ మాట్లాడుతున్నాను. ఒక సేవా సమాచారం గురించి మాట్లాడవచ్చా?",
    hi: "नमस्ते, मैं काल्पनिक कल्पनिक बैंक से अरुण बोल रहा हूँ। क्या हम एक सेवा सूचना पर बात कर सकते हैं?" };
  await page.route("**/api/v3/**", route => route.abort());
  const wav = encodeWav(Float32Array.from({ length: 1600 }, (_, i) => Math.sin(i / 9) * 0.12), 16000);
  await page.route("**/api/v3/tts", route => route.fulfill({ contentType: "audio/wav", body: Buffer.from(wav) }));
  await page.route("**/api/v3/stt", route => route.fulfill({ json: { ok: true, mode: "fixture", educationalSimulation: true,
    transcript: "I will check independently.", stt: { model: "prisma-v3.0", requestId: "explicit-browser-fixture" },
    proof: "a".repeat(64), expiresAt: Date.now() + 120_000 } }));
  await page.route("**/api/v3/conversation", async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (body.action === "start") {
      const now = Date.now(), locale = body.locale as Locale;
      session = { v: 3, mode: "trust-or-trap", sessionId: crypto.randomUUID(), locale, turn: 0,
        createdAt: now, updatedAt: now, expiresAt: now + 480_000, ending: null, lastCaller: caption[locale], verification: { checked: false } };
    } else if (body.action === "end") session = { ...session, ending: "participant", updatedAt: Date.now() };
    else if (body.action === "verify") {
      expect(body.operation.expectedTurn).toBe(session.turn);
      session = { ...session, verification: { checked: true, finding: "inconclusive",
        message: "Explicit fixture: the simulated app cannot match this notice. That does not authenticate or disprove the caller." }, updatedAt: Date.now() };
    } else if (body.action === "reply") {
      if (options.heldReply) { received(); await held; }
      if (!session.ending) session = { ...session, turn: session.turn + 1, updatedAt: Date.now(), lastCaller: caption[session.locale] };
    }
    const response = { ok: true, mode: "fixture", educationalSimulation: true, session, status: "ready", callerSource: "authored_fallback",
      debrief: session.ending ? {
        educationalSimulation: true, category: options.categoryOnEnd ?? "unverified", categoryLabel: `Explicit fixture reveal: ${options.categoryOnEnd ?? "unverified"}`,
        explanation: "This is an explicitly labelled browser fixture. The finding concerns a notice, not the identity of an incoming voice.",
        recordedCaptions: [session.lastCaller], ending: session.ending,
        decisions: [{ id: "fixture_dimension", status: "not_tested", label: "Server-supplied fixture feedback", statusLabel: "Not tested",
          explanation: "No supported observation was recorded in this fixture.", evidenceTurns: [] }],
      } : null };
    responses.push(response);
    try { await route.fulfill({ json: response }); } catch { /* The End-race deliberately aborts a pending request. */ }
  });
  return { requests, responses, pending, release };
}

for (const [locale, categoryOnEnd] of [["ta", "legitimate"], ["te", "fraudulent"], ["hi", "unverified"]] as const) {
  test(`explicit ${locale} mobile fixture keeps assignment private and reveals only after End`, async ({ page }) => {
    const f = await fixtures(page, { categoryOnEnd }), c = uiCopy[locale];
    await page.goto(`/v3?fixture=1&l=${locale}`);
    await expect(page.getByTestId("v3-fixture")).toContainText(c.fixture);
    await expect(page.getByRole("navigation", { name: c.mode })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: c.answer, exact: true }).click();
    await expect(page.getByTestId("v3-caption")).toBeVisible();
    await expect(page.getByRole("button", { name: c.end, exact: true })).toBeInViewport();
    await expect(page.getByTestId("v3-reveal")).toHaveCount(0);
    await expect(page.getByTestId("v3-decision")).toHaveCount(0);
    const start = f.responses[0];
    expect(JSON.stringify(start)).not.toMatch(/scenarioId|groundTruth|observations|rubric|secret_refusal|routine_update|kyc_pressure|unverified_notice/);
    expect(start.debrief).toBeNull();
    if (locale === "ta") await page.screenshot({ path: "test-results/v3-call-ta.png", fullPage: true });
    await page.getByRole("textbox", { name: c.compose }).fill(locale === "ta" ? "நீங்கள் யார்?" : locale === "te" ? "మీరు ఎవరు?" : "Main apne app mein check karunga.");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect.poll(() => f.requests.filter(r => r.action === "reply").length).toBe(1);
    await expect(page.getByTestId("v3-state")).toContainText(c.ready);
    expect((f.requests.find(r => r.action === "reply")!.operation as TurnOperation).reply.origin).toBe("typed");
    await page.getByRole("button", { name: c.end, exact: true }).click();
    await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
    await expect(page.getByTestId("v3-reveal")).toContainText(categoryOnEnd);
    await expect(page.getByText("Server-supplied fixture feedback", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: c.panelAction, exact: true }).click();
    await expect(page.getByTestId("v3-verification-finding")).toContainText("Explicit fixture");
    await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
    expect(f.requests.filter(r => r.action === "verify")).toHaveLength(1);
    if (locale === "ta") await page.screenshot({ path: "test-results/v3-results-ta.png", fullPage: true });
  });
}

test("English fixture verifies independently while active without authenticating the caller", async ({ page }) => {
  const f = await fixtures(page), c = uiCopy.en;
  await page.goto("/v3?fixture=1&l=en");
  await page.getByRole("button", { name: c.answer, exact: true }).click();
  await page.getByRole("button", { name: c.panelAction, exact: true }).click();
  await expect(page.getByTestId("v3-verification-finding")).toContainText("cannot match");
  await expect(page.getByTestId("v3-reveal")).toHaveCount(0);
  await expect(page.getByText(c.panelBoundary, { exact: true })).toBeVisible();
  expect(f.responses.at(-1)!.debrief).toBeNull();
  await page.getByRole("button", { name: c.end, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
});

test("End wins over a pending reply and stale fixture output cannot reopen the call", async ({ page }) => {
  const f = await fixtures(page, { heldReply: true }), c = uiCopy.en;
  await page.goto("/v3?fixture=1&l=en");
  await page.getByRole("button", { name: c.answer, exact: true }).click();
  await page.getByRole("textbox", { name: c.compose }).fill("What is this notice about?");
  await page.getByRole("button", { name: c.send, exact: true }).click(); await f.pending;
  await expect(page.getByRole("button", { name: c.end, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: c.end, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  f.release();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: c.record, exact: true })).toHaveCount(0);
});

for (const edited of [false, true]) {
  test(`real browser recorder preserves ${edited ? "typed origin after editing" : "confirmed voice origin"} with fixture STT`, async ({ page, context }) => {
    await context.grantPermissions(["microphone"]);
    const f = await fixtures(page), c = uiCopy.en;
    await page.goto("/v3?fixture=1&l=en");
    await page.getByRole("button", { name: c.answer, exact: true }).click();
    await page.getByRole("button", { name: c.record, exact: true }).click();
    await expect(page.getByRole("button", { name: c.stop, exact: true })).toBeVisible();
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: c.stop, exact: true }).click();
    const confirmation = page.getByRole("textbox", { name: c.confirmTitle });
    await expect(confirmation).toHaveValue("I will check independently.");
    if (edited) { await confirmation.fill("I will check in my official app."); await expect(page.getByText(c.edited)).toBeVisible(); }
    await page.getByRole("button", { name: c.confirmSend, exact: true }).click();
    await expect.poll(() => f.requests.filter(r => r.action === "reply").length).toBe(1);
    const sent = f.requests.find(r => r.action === "reply")!;
    expect((sent.operation as TurnOperation).reply.origin).toBe(edited ? "typed" : "voice");
    expect(Boolean(sent.confirmation)).toBe(!edited);
    await page.getByRole("button", { name: c.end, exact: true }).click();
    await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
  });
}

test("microphone denial leaves free-form typing and End available", async ({ page }) => {
  await fixtures(page); const c = uiCopy.en;
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Denied", "NotAllowedError")); });
  await page.goto("/v3?fixture=1&l=en");
  await page.getByRole("button", { name: c.answer, exact: true }).click();
  await page.getByRole("button", { name: c.record, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: c.micError })).toBeVisible();
  await expect(page.getByRole("textbox", { name: c.compose })).toBeEnabled();
  await page.getByRole("button", { name: c.end, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.resultsTitle })).toBeVisible();
});

test("disabled V3 offers existing modes and makes no V3 API request", async ({ page }) => {
  let calls = 0; const c = uiCopy.en;
  await page.route("**/api/v3/**", route => { calls++; return route.abort(); });
  await page.goto("/v3?l=en");
  await expect(page.getByRole("heading", { name: c.unavailableTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: c.classic, exact: true })).toHaveAttribute("href", "/v2?l=en");
  await expect(page.getByRole("link", { name: c.v1, exact: true })).toHaveAttribute("href", "https://scamsuno.vercel.app/?l=en");
  await expect(page.getByRole("button", { name: c.answer, exact: true })).toHaveCount(0);
  await expect(page.getByTestId("v3-fixture")).toHaveCount(0);
  expect(calls).toBe(0);
});
