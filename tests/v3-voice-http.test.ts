import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createClient } from "@libsql/client";
import { encodeWav } from "../src/domain/wav";
import { createStoredSession, endStoredSession, initializeSessions } from "../src/server/v3/sessions";
import { createV3VoiceHandlers } from "../src/server/v3/voice-http";
import { verifyVoiceProof } from "../src/server/v2/voice-proof";

const base = "https://preview.invalid", wav = () => encodeWav(new Float32Array(16000).fill(0.05), 16000);
async function fixture(t: TestContext) {
  const keys = ["VERCEL", "VERCEL_ENV", "V2_VOICE_PROOF_SECRET"], before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  delete process.env.VERCEL; process.env.VERCEL_ENV = "development"; process.env.V2_VOICE_PROOF_SECRET = "c".repeat(64);
  t.after(() => { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; });
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close()); await initializeSessions(client);
  const created = await createStoredSession(client, "te", Date.now(), () => 2);
  const context = { sessionId: created.session.sessionId, expectedTurn: 0, operationId: crypto.randomUUID() };
  const cookie = `scamsuno_v3=${context.sessionId}.${created.secret}`, controls = { before: async () => {} }; let calls = 0;
  const handlers = createV3VoiceHandlers({ mode: () => "fixture", database: async () => client, speech: () => ({
    async transcribe() { calls++; await controls.before(); return { transcript: "నేను స్వతంత్రంగా తనిఖీ చేస్తాను", model: "prisma-v3.0", requestId: "synthetic-v3-voice-fixture" }; },
    async synthesize() { calls++; await controls.before(); return { audio: wav(), contentType: "audio/wav", model: "timbre-v3.0", voice: "Avinash" }; },
  }) });
  return { client, context, cookie, controls, ...created, handlers, calls: () => calls };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function stt(f: Fixture, cookie = f.cookie, origin = base) {
  const body = new FormData(); body.set("sessionId", f.context.sessionId); body.set("expectedTurn", "0"); body.set("operationId", f.context.operationId);
  body.set("audio", new Blob([wav()], { type: "audio/wav" }), "reply.wav");
  return new Request(`${base}/api/v3/stt`, { method: "POST", headers: { origin, cookie, "x-vercel-forwarded-for": f.context.sessionId }, body });
}
function tts(f: Fixture, data: unknown = f.context) {
  return new Request(`${base}/api/v3/tts`, { method: "POST", headers: { origin: base, cookie: f.cookie, "content-type": "application/json", "x-vercel-forwarded-for": f.context.sessionId }, body: JSON.stringify(data) });
}

test("V3-owned fixture speech returns signed confirmed provenance and no hidden assignment", async (t) => {
  const f = await fixture(t), response = await f.handlers.sttPOST(stt(f)); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.mode, "fixture"); assert.equal(data.educationalSimulation, true);
  assert.equal(verifyVoiceProof(f.secret, { sessionId: f.context.sessionId, expectedTurn: 0, locale: "te", text: data.transcript,
    model: data.stt.model, requestId: data.stt.requestId }, data.proof, data.expiresAt), true);
  for (const hidden of ["scenarioId", "unverified_notice", "groundTruth", "observations"]) assert.ok(!JSON.stringify(data).includes(hidden));
  const audio = await f.handlers.ttsPOST(tts(f)); assert.equal(audio.status, 200);
  assert.equal(audio.headers.get("cache-control"), "no-store"); assert.equal(audio.headers.get("x-scamsuno-mode"), "fixture");
  assert.equal(f.calls(), 2);
});

test("V3 voice rejects V2 cookies, wrong owners, cross-origin requests and browser-supplied caller text before speech", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.handlers.sttPOST(stt(f, f.cookie.replace("scamsuno_v3", "scamsuno_v2")))).status, 401);
  assert.equal((await f.handlers.sttPOST(stt(f, `scamsuno_v3=${f.context.sessionId}.${"a".repeat(64)}`))).status, 401);
  assert.equal((await f.handlers.sttPOST(stt(f, f.cookie, "https://untrusted.invalid"))).status, 403);
  assert.equal((await f.handlers.ttsPOST(tts(f, { ...f.context, text: "Browser chooses caller dialogue" }))).status, 400);
  assert.equal(f.calls(), 0);
});

test("End during V3 fixture STT or TTS withholds late transcripts, proofs and audio", async (t) => {
  for (const kind of ["stt", "tts"] as const) {
    const f = await fixture(t);
    f.controls.before = async () => { await endStoredSession(f.client, f.context.sessionId, f.secret); };
    const response = kind === "stt" ? await f.handlers.sttPOST(stt(f)) : await f.handlers.ttsPOST(tts(f));
    assert.equal(response.status, 409); const body = await response.json();
    assert.equal(body.proof, undefined); assert.equal(body.transcript, undefined); assert.equal(f.calls(), 1);
  }
});

test("V3 preview/production rejects injected fixture mode before database or speech access", async (t) => {
  const f = await fixture(t); let reads = 0;
  const handlers = createV3VoiceHandlers({ mode: () => "fixture", database: async () => { reads++; throw Error("not called"); }, speech: () => { throw Error("not called"); } });
  for (const env of ["preview", "production"]) {
    process.env.VERCEL_ENV = env; assert.equal((await handlers.sttPOST(stt(f))).status, 503);
  }
  assert.equal(reads, 0);
});
