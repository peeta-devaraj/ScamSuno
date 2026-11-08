import assert from "node:assert/strict";
import test from "node:test";
import { POST as sttRoute } from "../app/api/stt/route";
import { POST as turnRoute } from "../app/api/turn/route";
import { GET as healthRoute } from "../app/api/health/route";
import { encodeWav } from "../src/domain/wav";
import { classify, classifyButton } from "../src/server/classifier";
import { mockMode, prisma, timbre, transcribe } from "../src/server/gnani/client";

const path = "http://localhost";
const wav = encodeWav(new Float32Array(16_000), 16_000);
const turn = (body: object) => turnRoute(new Request(path, { method: "POST", body: JSON.stringify(body) }));
const ctx = { demand: "otp", lastLineEn: "Please read me the code." } as const;
const judgement = (intent: string, evidence: string, verify = false, confidence = 0.99) =>
  Response.json({ choices: [{ message: { content: JSON.stringify({ intent, evidence, verify, confidence }) } }] });

function setupLLM(t: { after: (fn: () => void) => void }) {
  const original = { ...process.env };
  process.env.LLM_BASE_URL = "https://classifier.invalid/v1";
  process.env.LLM_API_KEY = "test-credential";
  process.env.LLM_MODEL = "test-model";
  process.env.CLASSIFIER_MODE = "llm";
  t.after(() => {
    for (const key of ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "CLASSIFIER_MODE"]) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  });
}

test("contextual numbers cannot score as disclosure even when the model suggests it", async (t) => {
  setupLLM(t);
  for (const text of ["I won't share 482197", "“482197”", "you asked for 482197?", "you said 4.8.2.1.9.7", "मैं ४८२१९७ नहीं बताऊँगी", "main 482197 nahi dunga", "Okay",
    "“நான்கு எட்டு இரண்டு ஒன்று ஒன்பது ஏழு”", "அந்தக் குறியீட்டைச் சொல்ல மாட்டேன்", "నేను ౪౮౨౧౯౭ చెప్పను", "నేను కోడ్ ఇవ్వను", "సరే"]) {
    const guessed = await classify(text, ctx, async () => judgement("COMPLY", text));
    assert.equal(guessed.intent, "UNCLEAR");
    assert.equal(guessed.source, "guard");
  }
  const refusal = await classify("मैं ४८२१९७ नहीं बताऊँगी", ctx, async () => judgement("REFUSE", "नहीं बताऊँगी"));
  assert.equal(refusal.intent, "REFUSE");
  assert.equal((await classify("Did you say 482197?", ctx, async () => judgement("QUESTION", "Did you say"))).intent, "QUESTION");
  assert.equal((await classify("482197", ctx)).source, "detector");
  assert.equal((await classify("I'll tell you my code", ctx, async () => judgement("COMPLY", "tell you my code"))).intent, "COMPLY");
  assert.equal((await classify("Okay", ctx, async () => judgement("COMPLY", "invented"))).intent, "UNCLEAR");
  assert.equal((await classify("Okay", ctx, async () => judgement("ACKNOWLEDGE", "Okay", true))).verify, false);
  assert.equal((await classify("Okay", ctx, async () => judgement("SEND_CODE", "Okay"))).degraded, true);
  assert.equal(classifyButton("go_along", "none").intent, "ACKNOWLEDGE");
});

test("Prisma sends documented multipart fields and records upstream metadata", async (t) => {
  const previous = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = "test-credential";
  t.after(() => { if (previous === undefined) delete process.env.GNANI_API_KEY; else process.env.GNANI_API_KEY = previous; });
  const result = await prisma(wav, "hi", "prisma-v3.0", undefined, async (url, init) => {
    assert.equal(url, "https://api.vachana.ai/stt/v3");
    assert.ok(new Headers(init?.headers).has("X-API-Key-ID"));
    const form = init?.body as FormData;
    assert.equal((form.get("audio_file") as File).name, "reply.wav");
    assert.equal(form.get("language_code"), "hi-IN,en-IN");
    assert.equal(form.get("format"), "transcribe");
    assert.equal(form.get("model"), "prisma-v3.0");
    return Response.json({ success: true, transcript: "test", request_id: "fixture", model: "prisma-v3.0" });
  });
  assert.equal(result.request_id, "fixture");
  const requestedModels: unknown[] = [];
  const fallback = await transcribe(wav, "hi", async (_url, init) => {
    const form = init?.body as FormData;
    requestedModels.push(form.get("model"));
    return form.has("model") ? Response.json({ detail: { error_code: "SCOPE_NOT_ALLOWED" } }, { status: 403 }) :
      Response.json({ success: true, transcript: "test", request_id: "fixture", model: "gnani-prisma-v2.5" });
  });
  assert.deepEqual(requestedModels, ["prisma-v3.0", null]);
  assert.equal(fallback.usedFallback, true);
  const clip = await timbre("Test script", "en", "timbre-v2.5", "wav", async (url, init) => {
    assert.equal(url, "https://api.vachana.ai/api/v1/tts/inference");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.voice, "Girish");
    assert.equal(body.audio_config.container, "wav");
    return new Response(wav, { headers: { "content-type": "audio/wav" } });
  });
  assert.equal(clip.contentType, "audio/wav");
});

test("mock voice is labelled, confirms with signed metadata, and rejects forged replies", async (t) => {
  setupLLM(t);
  const previous = { GNANI_MODE: process.env.GNANI_MODE, VERCEL_ENV: process.env.VERCEL_ENV };
  process.env.GNANI_MODE = "mock";
  process.env.VERCEL_ENV = "development";
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  assert.equal((await healthRoute().json()).mode, "mock");
  const form = new FormData();
  form.set("audio", new Blob([wav], { type: "audio/wav" }), "reply.wav");
  form.set("locale", "en"); form.set("scenarioId", "kyc_freeze"); form.set("stateId", "INTRO");
  const heard = await (await sttRoute(new Request(path, { method: "POST", body: form }))).json();
  assert.equal(heard.stt.model, "mock");
  const { session } = await (await turn({ action: "start", scenarioId: "kyc_freeze", locale: "en", sessionId: crypto.randomUUID() })).json();
  const forged = await turn({ action: "reply", session, reply: { inputMode: "voice", text: "changed", stt: heard.stt, proof: heard.proof } });
  assert.equal(forged.status, 400);
  t.mock.method(globalThis, "fetch", async () => judgement("REFUSE", "call my bank myself", true));
  const accepted = await (await turn({ action: "reply", session, reply: {
    inputMode: "voice", text: heard.transcript, stt: heard.stt, proof: heard.proof,
  } })).json();
  assert.equal(accepted.terminal, "END_VERIFIED");
  assert.equal(accepted.session.turns[0].inputMode, "voice");
  assert.equal(accepted.session.turns[0].stt.model, "mock");
  assert.equal((await turn({ action: "hangup", session: accepted.session })).status, 409);
});

test("Vercel production rejects mock mode", (t) => {
  const previous = { GNANI_MODE: process.env.GNANI_MODE, VERCEL_ENV: process.env.VERCEL_ENV };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.GNANI_MODE = "mock";
  process.env.VERCEL_ENV = "production";
  assert.throws(mockMode, /mock is forbidden/);
});

test("typed refusal and verification pass through the normal route; provider failure leaves the turn open", async (t) => {
  setupLLM(t);
  const { session } = await (await turn({ action: "start", scenarioId: "kyc_freeze", locale: "en", sessionId: crypto.randomUUID() })).json();
  let fixture = () => Response.json({}, { status: 503 });
  t.mock.method(globalThis, "fetch", async () => fixture());
  const typed = { action: "reply", session, reply: { inputMode: "typed", text: "I'll call the number on my card" } };
  const paused = await (await turn(typed)).json();
  assert.equal(paused.stalled, true);
  assert.equal(paused.ui.showQuickReplies, true);
  assert.equal(paused.session.turns.length, 0);
  fixture = () => judgement("REFUSE", "number on my card", true);
  const ending = await (await turn(typed)).json();
  assert.equal(ending.session.turns[0].inputMode, "typed");
  assert.equal(ending.session.turns[0].stt, undefined);
  assert.equal(ending.terminal, "END_VERIFIED");
});

test("deployed V2 closes legacy paid endpoints while keeping explicit-choice playback functional", async (t) => {
  setupLLM(t);
  const keys = ["VERCEL", "GNANI_MODE", "STT_ENABLED"];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; });
  process.env.VERCEL = "1"; process.env.GNANI_MODE = "live"; process.env.STT_ENABLED = "true";
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => { fetches++; throw new Error("no legacy provider dispatch"); });
  assert.equal((await sttRoute(new Request(path, { method: "POST" }))).status, 503);
  const started = await (await turn({ action: "start", scenarioId: "kyc_freeze", locale: "ta", sessionId: crypto.randomUUID() })).json();
  assert.equal(started.ui.showQuickReplies, true);
  const typed = await (await turn({ action: "reply", session: started.session, reply: { inputMode: "typed", text: "I will verify independently" } })).json();
  assert.equal(typed.stalled, true);
  assert.equal(typed.session.turns.length, 0);
  const chosen = await (await turn({ action: "reply", session: started.session, reply: { inputMode: "button", buttonId: "verify_self" } })).json();
  assert.equal(chosen.terminal, "END_VERIFIED");
  assert.equal(fetches, 0);
});
