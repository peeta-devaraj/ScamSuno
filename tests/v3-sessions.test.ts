import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import type { TurnOperation } from "../src/domain/v2/contracts";
import { advanceSession } from "../src/server/v3/controller";
import type { StoredSession } from "../src/server/v3/public-session";
import { scenarioIds } from "../src/server/v3/scenarios";
import { databaseWrite } from "../src/server/v2/database";
import { initializeSessions, createStoredSession, readStoredSession, claimTurn, commitTurn,
  endStoredSession, verifyStoredSession, assertActiveTurn, hasActiveTurnLease, V3_FEEDBACK_GRACE_MS } from "../src/server/v3/sessions";

const now = 1_800_000_000_000;
async function fixture(t: TestContext, index = 0) {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeSessions(client);
  const created = await createStoredSession(client, "en", now, () => index);
  return { client, ...created };
}
function op(session: StoredSession, text = "Who are you?"): TurnOperation {
  return { sessionId: session.sessionId, operationId: randomUUID(), expectedTurn: session.turn, reply: { origin: "typed", text } };
}
const verification = (session: StoredSession) => ({ sessionId: session.sessionId, operationId: randomUUID(), expectedTurn: session.turn });
const code = (expected: string) => (error: unknown) => error instanceof Error && error.message === expected && "code" in error && error.code === expected;

test("initialization is additive, repeatable and stores only hashed owner secrets", async (t) => {
  const f = await fixture(t);
  await f.client.execute("CREATE TABLE v2_fixture (value TEXT)"); await f.client.execute("INSERT INTO v2_fixture VALUES ('preserved')");
  await initializeSessions(f.client);
  assert.equal((await f.client.execute("SELECT value FROM v2_fixture")).rows[0].value, "preserved");
  const rows = await f.client.execute("SELECT * FROM v3_sessions");
  assert.ok(!JSON.stringify(rows.rows).includes(f.secret));
  assert.match(f.secret, /^[a-f0-9]{64}$/);
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).scenarioId, f.session.scenarioId);
  await assert.rejects(readStoredSession(f.client, f.session.sessionId, "b".repeat(64)), code("V3_SESSION_NOT_FOUND"));
});

test("one parallel operation owns the lease; duplicates and changed payloads cannot redispatch", async (t) => {
  const f = await fixture(t), input = op(f.session);
  const claims = await Promise.allSettled(Array.from({ length: 4 }, () => claimTurn(f.client, f.secret, input, now + 1)));
  assert.equal(claims.filter((r) => r.status === "fulfilled" && r.value.kind === "claimed").length, 1);
  assert.equal((await f.client.execute("SELECT * FROM v3_turn_operations")).rows.length, 1);
  await assert.rejects(claimTurn(f.client, f.secret, { ...input, reply: { origin: "typed", text: "changed" } }, now + 2), code("V3_OPERATION_CONFLICT"));
  await assert.rejects(claimTurn(f.client, f.secret, { ...input, operationId: randomUUID() }, now + 2), code("V3_OPERATION_IN_PROGRESS"));
});

test("committed turns omit participant text, preserve identity and replay current state", async (t) => {
  const f = await fixture(t), input = op(f.session, "Who asked for 482197?");
  await claimTurn(f.client, f.secret, input, now + 1);
  const prepared = advanceSession(f.session, input, null, now + 2);
  const committed = await commitTurn(f.client, f.secret, input.operationId, prepared, now + 3);
  assert.equal(committed.turn, 1);
  const operations = JSON.stringify((await f.client.execute("SELECT * FROM v3_turn_operations")).rows);
  const raw = JSON.stringify((await f.client.execute("SELECT * FROM v3_sessions")).rows) + operations;
  assert.ok(!raw.includes("482197")); assert.ok(!raw.includes("Who asked"));
  assert.equal(committed.history[0].origin, "typed");
  const ended = await endStoredSession(f.client, f.session.sessionId, f.secret, now + 4);
  assert.equal((await claimTurn(f.client, f.secret, input, now + 5)).session.ending, ended.ending);
  assert.equal((await commitTurn(f.client, f.secret, input.operationId, prepared, now + 5)).ending, ended.ending);
});

test("an expired call can return feedback during the grace period without extending ownership", async (t) => {
  const f = await fixture(t), expiresAt = f.session.expiresAt;
  const ending = await endStoredSession(f.client, f.session.sessionId, f.secret, expiresAt + 1);
  assert.equal(ending.ending, "expired");
  assert.deepEqual(await endStoredSession(f.client, f.session.sessionId, f.secret, expiresAt + V3_FEEDBACK_GRACE_MS - 1), ending);
  await assert.rejects(endStoredSession(f.client, f.session.sessionId, f.secret, expiresAt + V3_FEEDBACK_GRACE_MS), code("V3_SESSION_NOT_FOUND"));
});

test("authenticated End wins over pending work and revokes paid-dispatch lease atomically", async (t) => {
  const f = await fixture(t), input = op(f.session), context = { sessionId: f.session.sessionId, turnOperationId: input.operationId };
  await claimTurn(f.client, f.secret, input, now + 1);
  await assertActiveTurn(f.client, context, now + 2);
  await endStoredSession(f.client, f.session.sessionId, f.secret, now + 3);
  await databaseWrite(f.client, async (tx) => { assert.equal(await hasActiveTurnLease(tx, context, now + 4), false); });
  await assert.rejects(assertActiveTurn(f.client, context, now + 4), code("V3_LEASE_LOST"));
  await assert.rejects(commitTurn(f.client, f.secret, input.operationId, advanceSession(f.session, input, null, now + 2), now + 4), code("V3_LEASE_LOST"));
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).ending, "participant");
});

test("expired leases quarantine old operation IDs and allow a new turn claim", async (t) => {
  const f = await fixture(t), input = op(f.session);
  await claimTurn(f.client, f.secret, input, now + 1);
  await assert.rejects(claimTurn(f.client, f.secret, input, now + 60_002), code("V3_OPERATION_UNCERTAIN"));
  const replacement = { ...input, operationId: randomUUID() };
  assert.equal((await claimTurn(f.client, f.secret, replacement, now + 60_002)).kind, "claimed");
  await assert.rejects(commitTurn(f.client, f.secret, input.operationId, advanceSession(f.session, input, null, now + 2), now + 60_003), code("V3_LEASE_LOST"));
});

test("failed evaluation completes an exact unchanged state, releases the lease and replays without redispatch", async (t) => {
  const f = await fixture(t), input = op(f.session), context = { sessionId: f.session.sessionId, turnOperationId: input.operationId };
  await claimTurn(f.client, f.secret, input, now + 1);
  const unchanged = await commitTurn(f.client, f.secret, input.operationId, f.session, now + 2);
  assert.deepEqual(unchanged, f.session);
  await assert.rejects(assertActiveTurn(f.client, context, now + 3), code("V3_LEASE_LOST"));
  const replay = await claimTurn(f.client, f.secret, input, now + 3);
  assert.equal(replay.kind, "replay"); assert.equal(replay.session.turn, 0);
  assert.equal((await f.client.execute("SELECT * FROM v3_turn_operations")).rows.length, 1);
  const retry = { ...input, operationId: randomUUID() };
  assert.equal((await claimTurn(f.client, f.secret, retry, now + 4)).kind, "claimed");
});

test("commit cannot change hidden assignment, verification, timing or prior evidence", async (t) => {
  const f = await fixture(t), input = op(f.session);
  await claimTurn(f.client, f.secret, input, now + 1);
  const next = advanceSession(f.session, input, null, now + 2);
  for (const changed of [
    { ...next, scenarioId: scenarioIds.find((id) => id !== next.scenarioId)! },
    { ...next, verificationState: "checked" }, { ...next, locale: "te" },
    { ...next, createdAt: next.createdAt + 1, expiresAt: next.expiresAt + 1 },
    { ...next, observations: [] }, { ...next, history: [{ ...next.history[0], caller: "Model replaced the caller" }] },
  ]) await assert.rejects(commitTurn(f.client, f.secret, input.operationId, changed as StoredSession, now + 3), code("V3_INVALID_STATE"));
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).turn, 0);
  assert.equal((await commitTurn(f.client, f.secret, input.operationId, next, now + 3)).turn, 1);
});

test("independent verification is owned, idempotent and records only a server event", async (t) => {
  const f = await fixture(t), input = verification(f.session);
  await assert.rejects(verifyStoredSession(f.client, "b".repeat(64), input, now + 1), code("V3_SESSION_NOT_FOUND"));
  assert.equal((await verifyStoredSession(f.client, f.secret, input, now + 1)).verificationState, "checked");
  assert.equal((await verifyStoredSession(f.client, f.secret, input, now + 2)).verificationState, "checked");
  assert.equal((await f.client.execute("SELECT * FROM v3_verification_events")).rows.length, 1);
  await assert.rejects(verifyStoredSession(f.client, f.secret, { ...input, expectedTurn: 1 }, now + 2), code("V3_OPERATION_CONFLICT"));
  const raw = JSON.stringify((await f.client.execute("SELECT * FROM v3_verification_events")).rows);
  assert.ok(!raw.includes(f.secret)); assert.ok(!raw.includes("groundTruth"));
});

test("verification serializes with model leases, and remains available after End without resurrection", async (t) => {
  const f = await fixture(t), input = op(f.session), check = verification(f.session);
  await claimTurn(f.client, f.secret, input, now + 1);
  await assert.rejects(verifyStoredSession(f.client, f.secret, check, now + 2), code("V3_OPERATION_IN_PROGRESS"));
  assert.equal((await f.client.execute("SELECT * FROM v3_verification_events")).rows.length, 0);
  const ended = await endStoredSession(f.client, f.session.sessionId, f.secret, now + 3);
  const checked = await verifyStoredSession(f.client, f.secret, check, now + 4);
  assert.equal(checked.ending, ended.ending); assert.equal(checked.turn, ended.turn); assert.equal(checked.verificationState, "checked");
  assert.equal((await verifyStoredSession(f.client, f.secret, check, now + 5)).ending, "participant");
});

test("verification rejects stale/forged fields and cannot reuse a turn operation identity", async (t) => {
  const f = await fixture(t), input = op(f.session);
  await claimTurn(f.client, f.secret, input, now + 1);
  await assert.rejects(verifyStoredSession(f.client, f.secret, { sessionId: input.sessionId, operationId: input.operationId, expectedTurn: 0 }, now + 2), code("V3_OPERATION_CONFLICT"));
  await endStoredSession(f.client, f.session.sessionId, f.secret, now + 3);
  await assert.rejects(verifyStoredSession(f.client, f.secret, { ...verification(f.session), expectedTurn: 1 }, now + 4), code("V3_STALE_TURN"));
  await assert.rejects(verifyStoredSession(f.client, f.secret, { ...verification(f.session), finding: "corroborated" } as never, now + 4), code("V3_INVALID_OPERATION"));
  const check = verification(f.session); await verifyStoredSession(f.client, f.secret, check, now + 4);
  await assert.rejects(claimTurn(f.client, f.secret, { ...input, operationId: check.operationId }, now + 5), code("V3_OPERATION_CONFLICT"));
});

test("expired calls cannot claim inference and clock/identity errors fail closed", async (t) => {
  const f = await fixture(t), input = op(f.session);
  const expired = await claimTurn(f.client, f.secret, input, f.session.expiresAt);
  assert.equal(expired.kind, "ended"); assert.equal(expired.session.ending, "expired");
  assert.equal((await f.client.execute("SELECT * FROM v3_turn_operations")).rows.length, 0);
  for (const value of [-1, NaN, Infinity, 1.5]) await assert.rejects(claimTurn(f.client, f.secret, input, value), code("V3_INVALID_OPERATION"));
  await assert.rejects(readStoredSession(f.client, "not-a-uuid", f.secret), code("V3_SESSION_NOT_FOUND"));
});

test("real SQL failure rolls back verification event and state without leaking SDK diagnostics", async (t) => {
  const f = await fixture(t);
  await f.client.execute("CREATE TRIGGER fail_v3_verification BEFORE INSERT ON v3_verification_events BEGIN SELECT RAISE(ABORT, 'private SQL diagnostic'); END");
  await assert.rejects(verifyStoredSession(f.client, f.secret, verification(f.session), now + 1), { code: "STORE_UNAVAILABLE", message: "STORE_UNAVAILABLE" });
  assert.equal((await readStoredSession(f.client, f.session.sessionId, f.secret)).verificationState, "unchecked");
  assert.equal((await f.client.execute("SELECT * FROM v3_verification_events")).rows.length, 0);
});

test("ownership, hidden assignment, committed replay and verification survive actual file reopen", async (t) => {
  const file = join(tmpdir(), `scamsuno-v3-persistence-${randomUUID()}.db`), url = pathToFileURL(file).href;
  // A subprocess releases Windows' native SQLite handles before fixture cleanup.
  t.after(() => { for (const suffix of ["", "-wal", "-shm"]) { try { unlinkSync(file + suffix); } catch (e) { if (!(e && typeof e === "object" && "code" in e && e.code === "ENOENT")) throw e; } } });
  const script = `
    import { createClient } from '@libsql/client';
    import { randomUUID } from 'node:crypto';
    import { initializeSessions, createStoredSession, readStoredSession, claimTurn, commitTurn, verifyStoredSession } from './src/server/v3/sessions.ts';
    import { advanceSession } from './src/server/v3/controller.ts';
    const now=${now},url=${JSON.stringify(url)};
    let client=createClient({url}); await initializeSessions(client);
    const created=await createStoredSession(client,'ta',now,()=>2);
    const input={sessionId:created.session.sessionId,operationId:randomUUID(),expectedTurn:0,reply:{origin:'typed',text:'Who are you?'}};
    await claimTurn(client,created.secret,input,now+1);
    await commitTurn(client,created.secret,input.operationId,advanceSession(created.session,input,null,now+2),now+3);
    const check={sessionId:created.session.sessionId,operationId:randomUUID(),expectedTurn:1};
    await verifyStoredSession(client,created.secret,check,now+4);
    client.close(); client=createClient({url}); await initializeSessions(client);
    const restored=await readStoredSession(client,created.session.sessionId,created.secret);
    const replay=await claimTurn(client,created.secret,input,now+5);
    const checked=await verifyStoredSession(client,created.secret,check,now+6);
    console.log(JSON.stringify({sameAssignment:restored.scenarioId===created.session.scenarioId,verification:restored.verificationState,replay:replay.kind,turn:checked.turn}));
    client.close();`;
  const result = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 20_000 }));
  assert.deepEqual(result, { sameAssignment: true, verification: "checked", replay: "replay", turn: 1 });
});
