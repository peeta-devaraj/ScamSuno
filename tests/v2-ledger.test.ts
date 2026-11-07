import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { databaseWrite } from "../src/server/v2/database";
import {
  initializeLedger, LedgerError, markDispatched, reserveUsage, setPolicy, settleUsage, usageSummary,
  type UsageAttemptInput, type UsageKind, type UsagePolicy,
} from "../src/server/v2/ledger";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const policy = (changes: Partial<UsagePolicy> = {}): UsagePolicy => ({
  enabled: true, killSwitch: false, reconciledAt: NOW, expiresAt: NOW + DAY,
  verifiedCreditFloor: 4_000, reserveCredits: 1_000,
  maxGnaniRequests: 20, maxGnaniRequestsPerDay: 20, maxLLMRequests: 20, maxLLMRequestsPerDay: 20,
  maxRequestsPerSession: 40, maxConcurrent: 2, maxSTTSeconds: 20, maxTTSChars: 420, ...changes,
});
function input(kind: UsageKind = "gnani_stt", sessionId = randomUUID()): UsageAttemptInput {
  const identity = { sessionId, operationId: randomUUID(), attemptId: randomUUID(), model: "test-model" };
  if (kind === "gnani_stt") return { ...identity, kind, audioSeconds: 5 };
  if (kind === "gnani_tts") return { ...identity, kind, textChars: 120 };
  return { ...identity, kind };
}
const code = (expected: string) => (error: unknown) => error instanceof LedgerError && error.message === expected && error.code === expected;

async function fixture(t: TestContext, persistent = false) {
  const prefix = resolve(join(tmpdir(), "scamsuno-v2-ledger-"));
  const directory = persistent ? await mkdtemp(prefix) : null;
  const url = directory ? pathToFileURL(join(directory, "usage.sqlite")).href : "file::memory:";
  const clients: Client[] = [];
  const open = () => { const client = createClient({ url }); clients.push(client); return client; };
  const client = open();
  await initializeLedger(client);
  t.after(async () => {
    for (const connection of clients) if (!connection.closed) connection.close();
    if (!directory) return;
    const target = resolve(directory);
    if (!target.startsWith(prefix) || target === prefix) throw new Error("Unsafe ledger test cleanup target");
    await rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  return { client, open };
}

async function completed(client: Client, attempt: UsageAttemptInput, now = NOW) {
  await reserveUsage(client, attempt, now);
  assert.equal((await markDispatched(client, attempt.attemptId, now)).dispatch, true);
  await settleUsage(client, attempt.attemptId, "succeeded", { latencyMs: 50 }, now + 1);
}

test("real SQLite initialization is additive, idempotent and closed without reconciliation", async (t) => {
  const { client } = await fixture(t);
  await client.execute("CREATE TABLE existing_v1_fixture (value TEXT)");
  await client.execute("INSERT INTO existing_v1_fixture VALUES ('untouched')");
  await initializeLedger(client);
  assert.equal((await client.execute("SELECT value FROM existing_v1_fixture")).rows[0].value, "untouched");
  assert.equal((await usageSummary(client, NOW)).admissionOpen, false);
  await assert.rejects(reserveUsage(client, input(), NOW), code("V2_ADMISSION_CLOSED"));
  const columns = await client.execute("PRAGMA table_info(v2_usage_attempts)");
  assert.equal(columns.rows.some((row) => /transcript|audio_blob|prompt|token|credential/i.test(String(row.name))), false);
});

test("policy rejects reserve boundary, stale/future reconciliation, oversized quotas and cost fields", async (t) => {
  const { client } = await fixture(t);
  for (const invalid of [policy({ verifiedCreditFloor: 1_000 }), policy({ reserveCredits: 999 }),
    policy({ reconciledAt: NOW + 1 }), policy({ expiresAt: NOW }), policy({ expiresAt: NOW + DAY + 1 }),
    policy({ maxGnaniRequests: 21 }), policy({ maxConcurrent: 3 }), policy({ maxSTTSeconds: 21 }),
    policy({ maxTTSChars: 421 }), policy({ maxLLMRequests: 1, maxLLMRequestsPerDay: 2 }),
    { ...policy(), actualCredits: 10 } as UsagePolicy]) {
    await assert.rejects(setPolicy(client, invalid, NOW), code("V2_INVALID_POLICY"));
  }
  await setPolicy(client, policy({ verifiedCreditFloor: 1_001 }), NOW);
  await assert.rejects(setPolicy(client, policy({ reconciledAt: NOW - 1 }), NOW), code("V2_INVALID_POLICY"));
  assert.equal((await usageSummary(client, NOW)).policy?.verifiedCreditFloor, 1_001);
  assert.equal((await usageSummary(client, NOW)).actualCredits, null);
});

test("policy expiry, explicit closure and kill switch deny reservations and late dispatch", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ enabled: false }), NOW);
  await assert.rejects(reserveUsage(client, input(), NOW), code("V2_ADMISSION_CLOSED"));
  await setPolicy(client, policy({ expiresAt: NOW + 100 }), NOW);
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  assert.equal((await markDispatched(client, attempt.attemptId, NOW + 100)).dispatch, false);
  await assert.rejects(reserveUsage(client, input(), NOW + 100), code("V2_ADMISSION_CLOSED"));
  await setPolicy(client, policy({ killSwitch: true }), NOW + 101);
  assert.equal((await markDispatched(client, attempt.attemptId, NOW + 101)).reason, "V2_ADMISSION_CLOSED");
  await assert.rejects(reserveUsage(client, input(), NOW + 101), code("V2_ADMISSION_CLOSED"));
  assert.equal((await settleUsage(client, attempt.attemptId, "released", {}, NOW + 101)).attempt.status, "released");
});

test("strict attempt inputs reject content, secrets, invalid identities and request bounds", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  const base = input();
  for (const invalid of [{ ...base, transcript: "private fixture text" }, { ...base, audio: "not permitted" },
    { ...base, token: "not permitted" }, { ...base, actualCredits: 1 }, { ...base, attemptId: "invalid" },
    { ...base, audioSeconds: 20.01 }, { ...base, audioSeconds: 0 }, { ...input("gnani_tts"), textChars: 421 },
    { ...input("caller"), textChars: 50 }, { ...base, model: "invalid model\n" }]) {
    await assert.rejects(reserveUsage(client, invalid as UsageAttemptInput, NOW), code("V2_INVALID_ATTEMPT"));
  }
  assert.equal((await usageSummary(client, NOW)).recent.length, 0);
  await assert.rejects(reserveUsage(client, base, Number.NaN), code("V2_INVALID_TIME"));
});

test("same-client parallel reservations atomically enforce concurrency", async (t) => {
  const { client } = await fixture(t, true);
  await setPolicy(client, policy(), NOW);
  const outcomes = await Promise.allSettled(Array.from({ length: 12 }, () => reserveUsage(client, input(), NOW)));
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 2);
  for (const result of outcomes) if (result.status === "rejected") assert.ok(code("V2_QUOTA_EXCEEDED")(result.reason));
  const summary = await usageSummary(client, NOW);
  assert.equal(summary.counters.active, 2);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 2);
});

test("separate real SQLite clients never overspend under parallel contention", async (t) => {
  const { client, open } = await fixture(t, true);
  await setPolicy(client, policy({ maxConcurrent: 1 }), NOW);
  const clients = [client, open(), open()];
  for (const connection of clients) await connection.execute("PRAGMA busy_timeout = 0");
  const outcomes = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => reserveUsage(clients[i % clients.length], input(), NOW)));
  const admitted = outcomes.filter((result) => result.status === "fulfilled" && result.value.admitted);
  assert.equal(admitted.length, 1);
  for (const result of outcomes) if (result.status === "rejected") {
    assert.ok(code("V2_QUOTA_EXCEEDED")(result.reason) || code("V2_STORE_UNAVAILABLE")(result.reason));
  }
  assert.equal((await usageSummary(client, NOW)).counters.active, 1);
  assert.equal((await usageSummary(client, NOW)).recent.length, 1);
  const attemptId = (await usageSummary(client, NOW)).recent[0].attemptId;
  const dispatches = await Promise.allSettled(clients.map((connection) => markDispatched(connection, attemptId, NOW)));
  assert.equal(dispatches.filter((result) => result.status === "fulfilled" && result.value.dispatch).length, 1);
  for (const result of dispatches) if (result.status === "rejected") assert.ok(code("V2_STORE_UNAVAILABLE")(result.reason));
  assert.equal((await usageSummary(client, NOW)).byStatus.dispatched, 1);
});

test("immutable attempt and operation identities prevent duplicate reservations and dispatch", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  const attempt = input();
  const results = await Promise.all([reserveUsage(client, attempt, NOW), reserveUsage(client, attempt, NOW)]);
  assert.deepEqual(results.map((result) => result.admitted), [true, false]);
  const alternative = { ...attempt, attemptId: randomUUID() };
  const duplicate = await reserveUsage(client, alternative, NOW);
  assert.equal(duplicate.admitted, false);
  assert.equal(duplicate.attempt.attemptId, attempt.attemptId);
  await assert.rejects(reserveUsage(client, { ...attempt, model: "other-model" }, NOW), code("V2_IDENTITY_CONFLICT"));
  await assert.rejects(reserveUsage(client, { ...attempt, operationId: randomUUID() }, NOW), code("V2_IDENTITY_CONFLICT"));
  const dispatches = await Promise.all([markDispatched(client, attempt.attemptId, NOW), markDispatched(client, attempt.attemptId, NOW)]);
  assert.deepEqual(dispatches.map((result) => result.dispatch), [true, false]);
  assert.equal((await usageSummary(client, NOW)).recent.length, 1);
});

test("known undispatched cancellation restores quota exactly once and cannot resurrect the operation", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1 }), NOW);
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  await assert.rejects(reserveUsage(client, input(), NOW), code("V2_QUOTA_EXCEEDED"));
  assert.equal((await settleUsage(client, attempt.attemptId, "released", {}, NOW)).changed, true);
  assert.equal((await settleUsage(client, attempt.attemptId, "released", {}, NOW)).changed, false);
  assert.equal((await markDispatched(client, attempt.attemptId, NOW)).dispatch, false);
  assert.equal((await reserveUsage(client, attempt, NOW)).admitted, false);
  assert.equal((await usageSummary(client, NOW)).counters.gnani.totalSinceReconciliation, 0);
  assert.equal((await reserveUsage(client, input(), NOW)).admitted, true);
});

test("dispatched failures consume quota and cancellation cannot refund them", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1 }), NOW);
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  await markDispatched(client, attempt.attemptId, NOW);
  await assert.rejects(settleUsage(client, attempt.attemptId, "released", {}, NOW), code("V2_INVALID_TRANSITION"));
  const settled = await settleUsage(client, attempt.attemptId, "failed", { latencyMs: 80, providerRequestId: "request-fixture", statusCode: 503 }, NOW + 1);
  assert.equal(settled.attempt.status, "failed");
  assert.equal(settled.attempt.actualCredits, null);
  assert.equal((await settleUsage(client, attempt.attemptId, "failed", { latencyMs: 900 }, NOW + 2)).changed, false);
  const summary = await usageSummary(client, NOW + 2);
  assert.equal(summary.counters.active, 0);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 1);
  assert.equal(summary.recent[0].latencyMs, 80);
  assert.equal(summary.recent[0].providerRequestId, "request-fixture");
  assert.equal(summary.recent[0].statusCode, 503);
  await assert.rejects(reserveUsage(client, input(), NOW + 2), code("V2_QUOTA_EXCEEDED"));
});

test("timeouts and disputed terminal outcomes remain unknown without automatic release", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxConcurrent: 1 }), NOW);
  const attempt = input();
  await completed(client, attempt);
  assert.equal((await settleUsage(client, attempt.attemptId, "failed", {}, NOW + 2)).attempt.status, "unknown");
  assert.equal((await settleUsage(client, attempt.attemptId, "succeeded", {}, NOW + 3)).attempt.status, "unknown");
  await assert.rejects(settleUsage(client, attempt.attemptId, "released", {}, NOW + 3), code("V2_INVALID_TRANSITION"));
  await assert.rejects(reserveUsage(client, input(), NOW + 3), code("V2_QUOTA_EXCEEDED"));
  assert.equal((await usageSummary(client, NOW + 3)).counters.active, 1);
});

test("outcomes without a recorded dispatch are quarantined rather than refunded", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  const attempt = input("caller");
  await reserveUsage(client, attempt, NOW);
  assert.equal((await settleUsage(client, attempt.attemptId, "failed", {}, NOW)).attempt.status, "unknown");
  assert.equal((await markDispatched(client, attempt.attemptId, NOW)).dispatch, false);
  assert.equal((await usageSummary(client, NOW)).counters.llm.totalSinceReconciliation, 1);
});

test("Gnani and LLM ceilings remain separate while session limits span all paid stages", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1,
    maxLLMRequests: 1, maxLLMRequestsPerDay: 1, maxRequestsPerSession: 1 }), NOW);
  const sessionId = randomUUID();
  await completed(client, input("gnani_stt", sessionId));
  await assert.rejects(reserveUsage(client, input("gnani_tts"), NOW + 2), code("V2_QUOTA_EXCEEDED"));
  await assert.rejects(reserveUsage(client, input("caller", sessionId), NOW + 2), code("V2_QUOTA_EXCEEDED"));
  await completed(client, input("evaluator"), NOW + 2);
  await assert.rejects(reserveUsage(client, input("caller"), NOW + 4), code("V2_QUOTA_EXCEEDED"));
  const summary = await usageSummary(client, NOW + 4);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 1);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 1);
});

test("daily limits reset at UTC midnight but total-since-reconciliation allowance does not", async (t) => {
  const { client } = await fixture(t);
  const midnight = Math.ceil(NOW / DAY) * DAY;
  const before = midnight - 100;
  await setPolicy(client, policy({ reconciledAt: before, expiresAt: before + DAY,
    maxGnaniRequests: 2, maxGnaniRequestsPerDay: 1 }), before);
  await completed(client, input(), before);
  await assert.rejects(reserveUsage(client, input(), before + 2), code("V2_QUOTA_EXCEEDED"));
  await completed(client, input(), midnight);
  const summary = await usageSummary(client, midnight + 2);
  assert.deepEqual(summary.counters.gnani, { totalSinceReconciliation: 2, daily: 1 });
  await assert.rejects(reserveUsage(client, input(), midnight + 2), code("V2_QUOTA_EXCEEDED"));
});

test("reconciliation and policy changes cannot erase unresolved reservations or timeout holds", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  const pending = input();
  const uncertain = input("caller");
  await reserveUsage(client, pending, NOW);
  await reserveUsage(client, uncertain, NOW);
  await markDispatched(client, uncertain.attemptId, NOW);
  await settleUsage(client, uncertain.attemptId, "unknown", {}, NOW + 1);
  const next = policy({ reconciledAt: NOW + 10, expiresAt: NOW + DAY,
    maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1, maxLLMRequests: 1, maxLLMRequestsPerDay: 1 });
  await setPolicy(client, next, NOW + 10);
  const summary = await usageSummary(client, NOW + 10);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 1);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 1);
  assert.equal(summary.counters.active, 2);
  await assert.rejects(reserveUsage(client, input(), NOW + 10), code("V2_QUOTA_EXCEEDED"));
  await assert.rejects(reserveUsage(client, input("caller"), NOW + 10), code("V2_QUOTA_EXCEEDED"));
  await assert.rejects(settleUsage(client, uncertain.attemptId, "released", {}, NOW + 10), code("V2_INVALID_TRANSITION"));
});

test("same reconciliation timestamp does not reset settled consumption and reduced limits gate dispatch", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1 }), NOW);
  await completed(client, input());
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1 }), NOW + 2);
  await assert.rejects(reserveUsage(client, input(), NOW + 2), code("V2_QUOTA_EXCEEDED"));
  const caller = input("caller");
  await reserveUsage(client, caller, NOW + 2);
  await setPolicy(client, policy({ maxLLMRequests: 0, maxLLMRequestsPerDay: 0 }), NOW + 3);
  assert.equal((await markDispatched(client, caller.attemptId, NOW + 3)).reason, "V2_QUOTA_EXCEEDED");
});

test("ledger state and idempotency survive closing and reopening the real database file", async (t) => {
  const { client, open } = await fixture(t, true);
  await setPolicy(client, policy(), NOW);
  const attempt = input("gnani_tts");
  await reserveUsage(client, attempt, NOW);
  await markDispatched(client, attempt.attemptId, NOW);
  client.close();
  const restarted = open();
  await initializeLedger(restarted);
  assert.equal((await reserveUsage(restarted, attempt, NOW + 1)).admitted, false);
  assert.equal((await markDispatched(restarted, attempt.attemptId, NOW + 1)).dispatch, false);
  const summary = await usageSummary(restarted, NOW + 1);
  assert.equal(summary.policy?.verifiedCreditFloor, 4_000);
  assert.equal(summary.byStatus.dispatched, 1);
  assert.equal(summary.recent[0].textChars, 120);
});

test("write transaction rollback preserves prior allowance and attempt state", async (t) => {
  const { client } = await fixture(t, true);
  await setPolicy(client, policy(), NOW);
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  await assert.rejects(databaseWrite(client, async (tx) => {
    await tx.execute({ sql: "UPDATE v2_usage_attempts SET status='released' WHERE attempt_id=?", args: [attempt.attemptId] });
    throw new Error("V2_TEST_ROLLBACK");
  }), /^Error: V2_TEST_ROLLBACK$/);
  const summary = await usageSummary(client, NOW);
  assert.equal(summary.recent[0].status, "reserved");
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 1);
  assert.equal((await markDispatched(client, attempt.attemptId, NOW)).dispatch, true);
});

test("unknown IDs, timing errors and real SDK failures return code-only errors", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  await assert.rejects(markDispatched(client, randomUUID(), NOW), code("V2_ATTEMPT_NOT_FOUND"));
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  await assert.rejects(markDispatched(client, attempt.attemptId, NOW - 1), code("V2_INVALID_TIME"));
  await assert.rejects(settleUsage(client, attempt.attemptId, "released", { latencyMs: -1 }, NOW), code("V2_INVALID_SETTLEMENT"));
  client.close();
  await assert.rejects(usageSummary(client, NOW), code("V2_STORE_UNAVAILABLE"));
});

test("dispatch guard shares the transaction boundary with a competing End update", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  await client.execute("CREATE TABLE v2_guard_fixture (active INTEGER NOT NULL, checks INTEGER NOT NULL)");
  await client.execute("INSERT INTO v2_guard_fixture VALUES (1,0)");
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  let checks = 0;
  const dispatch = markDispatched(client, attempt.attemptId, NOW, async (tx, checkedAt) => {
    checks++;
    assert.equal(checkedAt, NOW);
    assert.equal(tx.closed, false);
    await tx.execute("UPDATE v2_guard_fixture SET checks=checks+1 WHERE active=1");
    await Promise.resolve();
    const row = (await tx.execute("SELECT active,checks FROM v2_guard_fixture")).rows[0];
    assert.equal(row.checks, 1);
    return row.active === 1;
  });
  const end = databaseWrite(client, async (tx) => {
    await tx.execute("UPDATE v2_guard_fixture SET active=0");
  });
  assert.equal((await dispatch).dispatch, true, "dispatch claim that precedes End may commit");
  await end;
  assert.equal(checks, 1);
  assert.equal((await client.execute("SELECT active FROM v2_guard_fixture")).rows[0].active, 0);
  const duplicate = await markDispatched(client, attempt.attemptId, NOW, async () => { checks++; return true; });
  assert.equal(duplicate.dispatch, false);
  assert.equal(checks, 1, "a replay must not run the guard or redispatch");
});

test("dispatch guard refuses a lease ended first and holds allowance until known cancellation", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy({ maxGnaniRequests: 1, maxGnaniRequestsPerDay: 1 }), NOW);
  await client.execute("CREATE TABLE v2_guard_fixture (active INTEGER NOT NULL, checks INTEGER NOT NULL)");
  await client.execute("INSERT INTO v2_guard_fixture VALUES (1,0)");
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  const end = databaseWrite(client, async (tx) => { await tx.execute("UPDATE v2_guard_fixture SET active=0"); });
  const dispatch = markDispatched(client, attempt.attemptId, NOW, async (tx) => {
    await tx.execute("UPDATE v2_guard_fixture SET checks=checks+1");
    return (await tx.execute("SELECT active FROM v2_guard_fixture")).rows[0].active === 1;
  });
  await end;
  const refused = await dispatch;
  assert.equal(refused.dispatch, false);
  assert.equal(refused.reason, "V2_SESSION_INACTIVE");
  assert.equal(refused.attempt.status, "reserved");
  const beforeRelease = await usageSummary(client, NOW);
  assert.equal(beforeRelease.counters.active, 1);
  assert.equal(beforeRelease.counters.gnani.totalSinceReconciliation, 1);
  await assert.rejects(reserveUsage(client, input(), NOW), code("V2_QUOTA_EXCEEDED"));
  await settleUsage(client, attempt.attemptId, "released", {}, NOW);
  assert.equal((await usageSummary(client, NOW)).counters.gnani.totalSinceReconciliation, 0);
  assert.equal((await reserveUsage(client, input(), NOW)).admitted, true);
});

test("dispatch guard errors roll back guard writes and return no SDK or private diagnostics", async (t) => {
  const { client } = await fixture(t);
  await setPolicy(client, policy(), NOW);
  await client.execute("CREATE TABLE v2_guard_fixture (checks INTEGER NOT NULL)");
  await client.execute("INSERT INTO v2_guard_fixture VALUES (0)");
  const attempt = input();
  await reserveUsage(client, attempt, NOW);
  await assert.rejects(markDispatched(client, attempt.attemptId, NOW, async (tx) => {
    await tx.execute("UPDATE v2_guard_fixture SET checks=checks+1");
    throw new Error("private fixture diagnostic that must never escape");
  }), code("V2_STORE_UNAVAILABLE"));
  assert.equal((await client.execute("SELECT checks FROM v2_guard_fixture")).rows[0].checks, 0);
  const summary = await usageSummary(client, NOW);
  assert.equal(summary.recent[0].status, "reserved");
  assert.equal(summary.counters.active, 1);
  await settleUsage(client, attempt.attemptId, "released", {}, NOW);
  assert.equal((await usageSummary(client, NOW)).counters.active, 0);
});

test("queued dispatch checks policy expiry using the clock after acquiring its transaction", async (t) => {
  const { client } = await fixture(t);
  const now = Date.now();
  const expiresAt = now + 300;
  await setPolicy(client, policy({ reconciledAt: now, expiresAt }), now);
  const attempt = input();
  await reserveUsage(client, attempt);
  let unlock!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => { unlock = resolve; });
  const locked = new Promise<void>((resolve) => { entered = resolve; });
  const holding = databaseWrite(client, async () => { entered(); await gate; });
  await locked;
  try {
    assert.ok(Date.now() < expiresAt, "dispatch must enter the queue while the policy is still valid");
    const pending = markDispatched(client, attempt.attemptId);
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, expiresAt - Date.now() + 15)));
    unlock();
    await holding;
    const result = await pending;
    assert.equal(result.dispatch, false);
    assert.equal(result.reason, "V2_ADMISSION_CLOSED");
    assert.equal(result.attempt.status, "reserved");
    assert.equal(result.attempt.dispatchedAt, null);
    await settleUsage(client, attempt.attemptId, "released");
    assert.equal((await usageSummary(client, Date.now())).counters.active, 0);
  } finally {
    unlock();
    await holding;
  }
});
