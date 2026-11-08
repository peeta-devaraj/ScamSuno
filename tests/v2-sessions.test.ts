import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { advanceConversation, conversationScore } from "../src/domain/v2/controller";
import type { ConversationSession, Reply } from "../src/domain/v2/contracts";
import { databaseFromEnvironment, databaseWrite } from "../src/server/v2/database";
import { claimTurn, commitTurn, createStoredSession, endStoredSession, initializeSessions, readStoredSession } from "../src/server/v2/sessions";

const now = 1_800_000_000_000;
const operation = (s: ConversationSession, reply: Reply = { origin: "typed", text: "Who are you?" }) => ({
  sessionId: s.sessionId, operationId: crypto.randomUUID(), expectedTurn: s.turn, reply,
});
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), "scamsuno-v2-session-test-"));
  const url = pathToFileURL(join(dir, "sessions.db")).href;
  const clients = [createClient({ url })];
  t.after(async () => {
    clients.forEach((c) => c.close());
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep + "scamsuno-v2-session-test-"));
    await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  await initializeSessions(clients[0]);
  const opened = await createStoredSession(clients[0], "ta", now);
  return { ...opened, client: clients[0], reopen() { const client = createClient({ url }); clients.push(client); return client; } };
}

test("server-owned sessions persist across clients and reject an incorrect owner", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await readStoredSession(f.reopen(), f.session.sessionId, f.secret), f.session);
  await assert.rejects(readStoredSession(f.client, f.session.sessionId, "f".repeat(64)), { code: "V2_SESSION_NOT_FOUND" });
  await assert.rejects(readStoredSession(f.client, f.session.sessionId, "invalid"), { code: "V2_SESSION_NOT_FOUND" });
  const raw = await f.client.execute("SELECT owner_hash,state_json FROM v2_sessions");
  assert.ok(!JSON.stringify(raw.rows).includes(f.secret));
  assert.equal(f.secret.length, 64);
});

test("one concurrent turn owns the lease and duplicate payloads cannot redispatch", async (t) => {
  const f = await fixture(t), op = operation(f.session);
  const claims = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => claimTurn(f.client, f.secret,
    i % 2 ? { ...op, operationId: crypto.randomUUID() } : op, now + 1)));
  assert.equal(claims.filter((r) => r.status === "fulfilled" && r.value.kind === "claimed").length, 1);
  assert.equal((await f.client.execute("SELECT * FROM v2_turn_operations")).rows.length, 1);
  await assert.rejects(claimTurn(f.client, f.secret, { ...op, reply: { origin: "typed", text: "changed input" } }, now + 2),
    { code: "V2_OPERATION_CONFLICT" });
  await assert.rejects(claimTurn(f.client, f.secret, { ...op, expectedTurn: 3, operationId: crypto.randomUUID() }, now + 2),
    { code: "V2_STALE_TURN" });
});

test("committed operations replay current state and retained reply/evidence numbers are masked", async (t) => {
  const f = await fixture(t), op = operation(f.session, { origin: "typed", text: "Who asked for 482197?" });
  await claimTurn(f.client, f.secret, op, now + 1);
  const prepared = advanceConversation(f.session, op, { intent: "QUESTION", verify: false, confidence: 0.99,
    evidence: "Who asked for 482197?" }, "fixture", now + 1);
  const saved = await commitTurn(f.client, f.secret, op.operationId, prepared, now + 2);
  assert.equal(saved.turn, 1);
  assert.ok(!JSON.stringify((await f.client.execute("SELECT * FROM v2_sessions")).rows).includes("482197"));
  assert.ok(!JSON.stringify((await f.client.execute("SELECT * FROM v2_turn_operations")).rows).includes("482197"));
  const replay = await claimTurn(f.client, f.secret, op, now + 3);
  assert.equal(replay.kind, "replay");
  assert.equal(replay.session.turn, 1);
  const ended = await endStoredSession(f.client, f.session.sessionId, f.secret, now + 4);
  assert.equal(ended.ending, "participant");
  assert.equal(conversationScore(ended).criteria[2].status, "PASS");
  assert.equal((await claimTurn(f.client, f.secret, op, now + 5)).session.ending, "participant");
  assert.equal((await commitTurn(f.client, f.secret, op.operationId, prepared, now + 5)).ending, "participant");
});

test("hangup wins over an in-flight response and expired leases cannot advance state", async (t) => {
  const f = await fixture(t), op = operation(f.session);
  await claimTurn(f.client, f.secret, op, now + 1);
  const prepared = advanceConversation(f.session, op, { intent: "QUESTION", verify: false, confidence: 0.99,
    evidence: "Who are you?" }, "fixture", now + 1);
  await endStoredSession(f.client, f.session.sessionId, f.secret, now + 2);
  await assert.rejects(commitTurn(f.client, f.secret, op.operationId, prepared, now + 3), { code: "V2_LEASE_LOST" });
  const second = await createStoredSession(f.client, "te", now);
  const op2 = operation(second.session);
  await claimTurn(f.client, second.secret, op2, now + 1);
  await assert.rejects(claimTurn(f.client, second.secret, op2, now + 60_002), { code: "V2_OPERATION_UNCERTAIN" });
  const replacement = { ...op2, operationId: crypto.randomUUID() };
  assert.equal((await claimTurn(f.client, second.secret, replacement, now + 60_002)).kind, "claimed");
  await assert.rejects(commitTurn(f.client, second.secret, op2.operationId,
    advanceConversation(second.session, op2, null, "fixture", now + 1), now + 60_003), { code: "V2_LEASE_LOST" });
});

test("clock, identity and state changes cannot bypass a held expected-turn lease", async (t) => {
  const f = await fixture(t), op = operation(f.session, { origin: "button", id: "continue" });
  await claimTurn(f.client, f.secret, op, now + 1);
  const next = advanceConversation(f.session, op, null, "fixture", now + 1);
  await assert.rejects(commitTurn(f.client, f.secret, op.operationId, { ...next, locale: "en" }, now + 2), { code: "V2_INVALID_STATE" });
  await assert.rejects(commitTurn(f.client, f.secret, op.operationId, next, now), { code: "V2_INVALID_STATE" });
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).turn, 0);
  await commitTurn(f.client, f.secret, op.operationId, next, now + 2);
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).turn, 1);
});

test("transaction failure rolls back writes without exposing bound text or SQL errors", async (t) => {
  const f = await fixture(t);
  await assert.rejects(databaseWrite(f.client, async (tx) => {
    await tx.execute("UPDATE v2_sessions SET turn_number=9");
    throw new Error("private SQL diagnostic and participant text");
  }), { code: "STORE_UNAVAILABLE", message: "STORE_UNAVAILABLE" });
  assert.equal((await f.client.execute("SELECT turn_number FROM v2_sessions")).rows[0].turn_number, 0);
});

test("Vercel rejects ephemeral file databases and missing remote credentials", (t) => {
  const keys = ["VERCEL", "V2_DATABASE_URL", "V2_DATABASE_AUTH_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  t.after(() => { for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; });
  delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN;
  process.env.VERCEL = "1"; process.env.V2_DATABASE_URL = "file:test.db";
  assert.throws(databaseFromEnvironment, { code: "INVALID_STORE_CONFIG" });
  process.env.V2_DATABASE_URL = "libsql://example.turso.io"; delete process.env.V2_DATABASE_AUTH_TOKEN;
  assert.throws(databaseFromEnvironment, { code: "INVALID_STORE_CONFIG" });
  delete process.env.V2_DATABASE_URL;
  assert.throws(databaseFromEnvironment, { code: "STORE_NOT_CONFIGURED" });
});
