import assert from "node:assert/strict";
import { before, after } from "node:test";

// Dedicated synthetic server signing key; never a provider credential.
const previousProofKey = process.env.V2_VOICE_PROOF_SECRET;
before(() => { process.env.V2_VOICE_PROOF_SECRET = "c".repeat(64); });
after(() => { if (previousProofKey === undefined) delete process.env.V2_VOICE_PROOF_SECRET; else process.env.V2_VOICE_PROOF_SECRET = previousProofKey; });
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { encodeWav, readWav, WAV_LIMIT } from "../src/domain/wav";
import { advanceConversation } from "../src/domain/v2/controller";
import { createVoiceHandlers } from "../src/server/v2/voice-http";
import { claimTurn, commitTurn, createStoredSession, endStoredSession, initializeSessions, readStoredSession } from "../src/server/v2/sessions";
import { verifyVoiceProof } from "../src/server/v2/voice-proof";
import { SpeechError } from "../src/server/v2/speech";

const base = "https://preview.invalid";
const audio = () => encodeWav(new Float32Array(16_000).fill(0.05), 16_000);
async function fixture(t: TestContext) {
  const original = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  t.after(() => { if (original === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original; });
  const client = createClient({ url: ":memory:" }); t.after(() => client.close());
  await initializeSessions(client);
  const created = await createStoredSession(client, "ta");
  const context: { sessionId: string; expectedTurn: number; operationId: string } = {
    sessionId: created.session.sessionId, expectedTurn: 0, operationId: randomUUID() };
  const cookie = `scamsuno_v2=${context.sessionId}.${created.secret}`;
  const controls = { heard: 'I refuse to share "482197".', beforeSTT: async () => {}, beforeTTS: async () => {} };
  const calls: { kind: "stt" | "tts"; context: typeof context }[] = [];
  const handlers = createVoiceHandlers({ mode: () => "fixture", database: async () => client,
    speech: (_client, identity) => ({
      async transcribe(wav, signal) {
        calls.push({ kind: "stt", context: identity });
        assert.equal(readWav(wav)?.sampleRate, 16_000);
        assert.ok(signal instanceof AbortSignal);
        await controls.beforeSTT();
        return { transcript: controls.heard, model: "prisma-v3.0", requestId: "fixture-request", detectedLanguage: "ta-IN" };
      },
      async synthesize(signal) {
        calls.push({ kind: "tts", context: identity });
        assert.ok(signal instanceof AbortSignal);
        await controls.beforeTTS();
        return { audio: audio(), contentType: "audio/wav", model: "timbre-v3.0", voice: "Avinash" };
      },
    }),
  });
  return { client, context, cookie, secret: created.secret, session: created.session, controls, calls, ...handlers };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function form(f: Fixture) {
  const body = new FormData();
  body.set("sessionId", f.context.sessionId);
  body.set("expectedTurn", String(f.context.expectedTurn));
  body.set("operationId", f.context.operationId);
  body.set("audio", new Blob([audio()], { type: "audio/wav" }), "reply.wav");
  return body;
}
function sttRequest(f: Fixture, body: FormData = form(f), headers: HeadersInit = {}, origin = base) {
  return new Request(`${origin}/api/v2/stt`, { method: "POST", body, headers: {
    origin, cookie: f.cookie, "x-vercel-forwarded-for": f.context.sessionId, ...headers,
  } });
}
function ttsRequest(f: Fixture, body: unknown = f.context, headers: HeadersInit = {}, origin = base) {
  return new Request(`${origin}/api/v2/tts`, { method: "POST", body: JSON.stringify(body), headers: {
    origin, cookie: f.cookie, "content-type": "application/json", "x-vercel-forwarded-for": f.context.sessionId, ...headers,
  } });
}
async function advance(f: Fixture) {
  const operation = { ...f.context, operationId: randomUUID(), reply: { origin: "button" as const, id: "continue" as const } };
  const claimed = await claimTurn(f.client, f.secret, operation);
  assert.equal(claimed.kind, "claimed");
  const prepared = advanceConversation(claimed.session, operation, null, "fixture", Date.now());
  await commitTurn(f.client, f.secret, operation.operationId, prepared);
}

test("owned fixture STT issues a voice proof bound to the actual text, locale and provenance", async (t) => {
  const f = await fixture(t);
  const response = await f.sttPOST(sttRequest(f));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.mode, "fixture");
  assert.equal(body.educationalSimulation, true);
  assert.equal(body.transcript, f.controls.heard);
  assert.deepEqual(body.stt, { model: "prisma-v3.0", requestId: "fixture-request", detectedLanguage: "ta-IN" });
  assert.deepEqual(f.calls, [{ kind: "stt", context: f.context }]);
  const proofContext = { sessionId: f.context.sessionId, expectedTurn: 0, locale: "ta" as const, text: body.transcript,
    model: body.stt.model, requestId: body.stt.requestId };
  assert.equal(verifyVoiceProof(f.secret, proofContext, body.proof, body.expiresAt), true);
  for (const changed of [{ text: 'I share "482197".' }, { locale: "te" as const }, { expectedTurn: 1 },
    { model: "prisma-v2.5" }, { requestId: "forged-request" }, { sessionId: randomUUID() }]) {
    assert.equal(verifyVoiceProof(f.secret, { ...proofContext, ...changed }, body.proof, body.expiresAt), false);
  }
  assert.equal(JSON.stringify(body).includes(f.secret), false);
  const retained = await readStoredSession(f.client, f.context.sessionId, f.secret);
  assert.equal(JSON.stringify(retained).includes(f.controls.heard), false);
  assert.equal(retained.turn, 0);
});

test("empty and whitespace-only STT never issue a confirmable proof", async (t) => {
  const f = await fixture(t);
  for (const text of ["", " \n\t"]) {
    f.controls.heard = text;
    const response = await f.sttPOST(sttRequest(f));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.transcript, text);
    assert.equal(body.proof, null);
    assert.equal(body.expiresAt, null);
  }
});

test("owned TTS returns labelled no-store WAV without accepting a browser caption", async (t) => {
  const f = await fixture(t);
  const response = await f.ttsPOST(ttsRequest(f));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "audio/wav");
  assert.equal(response.headers.get("x-gnani-model"), "timbre-v3.0");
  assert.equal(response.headers.get("x-scamsuno-mode"), "fixture");
  assert.equal(response.headers.get("x-educational-simulation"), "true");
  assert.equal(readWav(new Uint8Array(await response.arrayBuffer()))?.sampleRate, 16_000);
  assert.deepEqual(f.calls, [{ kind: "tts", context: f.context }]);
  for (const extra of [{ text: "Unapproved browser caption" }, { locale: "te" }, { model: "browser-model" }, { voice: "browser-voice" }]) {
    assert.equal((await f.ttsPOST(ttsRequest(f, { ...f.context, ...extra }))).status, 400);
  }
  assert.equal(f.calls.length, 1);
});

test("ownership cookies authenticate the session before constructing any speech adapter", async (t) => {
  const f = await fixture(t);
  const stranger = await createStoredSession(f.client, "te");
  const cookies = ["", `scamsuno_v2=${f.context.sessionId}.${"a".repeat(64)}`,
    `scamsuno_v2=${stranger.session.sessionId}.${stranger.secret}`, `${f.cookie}; ${f.cookie}`, "x".repeat(8193)];
  for (const cookie of cookies) {
    assert.equal((await f.sttPOST(sttRequest(f, form(f), { cookie }))).status, 401);
    assert.equal((await f.ttsPOST(ttsRequest(f, f.context, { cookie }))).status, 401);
  }
  assert.equal(f.calls.length, 0);
});

test("cross-origin or missing-origin requests cannot read voice or invoke speech", async (t) => {
  const f = await fixture(t);
  for (const origin of ["https://untrusted.invalid", "null", ""]) {
    assert.equal((await f.sttPOST(sttRequest(f, form(f), { origin }))).status, 403);
    assert.equal((await f.ttsPOST(ttsRequest(f, f.context, { origin }))).status, 403);
  }
  assert.equal(f.calls.length, 0);
});

test("multipart rejects duplicate, unknown, missing or noncanonical fields before speech", async (t) => {
  const f = await fixture(t);
  const mutations = [
    (body: FormData) => body.append("sessionId", f.context.sessionId),
    (body: FormData) => body.append("audio", new Blob([audio()], { type: "audio/wav" }), "second.wav"),
    (body: FormData) => body.set("text", "A forged transcript"),
    (body: FormData) => body.set("locale", "te"),
    (body: FormData) => body.delete("operationId"),
    (body: FormData) => body.set("sessionId", "bad"),
    ...["01", "0.0", "-1", "11", "NaN"].map((turn) => (body: FormData) => body.set("expectedTurn", turn)),
    (body: FormData) => body.set("audio", "not a file"),
  ];
  for (const mutate of mutations) {
    const body = form(f); mutate(body);
    assert.equal((await f.sttPOST(sttRequest(f, body))).status, 400);
  }
  assert.equal(f.calls.length, 0);
});

test("body limits, MIME types, sample formats and malformed encodings reject before speech", async (t) => {
  const f = await fixture(t);
  const stereo = audio(); new DataView(stereo.buffer).setUint16(22, 2, true);
  for (const blob of [new Blob([audio()], { type: "audio/mpeg" }), new Blob([new Uint8Array(12)], { type: "audio/wav" }),
    new Blob([stereo], { type: "audio/wav" }), new Blob([new Uint8Array(WAV_LIMIT + 1)], { type: "audio/wav" })]) {
    const body = form(f); body.set("audio", blob, "reply.wav");
    assert.equal((await f.sttPOST(sttRequest(f, body))).status, 400);
  }
  assert.equal((await f.sttPOST(sttRequest(f, form(f), { "content-length": String(WAV_LIMIT + 2049) }))).status, 400);
  const huge = new Request(`${base}/api/v2/stt`, { method: "POST", body: "x".repeat(WAV_LIMIT + 2049),
    headers: { origin: base, cookie: f.cookie, "content-type": "multipart/form-data; boundary=fixture" } });
  assert.equal((await f.sttPOST(huge)).status, 400);
  assert.equal((await f.sttPOST(sttRequest(f, form(f), { "content-type": "application/json" }))).status, 400);
  assert.equal((await f.ttsPOST(ttsRequest(f, f.context, { "content-type": "text/plain" }))).status, 400);
  assert.equal((await f.ttsPOST(ttsRequest(f, { padding: "x".repeat(2049) }))).status, 400);
  const invalidJSON = new Request(`${base}/api/v2/tts`, { method: "POST", body: "{invalid", headers: {
    origin: base, cookie: f.cookie, "content-type": "application/json" } });
  assert.equal((await f.ttsPOST(invalidJSON)).status, 400);
  assert.equal(f.calls.length, 0);
});

test("stale, ended, expired or model-leased sessions fail before invoking speech", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.ttsPOST(ttsRequest(f, { ...f.context, expectedTurn: 1 }))).status, 409);
  await claimTurn(f.client, f.secret, { ...f.context, operationId: randomUUID(), reply: { origin: "typed", text: "Who are you?" } });
  assert.equal((await f.sttPOST(sttRequest(f))).status, 409);
  await endStoredSession(f.client, f.context.sessionId, f.secret);
  assert.equal((await f.ttsPOST(ttsRequest(f))).status, 409);
  const other = await createStoredSession(f.client, "ta", Date.now() - 8 * 60_000 - 1);
  const expired = { ...f.context, sessionId: other.session.sessionId };
  assert.equal((await f.ttsPOST(ttsRequest(f, expired, { cookie: `scamsuno_v2=${expired.sessionId}.${other.secret}` }))).status, 409);
  assert.equal(f.calls.length, 0);
});

test("an End during transcription or synthesis withholds the late proof and audio", async (t) => {
  const stt = await fixture(t);
  stt.controls.beforeSTT = async () => { await endStoredSession(stt.client, stt.context.sessionId, stt.secret); };
  const transcript = await stt.sttPOST(sttRequest(stt));
  assert.equal(transcript.status, 409);
  assert.equal((await transcript.json()).proof, undefined);
  const tts = await fixture(t);
  tts.controls.beforeTTS = async () => { await endStoredSession(tts.client, tts.context.sessionId, tts.secret); };
  const clip = await tts.ttsPOST(ttsRequest(tts));
  assert.equal(clip.status, 409);
  assert.equal(clip.headers.get("content-type"), "application/json");
  assert.equal(stt.calls.length + tts.calls.length, 2);
});

test("a newly committed turn withholds transcription or caller audio for the older turn", async (t) => {
  const stt = await fixture(t);
  stt.controls.beforeSTT = () => advance(stt);
  assert.equal((await stt.sttPOST(sttRequest(stt))).status, 409);
  assert.equal((await readStoredSession(stt.client, stt.context.sessionId, stt.secret)).turn, 1);
  const tts = await fixture(t);
  tts.controls.beforeTTS = () => advance(tts);
  assert.equal((await tts.ttsPOST(ttsRequest(tts))).status, 409);
  assert.equal((await readStoredSession(tts.client, tts.context.sessionId, tts.secret)).turn, 1);
});

test("sanitized speech errors map duplicates to conflict and unavailable voice to typed fallback", async (t) => {
  const f = await fixture(t);
  for (const [code, status] of [["V2_SPEECH_DUPLICATE", 409], ["V2_SPEECH_SESSION_INACTIVE", 409],
    ["V2_SPEECH_DISABLED", 503], ["V2_SPEECH_INVALID_REQUEST", 400]] as const) {
    f.controls.beforeSTT = async () => { throw new SpeechError(code); };
    assert.equal((await f.sttPOST(sttRequest(f))).status, status);
  }
  f.controls.beforeTTS = async () => { throw new Error("fixture-sensitive-provider-message"); };
  const unavailable = await f.ttsPOST(ttsRequest(f));
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  const body = await unavailable.text();
  assert.equal(body.includes("fixture-sensitive"), false);
  assert.equal(body.includes(f.secret), false);
  assert.match(body, /Type your reply/);
});

test("disabled and production fixture modes touch neither database nor speech", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const deps = { database: async () => { calls++; throw new Error("private fixture database error"); },
    speech: () => { calls++; throw new Error("must never run"); } };
  const closed = createVoiceHandlers({ ...deps, mode: () => null });
  assert.equal((await closed.sttPOST(sttRequest(f))).status, 503);
  assert.equal((await closed.ttsPOST(ttsRequest(f))).status, 503);
  process.env.VERCEL_ENV = "production";
  const production = createVoiceHandlers({ ...deps, mode: () => "fixture" });
  assert.equal((await production.sttPOST(sttRequest(f))).status, 503);
  assert.equal((await production.ttsPOST(ttsRequest(f))).status, 503);
  assert.equal(calls, 0);
});

test("voice requires TLS except loopback development and never trusts forwarded protocol headers", async (t) => {
  const f = await fixture(t);
  const names = ["NODE_ENV", "VERCEL", "VERCEL_ENV"];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  t.after(() => { for (const [name, value] of previous) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  } });
  Object.assign(process.env, { NODE_ENV: "development" }); delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  assert.equal((await f.ttsPOST(ttsRequest(f, f.context, {}, "http://127.0.0.1:3000"))).status, 200);
  assert.equal((await f.ttsPOST(ttsRequest(f, f.context, { "x-forwarded-proto": "https" }, "http://remote.invalid"))).status, 403);
  process.env.VERCEL = "1"; process.env.VERCEL_ENV = "preview";
  assert.equal((await f.sttPOST(sttRequest(f, form(f), {}, "http://localhost:3000"))).status, 403);
  assert.equal(f.calls.length, 1);
});
