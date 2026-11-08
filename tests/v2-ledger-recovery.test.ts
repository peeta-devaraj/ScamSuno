import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import {
  initializeLedger, LedgerError, markDispatched, reconcileUnknownUsage, reserveUsage, setPolicy, settleUsage,
  UNKNOWN_RECONCILIATION_COOLDOWN_MS, usageSummary,
  type UsageAttemptInput, type UsagePolicy, type UsageReconciliationInput,
} from "../src/server/v2/ledger";

// All records, snapshots and provider outcomes in this file are explicit fixtures.
const NOW = 1_800_000_000_000, DAY = 86_400_000;
const policy = (overrides: Partial<UsagePolicy> = {}): UsagePolicy => ({
  enabled: true, killSwitch: false, reconciledAt: NOW, expiresAt: NOW + DAY,
  verifiedCreditFloor: 4_000, reserveCredits: 1_000, maxGnaniRequests: 20, maxGnaniRequestsPerDay: 20,
  maxLLMRequests: 100, maxLLMRequestsPerDay: 100, maxRequestsPerSession: 40, maxConcurrent: 2,
  maxSTTSeconds: 20, maxTTSChars: 420, ...overrides,
});
function attempt(sessionId: string = randomUUID()): UsageAttemptInput {
  return { attemptId: randomUUID(), operationId: randomUUID(), sessionId,
    kind: "gnani_stt", model: "fixture-prisma", audioSeconds: 3 };
}
const errorCode = (expected: string) => (error: unknown) => error instanceof LedgerError && error.code === expected && error.message === expected;
async function fixture(t: TestContext, configured = true) {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeLedger(client);
  if (configured) await setPolicy(client, policy(), NOW);
  return client;
}
async function unknown(client: Client, input = attempt(), at = NOW) {
  await reserveUsage(client, input, at);
  await markDispatched(client, input.attemptId, at + 1);
  await settleUsage(client, input.attemptId, "unknown", { latencyMs: 100 }, at + 2);
  return input;
}
function snapshot(ids: string[], overrides: Partial<UsageReconciliationInput> = {}): UsageReconciliationInput {
  return { reconciliationId: randomUUID(), verifiedAt: NOW + UNKNOWN_RECONCILIATION_COOLDOWN_MS + 2,
    verifiedCreditFloor: 3_900, attemptIds: ids, providerReviewConfirmed: true, ...overrides };
}
const countRows = async (client: Client, table: string) => Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);

test("operator acknowledgement clears a concurrency hold without changing unknown outcome or refunding daily/session usage", async (t) => {
  const client = await fixture(t), input = await unknown(client);
  const before = await usageSummary(client, NOW + 2);
  assert.equal(before.counters.active, 1);
  const request = snapshot([input.attemptId]);
  const result = await reconcileUnknownUsage(client, request, request.verifiedAt);
  assert.equal(result.acknowledged, 1);
  assert.equal(result.alreadyApplied, false);
  assert.equal(result.policy.enabled, false);
  assert.equal(result.policy.killSwitch, true);
  assert.deepEqual([result.policy.maxGnaniRequests, result.policy.maxGnaniRequestsPerDay,
    result.policy.maxLLMRequests, result.policy.maxLLMRequestsPerDay], [0, 0, 0, 0]);
  const after = await usageSummary(client, request.verifiedAt);
  assert.equal(after.admissionOpen, false);
  assert.equal(after.counters.active, 0);
  assert.equal(after.counters.gnani.daily, 1);
  assert.equal(after.counters.gnani.totalSinceReconciliation, 0, "fresh operator floor accounts for the older liability");
  assert.equal(after.byStatus.unknown, 1);
  assert.equal(after.recent[0].status, "unknown");
  assert.equal(after.recent[0].actualCredits, null);
  assert.equal(after.recent[0].dispatchedAt, NOW + 1);
  assert.equal(after.recent[0].settledAt, NOW + 2);
  assert.equal(after.recent[0].acknowledgedAt, request.verifiedAt);
  assert.equal(after.recent[0].reconciliationId, request.reconciliationId);
  assert.equal(after.reconciliations[0].providerReviewConfirmed, true);
  const { acknowledgedAt: _ack, reconciliationId: _reconciliation, ...original } = after.recent[0];
  assert.deepEqual(original, before.recent[0], "the entire original provider record is untouched");
  await assert.rejects(reserveUsage(client, attempt(), request.verifiedAt), errorCode("V2_ADMISSION_CLOSED"));

  await setPolicy(client, { ...result.policy, enabled: true, killSwitch: false, maxGnaniRequests: 20,
    maxGnaniRequestsPerDay: 20, maxLLMRequests: 100, maxLLMRequestsPerDay: 100, maxRequestsPerSession: 1 }, request.verifiedAt);
  await assert.rejects(reserveUsage(client, attempt(input.sessionId), request.verifiedAt), errorCode("V2_QUOTA_EXCEEDED"));
  assert.equal((await reserveUsage(client, attempt(), request.verifiedAt)).admitted, true);
  assert.equal((await reserveUsage(client, input, request.verifiedAt)).admitted, false);
  assert.equal((await markDispatched(client, input.attemptId, request.verifiedAt)).dispatch, false);
  assert.equal((await usageSummary(client, request.verifiedAt)).counters.gnani.daily, 2);
});

test("LLM acknowledgement releases only its hold and preserves independent daily spending", async (t) => {
  const client = await fixture(t);
  const llm: UsageAttemptInput = { attemptId: randomUUID(), operationId: randomUUID(), sessionId: randomUUID(), kind: "caller", model: "fixture-llm" };
  await unknown(client, llm);
  const gnani = await unknown(client), request = snapshot([llm.attemptId]);
  const result = await reconcileUnknownUsage(client, request, request.verifiedAt);
  const summary = await usageSummary(client, request.verifiedAt);
  assert.deepEqual(summary.counters.llm, { daily: 1, totalSinceReconciliation: 0 });
  assert.deepEqual(summary.counters.gnani, { daily: 1, totalSinceReconciliation: 1 });
  assert.equal(summary.counters.active, 1);
  assert.equal(summary.recent.find((item) => item.attemptId === gnani.attemptId)?.acknowledgedAt, undefined);
  await setPolicy(client, { ...result.policy, enabled: true, killSwitch: false, maxLLMRequests: 100,
    maxLLMRequestsPerDay: 1, maxGnaniRequests: 20, maxGnaniRequestsPerDay: 20 }, request.verifiedAt);
  await assert.rejects(reserveUsage(client, { ...llm, attemptId: randomUUID(), operationId: randomUUID() }, request.verifiedAt), errorCode("V2_QUOTA_EXCEEDED"));
});

test("unacknowledged older unknowns and in-flight reservations continue holding allowance across a snapshot", async (t) => {
  const client = await fixture(t), first = await unknown(client), second = await unknown(client);
  const request = snapshot([first.attemptId]);
  await reconcileUnknownUsage(client, request, request.verifiedAt);
  const summary = await usageSummary(client, request.verifiedAt);
  assert.equal(summary.counters.active, 1);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 1);
  assert.equal(summary.counters.gnani.daily, 2);
  assert.equal(summary.recent.find((a) => a.attemptId === second.attemptId)?.acknowledgedAt, undefined);
  await setPolicy(client, { ...summary.policy!, enabled: true, killSwitch: false, maxGnaniRequests: 20,
    maxGnaniRequestsPerDay: 20, maxConcurrent: 2 }, request.verifiedAt);
  const held = attempt(); await reserveUsage(client, held, request.verifiedAt);
  await setPolicy(client, { ...summary.policy!, reconciledAt: request.verifiedAt + 1,
    expiresAt: request.verifiedAt + DAY + 1 }, request.verifiedAt + 1);
  const later = await usageSummary(client, request.verifiedAt + 1);
  assert.equal(later.counters.active, 2);
  assert.equal(later.counters.gnani.totalSinceReconciliation, 2);
});

test("exact reconciliation replay is idempotent and cannot overwrite a later reopened policy", async (t) => {
  const client = await fixture(t), a = await unknown(client), b = await unknown(client);
  const request = snapshot([a.attemptId, b.attemptId]);
  const first = await reconcileUnknownUsage(client, request, request.verifiedAt);
  const historyCount = await countRows(client, "v2_usage_policy_history");
  await setPolicy(client, { ...first.policy, enabled: true, killSwitch: false,
    reconciledAt: request.verifiedAt + 1, expiresAt: request.verifiedAt + DAY + 1,
    maxGnaniRequests: 10, maxGnaniRequestsPerDay: 10 }, request.verifiedAt + 1);
  const replay = await reconcileUnknownUsage(client, { ...request, attemptIds: [b.attemptId.toUpperCase(), a.attemptId] }, request.verifiedAt + DAY + 2);
  assert.equal(replay.alreadyApplied, true);
  assert.deepEqual(replay.policy, first.policy, "replay returns the original action snapshot");
  assert.equal(await countRows(client, "v2_usage_reconciliations"), 1);
  assert.equal(await countRows(client, "v2_usage_unknown_acknowledgements"), 2);
  assert.equal(await countRows(client, "v2_usage_policy_history"), historyCount + 1);
  assert.equal((await usageSummary(client, request.verifiedAt + 2)).policy?.enabled, true);
  await assert.rejects(reconcileUnknownUsage(client, { ...request, verifiedCreditFloor: 3_899 }, request.verifiedAt + 2), errorCode("V2_RECONCILIATION_CONFLICT"));
  await assert.rejects(reconcileUnknownUsage(client, { ...request, reconciliationId: randomUUID(), verifiedAt: request.verifiedAt + 1 }, request.verifiedAt + 2), errorCode("V2_RECONCILIATION_CONFLICT"));
});

test("a low or zero verified floor is recorded only in a disabled killed policy", async (t) => {
  const client = await fixture(t), input = await unknown(client), request = snapshot([input.attemptId], { verifiedCreditFloor: 0 });
  const result = await reconcileUnknownUsage(client, request, request.verifiedAt);
  assert.equal(result.policy.verifiedCreditFloor, 0);
  assert.equal(result.policy.reserveCredits, 1_000);
  assert.equal((await usageSummary(client, request.verifiedAt)).admissionOpen, false);
  await assert.rejects(setPolicy(client, { ...result.policy, enabled: true, killSwitch: false }, request.verifiedAt), errorCode("V2_INVALID_POLICY"));
  await assert.rejects(setPolicy(client, { ...result.policy, killSwitch: false }, request.verifiedAt), errorCode("V2_INVALID_POLICY"));
  await setPolicy(client, { ...result.policy, verifiedCreditFloor: 999 }, request.verifiedAt);
  assert.equal((await usageSummary(client, request.verifiedAt)).policy?.verifiedCreditFloor, 999);
});

test("strict reconciliation input requires explicit provider review and rejects content or ambiguous identities", async (t) => {
  const client = await fixture(t), input = await unknown(client), valid = snapshot([input.attemptId]);
  for (const invalid of [
    { ...valid, providerReviewConfirmed: false }, { ...valid, note: "private fixture text must not be retained" },
    { ...valid, attemptIds: [] }, { ...valid, attemptIds: [input.attemptId, input.attemptId.toUpperCase()] },
    { ...valid, attemptIds: Array.from({ length: 51 }, () => randomUUID()) }, { ...valid, reconciliationId: "invalid" },
    { ...valid, verifiedCreditFloor: -1 }, { ...valid, verifiedCreditFloor: 1.5 },
    { ...valid, verifiedCreditFloor: Number.NaN }, { ...valid, verifiedCreditFloor: 1_000_000_001 },
  ]) await assert.rejects(reconcileUnknownUsage(client, invalid as UsageReconciliationInput, valid.verifiedAt), errorCode("V2_INVALID_RECONCILIATION"));
  assert.equal(await countRows(client, "v2_usage_reconciliations"), 0);
  assert.equal((await usageSummary(client, valid.verifiedAt)).counters.active, 1);
});

test("verification timestamps must be current and monotonic and cooldown uses the latest uncertainty time", async (t) => {
  const client = await fixture(t), input = await unknown(client), valid = snapshot([input.attemptId]);
  await assert.rejects(reconcileUnknownUsage(client, valid, valid.verifiedAt - 1), errorCode("V2_INVALID_RECONCILIATION"));
  await assert.rejects(reconcileUnknownUsage(client, valid, valid.verifiedAt + DAY), errorCode("V2_INVALID_RECONCILIATION"));
  await assert.rejects(reconcileUnknownUsage(client, { ...valid, verifiedAt: NOW - 1 }, valid.verifiedAt), errorCode("V2_INVALID_RECONCILIATION"));
  await assert.rejects(reconcileUnknownUsage(client, { ...valid, verifiedAt: NOW + UNKNOWN_RECONCILIATION_COOLDOWN_MS + 1 }, valid.verifiedAt), errorCode("V2_RECONCILIATION_NOT_READY"));
  await assert.rejects(reconcileUnknownUsage(client, valid, Number.NaN), errorCode("V2_INVALID_TIME"));
  assert.equal((await reconcileUnknownUsage(client, valid, valid.verifiedAt)).alreadyApplied, false);
});

test("reserved, dispatched and known terminal outcomes cannot be acknowledged as uncertain charges", async (t) => {
  for (const status of ["reserved", "dispatched", "succeeded", "failed", "released"] as const) {
    const client = await fixture(t), input = attempt();
    await reserveUsage(client, input, NOW);
    if (status !== "reserved" && status !== "released") await markDispatched(client, input.attemptId, NOW + 1);
    if (status === "succeeded" || status === "failed" || status === "released") await settleUsage(client, input.attemptId, status, {}, NOW + 2);
    const request = snapshot([input.attemptId]);
    await assert.rejects(reconcileUnknownUsage(client, request, request.verifiedAt), errorCode("V2_INVALID_RECONCILIATION"));
    assert.equal(await countRows(client, "v2_usage_unknown_acknowledgements"), 0);
  }
});

test("missing policy or a mixed invalid attempt list cannot partially apply an acknowledgement", async (t) => {
  const empty = await fixture(t, false), blank = snapshot([randomUUID()]);
  await assert.rejects(reconcileUnknownUsage(empty, blank, blank.verifiedAt), errorCode("V2_INVALID_RECONCILIATION"));
  const client = await fixture(t), input = await unknown(client), request = snapshot([input.attemptId, randomUUID()]);
  const before = await usageSummary(client, request.verifiedAt);
  await assert.rejects(reconcileUnknownUsage(client, request, request.verifiedAt), errorCode("V2_INVALID_RECONCILIATION"));
  assert.deepEqual((await usageSummary(client, request.verifiedAt)).policy, before.policy);
  assert.equal(await countRows(client, "v2_usage_reconciliations"), 0);
  assert.equal(await countRows(client, "v2_usage_unknown_acknowledgements"), 0);
});

test("an actual SQL failure rolls back the audit and policy without exposing diagnostics", async (t) => {
  const client = await fixture(t), input = await unknown(client), request = snapshot([input.attemptId]);
  const before = await usageSummary(client, request.verifiedAt), history = await countRows(client, "v2_usage_policy_history");
  await client.execute(`CREATE TRIGGER fixture_reject_ack BEFORE INSERT ON v2_usage_unknown_acknowledgements
    BEGIN SELECT RAISE(ABORT,'private fixture database diagnostic'); END`);
  await assert.rejects(reconcileUnknownUsage(client, request, request.verifiedAt), (error: unknown) => {
    assert.ok(error instanceof LedgerError); assert.equal(error.code, "V2_STORE_UNAVAILABLE");
    assert.equal(error.message, "V2_STORE_UNAVAILABLE"); assert.equal(error.cause, undefined); return true;
  });
  assert.equal(await countRows(client, "v2_usage_reconciliations"), 0);
  assert.equal(await countRows(client, "v2_usage_unknown_acknowledgements"), 0);
  assert.equal(await countRows(client, "v2_usage_policy_history"), history);
  assert.deepEqual((await usageSummary(client, request.verifiedAt)).policy, before.policy);
  assert.equal((await usageSummary(client, request.verifiedAt)).counters.active, 1);
});

test("additive initialization preserves acknowledgement audits and unrelated V1 fixture data", async (t) => {
  const client = await fixture(t), input = await unknown(client), request = snapshot([input.attemptId]);
  await client.execute("CREATE TABLE v1_recovery_fixture (value TEXT)");
  await client.execute("INSERT INTO v1_recovery_fixture VALUES ('unchanged')");
  await reconcileUnknownUsage(client, request, request.verifiedAt);
  await initializeLedger(client);
  assert.equal(await countRows(client, "v2_usage_reconciliations"), 1);
  assert.equal((await client.execute("SELECT value FROM v1_recovery_fixture")).rows[0].value, "unchanged");
  assert.equal((await usageSummary(client, request.verifiedAt)).recent[0].actualCredits, null);
});
