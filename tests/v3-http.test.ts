import assert from "node:assert/strict";
import test, { before, after, type TestContext } from "node:test";
import { createClient } from "@libsql/client";
import { createConversationHandler, sessionOwner } from "../src/server/v3/conversation-http";
import { createStoredSession, initializeSessions, readStoredSession } from "../src/server/v3/sessions";
import { mintVoiceProof } from "../src/server/v2/voice-proof";
import { withinLimit } from "../src/server/http";
import { v3Database } from "../src/server/v3/runtime";

// Explicit fixtures: never use inherited deployed configuration or provider keys.
const keys = ["VERCEL", "VERCEL_ENV", "NODE_ENV", "V2_VOICE_PROOF_SECRET"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
before(() => { delete process.env.VERCEL; delete process.env.VERCEL_ENV; process.env.V2_VOICE_PROOF_SECRET = "c".repeat(64); });
after(() => { for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
const base = "https://preview.invalid";
function post(body: unknown, cookie?: string, address = "v3-http-fixture", origin = base) {
  return new Request(`${origin}/api/v3/conversation`, { method: "POST", headers: { origin, "content-type": "application/json",
    "x-vercel-forwarded-for": address, ...(cookie ? { cookie } : {}),
  }, body: JSON.stringify(body) });
}
async function fixture(t: TestContext) {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close()); await initializeSessions(client);
  const requests: string[] = [], control = { mode: "fixture" as "fixture" | null, fail: false };
  const handler = createConversationHandler({ mode: () => control.mode, database: async () => client, gateway: () => ({ async execute(request) {
    requests.push(request.purpose);
    if (control.fail) throw new Error("private provider diagnostic and fixture token");
    const data = JSON.parse(request.messages[1].content);
    return JSON.stringify(request.purpose === "evaluator" ? { kind: "uncertainty_recognized", confidence: 0.99, evidence: data.participant_reply.text } :
      { locale: data.locale, text: "You can take time to consider this notice. What would you like to clarify?", action: "continue" });
  } }) });
  return { client, handler, requests, control };
}
async function start(f: Awaited<ReturnType<typeof fixture>>, locale = "en") {
  const response = await f.handler(post({ action: "start", locale }));
  assert.equal(response.status, 200);
  return { cookie: response.headers.get("set-cookie")!.split(";")[0], response, body: await response.json() };
}

test("start issues an isolated secure owner cookie and a strict public session without hidden answers", async (t) => {
  const f = await fixture(t), s = await start(f, "ta");
  assert.match(s.response.headers.get("set-cookie")!, /scamsuno_v3_[a-f0-9-]{36}=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/api\/v3; Max-Age=780; Secure/);
  assert.equal(s.body.debrief, null); assert.equal(s.body.educationalSimulation, true);
  assert.equal(s.body.session.locale, "ta"); assert.equal(s.response.headers.get("cache-control"), "no-store");
  for (const forbidden of ["scenarioId", "groundTruth", "observations", "history", "routine_update", "kyc_pressure", "unverified_notice"]) {
    assert.ok(!JSON.stringify(s.body).includes(forbidden), forbidden);
  }
  assert.equal(sessionOwner(post({}, s.cookie), s.body.session.sessionId)?.length, 64);
  assert.equal(sessionOwner(post({}, `${s.cookie}; ${s.cookie}`), s.body.session.sessionId), null);
  assert.equal(sessionOwner(post({}, s.cookie.replace("scamsuno_v3", "scamsuno_v2")), s.body.session.sessionId), null);
  assert.deepEqual(f.requests, []);
});

test("two calls in the same browser keep independent feedback ownership, including across a pause", async (t) => {
  const f = await fixture(t), a = await start(f, "ta"), b = await start(f, "te");
  const sidA = a.body.session.sessionId, sidB = b.body.session.sessionId;
  assert.notEqual(a.cookie.split("=")[0], b.cookie.split("=")[0]);
  const finish = (id: string, cookies: string) => f.handler(post({ action: "end", sessionId: id }, cookies));
  assert.equal((await finish(sidA, b.cookie)).status, 401);
  assert.equal((await finish(sidB, a.cookie)).status, 401);
  const both = `${a.cookie}; ${b.cookie}`;
  f.control.mode = null;
  for (const [id, locale] of [[sidA, "ta"], [sidB, "te"]]) {
    const response = await finish(id, both), data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.session.locale, locale);
    assert.equal(data.debrief.decisions.length, 4);
    assert.deepEqual((await (await finish(id, both)).json()).debrief, data.debrief);
  }
  assert.deepEqual(f.requests, []);
});

test("owned fixture text journeys work for all three assignments and reveal only after End", async (t) => {
  const f = await fixture(t);
  for (let index = 0; index < 3; index++) {
    const created = await createStoredSession(f.client, "en", Date.now(), () => index), cookie = `scamsuno_v3=${created.session.sessionId}.${created.secret}`;
    const operation = { sessionId: created.session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0, reply: { origin: "typed", text: "I am not sure who you are." } };
    const response = await f.handler(post({ action: "reply", operation }, cookie)); assert.equal(response.status, 200);
    const next = await response.json(); assert.equal(next.session.turn, 1); assert.equal(next.debrief, null);
    assert.equal("scenarioId" in next.session, false); assert.equal("history" in next.session, false);
    assert.equal((await f.handler(post({ action: "reply", operation }, cookie))).status, 200);
    const ended = await f.handler(post({ action: "end", sessionId: created.session.sessionId }, cookie));
    const debrief = (await ended.json()).debrief; assert.ok(debrief.category); assert.ok(debrief.explanation); assert.ok(debrief.decisions.length);
  }
  assert.equal(f.requests.length, 6, "completed operations replay without model requests");
});

test("verification is server-controlled, owned, idempotent and remains available after End and flag rollback", async (t) => {
  const f = await fixture(t), s = await start(f), sid = s.body.session.sessionId;
  const operation = { sessionId: sid, operationId: crypto.randomUUID(), expectedTurn: 0 };
  assert.equal((await f.handler(post({ action: "verify", operation }))).status, 401);
  assert.equal((await f.handler(post({ action: "verify", operation: { ...operation, finding: "corroborated" } }, s.cookie))).status, 400);
  assert.equal((await f.handler(post({ action: "end", sessionId: sid }, s.cookie))).status, 200);
  f.control.mode = null;
  const checked = await f.handler(post({ action: "verify", operation }, s.cookie)); assert.equal(checked.status, 200);
  const body = await checked.json(); assert.equal(body.mode, "disabled"); assert.equal(body.session.ending, "participant");
  assert.equal(body.session.verification.checked, true); assert.ok(body.debrief);
  assert.equal((await f.handler(post({ action: "verify", operation }, s.cookie))).status, 200);
  assert.equal((await f.client.execute("SELECT * FROM v3_verification_events")).rows.length, 1);
  assert.deepEqual(f.requests, []);
});

test("feature off and any deployed fixture configuration reject starts before touching storage", async () => {
  let touched = 0;
  const deps = { database: async () => { touched++; throw new Error("must not access"); }, gateway: () => { throw new Error("must not dispatch"); } };
  assert.equal((await createConversationHandler({ ...deps, mode: () => null })(post({ action: "start", locale: "en" }))).status, 503);
  for (const environment of ["preview", "production", "development"]) {
    process.env.VERCEL = "1"; process.env.VERCEL_ENV = environment;
    assert.equal((await createConversationHandler({ ...deps, mode: () => "fixture" })(post({ action: "start", locale: "en" }))).status, 503);
  }
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  assert.equal(touched, 0);
});

test("TLS, same-origin, strict schemas and size limits reject malformed or forged requests", async (t) => {
  const f = await fixture(t), s = await start(f), sid = s.body.session.sessionId;
  const mismatch = post({ action: "start", locale: "en" }); mismatch.headers.set("origin", "https://other.invalid");
  assert.equal((await f.handler(mismatch)).status, 403);
  assert.equal((await f.handler(post({ action: "start", locale: "en" }, undefined, "http", "http://remote.invalid"))).status, 403);
  const missing = post({ action: "start", locale: "en" }); missing.headers.delete("origin"); assert.equal((await f.handler(missing)).status, 403);
  assert.equal((await f.handler(post({ action: "start", locale: "en", scenarioId: "routine_update" }))).status, 400);
  assert.equal((await f.handler(post({ action: "end", sessionId: sid }, s.cookie.replace(/.$/, "z")))).status, 401);
  const oversized = post({ action: "start", locale: "en", filler: "x".repeat(5000) }); assert.equal((await f.handler(oversized)).status, 400);
  const invalid = new Request(`${base}/api/v3/conversation`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: new Uint8Array([255]) });
  assert.equal((await f.handler(invalid)).status, 400);
  const stale = { sessionId: sid, operationId: crypto.randomUUID(), expectedTurn: 1, reply: { origin: "typed", text: "Who are you?" } };
  assert.equal((await f.handler(post({ action: "reply", operation: stale }, s.cookie))).status, 409);
  assert.deepEqual(f.requests, []);
});

test("forged or edited voice provenance is rejected, confirmed voice keeps its stored origin", async (t) => {
  const f = await fixture(t), s = await start(f), sessionId = s.body.session.sessionId;
  const secret = sessionOwner(post({}, s.cookie), sessionId)!, text = "I am not sure who you are.";
  const confirmation = mintVoiceProof(secret, { sessionId, expectedTurn: 0, locale: "en", text, model: "prisma-v3.0", requestId: "v3-fixture" });
  const operation = { sessionId, operationId: crypto.randomUUID(), expectedTurn: 0, reply: { origin: "voice", text,
    transcription: { provider: "gnani", model: "prisma-v3.0", requestId: "v3-fixture", confirmed: true } } };
  assert.equal((await f.handler(post({ action: "reply", operation }, s.cookie))).status, 400);
  assert.equal((await f.handler(post({ action: "reply", operation: { ...operation, reply: { ...operation.reply, text: "edited" } }, confirmation }, s.cookie))).status, 400);
  assert.equal((await f.handler(post({ action: "reply", operation, confirmation }, s.cookie))).status, 200);
  assert.equal((await readStoredSession(f.client, sessionId, secret)).history[0].origin, "voice");
  assert.equal(f.requests.length, 2);
});

test("End bypasses exhausted inference limits and paused mode", async (t) => {
  const f = await fixture(t), s = await start(f), request = post({}, undefined, "v3-limit-fixture");
  for (let i = 0; i < 80; i++) withinLimit(request, "v3", 80);
  assert.equal((await f.handler(post({ action: "start", locale: "en" }, undefined, "v3-limit-fixture"))).status, 429);
  f.control.mode = null;
  const ended = await f.handler(post({ action: "end", sessionId: s.body.session.sessionId }, s.cookie, "v3-limit-fixture"));
  assert.equal(ended.status, 200); assert.equal((await ended.json()).session.ending, "participant");
});

test("pending evaluation loses to End and cannot start caller generation or expose stale state", async (t) => {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close()); await initializeSessions(client);
  let entered!: () => void, finish!: (value: string) => void;
  const active = new Promise<void>((resolve) => { entered = resolve; }), requests: string[] = [];
  const handler = createConversationHandler({ mode: () => "fixture", database: async () => client, gateway: () => ({ async execute(request) {
    requests.push(request.purpose); entered(); return new Promise<string>((resolve) => { finish = resolve; });
  } }) });
  const response = await handler(post({ action: "start", locale: "en" }));
  const cookie = response.headers.get("set-cookie")!.split(";")[0], { session } = await response.json();
  const pending = handler(post({ action: "reply", operation: { sessionId: session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0, reply: { origin: "typed", text: "Who are you?" } } }, cookie));
  await active;
  assert.equal((await handler(post({ action: "verify", operation: { sessionId: session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0 } }, cookie))).status, 409);
  assert.equal((await handler(post({ action: "end", sessionId: session.sessionId }, cookie))).status, 200);
  finish(JSON.stringify({ kind: "uncertainty_recognized", confidence: 0.99, evidence: "Who are you?" }));
  assert.equal((await pending).status, 409); assert.deepEqual(requests, ["evaluator"]);
});

test("provider diagnostics stay private and failed evaluation can finish without advancing", async (t) => {
  const f = await fixture(t), s = await start(f); f.control.fail = true;
  const operation = { sessionId: s.body.session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0, reply: { origin: "typed", text: "Who are you?" } };
  const response = await f.handler(post({ action: "reply", operation }, s.cookie)), body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.status, "evaluation_unavailable"); assert.equal(body.session.turn, 0);
  assert.ok(!JSON.stringify(body).includes("private provider")); assert.equal(body.debrief, null);
  assert.equal((await f.handler(post({ action: "reply", operation }, s.cookie))).status, 200); assert.equal(f.requests.length, 1);
});

test("V3 runtime retries failed initialization and only creates additive session/ledger tables locally", async (t) => {
  const names = ["V2_DATABASE_URL", "V2_DATABASE_AUTH_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL"];
  const original = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of names) if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; });
  for (const key of names) delete process.env[key];
  await assert.rejects(v3Database(), { code: "STORE_NOT_CONFIGURED" });
  process.env.V2_DATABASE_URL = "file::memory:";
  const first = v3Database(), second = v3Database(); assert.equal(first, second);
  const client = await first; t.after(() => client.close());
  const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((row) => row.name);
  assert.ok(tables.includes("v3_sessions")); assert.ok(tables.includes("v2_usage_attempts")); assert.ok(!tables.includes("v2_sessions"));
});
