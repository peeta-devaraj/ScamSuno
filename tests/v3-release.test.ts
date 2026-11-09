import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { POST as v2Conversation } from "../app/api/v2/conversation/route";
import { POST as v2STT } from "../app/api/v2/stt/route";
import { POST as v2TTS } from "../app/api/v2/tts/route";
import { buildCallerMessages, buildEvaluatorMessages } from "../src/server/v3/caller";
import { createConversationHandler } from "../src/server/v3/conversation-http";
import { initializeLedger, reserveUsage, setPolicy, usageSummary } from "../src/server/v2/ledger";
import { createStoredSession, initializeSessions, pruneV3Content, verifyStoredSession, V3_CONTENT_RETENTION_MS, V3_START_LIMIT } from "../src/server/v3/sessions";

const origin = "https://release-fixture.invalid";
function start(path = "/api/v3/conversation") {
  return new Request(origin + path, { method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ action: "start", locale: "en" }) });
}

test("closed V3 policy cannot write sessions and open policy bounds concurrent starts", async t => {
  const database = createClient({ url: "file::memory:" });
  t.after(() => database.close());
  await initializeLedger(database);
  await initializeSessions(database);
  const handler = createConversationHandler({
    mode: () => "live", database: async () => database,
    gateway: () => { throw new Error("A start must never reach the provider"); },
  });
  const burst = () => Promise.all(Array.from({ length: V3_START_LIMIT + 4 }, async () => (await handler(start())).status));
  assert.deepEqual(new Set(await burst()), new Set([503]));
  assert.equal((await database.execute("SELECT COUNT(*) AS n FROM v3_sessions")).rows[0].n, 0);
  const now = Date.now();
  await setPolicy(database, { enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 60_000,
    verifiedCreditFloor: 4000, reserveCredits: 1000, maxGnaniRequests: 6, maxGnaniRequestsPerDay: 6,
    maxLLMRequests: 8, maxLLMRequestsPerDay: 8, maxRequestsPerSession: 20, maxConcurrent: 1,
    maxSTTSeconds: 15, maxTTSChars: 420 });
  const open = await burst();
  assert.equal(open.filter(status => status === 200).length, V3_START_LIMIT);
  assert.equal(open.filter(status => status === 429).length, 4);
  assert.equal((await database.execute("SELECT COUNT(*) AS n FROM v3_sessions")).rows[0].n, V3_START_LIMIT);
});

test("V3 deployment settings close all V2 live routes before touching providers", async t => {
  const settings = { V3_TRUST_OR_TRAP_ENABLED: "true", V2_LIVE_ENABLED: "true", LLM_API_KEY: "synthetic-unused", GNANI_API_KEY: "synthetic-unused" };
  const previous = Object.fromEntries(Object.keys(settings).map(name => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  Object.assign(process.env, settings);
  assert.equal((await v2Conversation(start("/api/v2/conversation"))).status, 503);
  assert.equal((await v2STT(start("/api/v2/stt"))).status, 503);
  assert.equal((await v2TTS(start("/api/v2/tts"))).status, 503);
});

test("cleanup removes expired V3 conversation content and leaves active sessions and ledger attempts", async t => {
  const database = createClient({ url: "file::memory:" });
  t.after(() => database.close());
  await initializeLedger(database);
  await initializeSessions(database);
  const now = Date.now(), then = now - V3_CONTENT_RETENTION_MS - 480_001;
  const old = await createStoredSession(database, "en", then);
  const active = await createStoredSession(database, "te", now);
  const operation = { sessionId: old.session.sessionId, expectedTurn: 0, operationId: crypto.randomUUID() };
  await verifyStoredSession(database, old.secret, operation, then + 1);
  await verifyStoredSession(database, old.secret, { ...operation, operationId: crypto.randomUUID() }, then + 2);
  assert.equal((await database.execute("SELECT COUNT(*) AS n FROM v3_verification_events")).rows[0].n, 1);
  await setPolicy(database, { enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 60_000,
    verifiedCreditFloor: 4000, reserveCredits: 1000, maxGnaniRequests: 6, maxGnaniRequestsPerDay: 6,
    maxLLMRequests: 8, maxLLMRequestsPerDay: 8, maxRequestsPerSession: 20, maxConcurrent: 1,
    maxSTTSeconds: 15, maxTTSChars: 420 }, now);
  await reserveUsage(database, { attemptId: crypto.randomUUID(), operationId: crypto.randomUUID(),
    sessionId: old.session.sessionId, kind: "gnani_stt", model: "prisma-v3.0", audioSeconds: 1 }, now);
  assert.equal(await pruneV3Content(database, now), 1);
  assert.equal((await database.execute("SELECT session_id FROM v3_sessions")).rows[0].session_id, active.session.sessionId);
  assert.equal((await database.execute("SELECT COUNT(*) AS n FROM v3_verification_events")).rows[0].n, 0);
  assert.equal((await usageSummary(database, now)).counters.active, 1);
});

test("bare and localized numeric replies are masked before both model requests", async t => {
  const database = createClient({ url: "file::memory:" });
  t.after(() => database.close());
  await initializeSessions(database);
  const { session } = await createStoredSession(database, "en");
  for (const text of ["482197", "௪௮௨௧௯௭", "౪౮౨౧౯౭", "४८२१९७"]) {
    const reply = { origin: "typed", text } as const;
    for (const build of [buildCallerMessages, buildEvaluatorMessages]) {
      const payload = JSON.parse(build(session, reply)[1].content);
      assert.equal(payload.participant_reply.text, "••••••");
    }
  }
});
