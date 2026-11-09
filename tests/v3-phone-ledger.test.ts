import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { copyClosedPhoneLedger, planPhonePolicy } from "../scripts/v3-phone-ledger";
import { initializeLedger, reserveUsage, setPolicy, settleUsage, usageSummary } from "../src/server/v2/ledger";
import { databaseFromEnvironment } from "../src/server/v2/database";

const now = Date.UTC(2026, 10, 9, 6);
const oldPolicy = {
  enabled: true, killSwitch: false, reconciledAt: now - 60_000, expiresAt: now - 20_000,
  verifiedCreditFloor: 4500, reserveCredits: 2000,
  maxGnaniRequests: 6, maxGnaniRequestsPerDay: 6, maxLLMRequests: 4, maxLLMRequestsPerDay: 4,
  maxRequestsPerSession: 5, maxConcurrent: 1, maxSTTSeconds: 15, maxTTSChars: 420,
};
const evidence = { verifiedAt: now, exactRemainingCredits: 4400.19, otherKnownSpeechAttemptsToday: 0 };

test("the phone profile requires a separate credential and host in a protected Preview environment", t => {
  const settings = {
    VERCEL: "1", VERCEL_ENV: "preview", V3_TRUST_OR_TRAP_ENABLED: "true", V3_PHONE_LEDGER_ENABLED: "true",
    V2_DATABASE_URL: "libsql://old-fixture.invalid", V2_DATABASE_AUTH_TOKEN: "old-fixture",
    V3_PHONE_TURSO_DATABASE_URL: "libsql://phone-fixture.invalid", V3_PHONE_TURSO_AUTH_TOKEN: "phone-fixture",
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, settings);
  databaseFromEnvironment().close();
  for (const [key, invalid] of [
    ["VERCEL_ENV", "production"],
    ["V3_PHONE_TURSO_DATABASE_URL", "https://old-fixture.invalid"],
    ["V3_PHONE_TURSO_AUTH_TOKEN", "old-fixture"],
    ["V3_PHONE_TURSO_AUTH_TOKEN", ""],
  ] as const) {
    process.env[key] = invalid;
    assert.throws(databaseFromEnvironment, { code: "INVALID_STORE_CONFIG" });
    process.env[key] = settings[key];
  }
  delete process.env.V3_PHONE_TURSO_DATABASE_URL;
  assert.throws(databaseFromEnvironment, { code: "STORE_NOT_CONFIGURED" });
});

test("isolated copy preserves the expired original policy, billing rows and unknown holds", async t => {
  const source = createClient({ url: "file::memory:" }), target = createClient({ url: "file::memory:" });
  t.after(() => { source.close(); target.close(); });
  await initializeLedger(source);
  const then = now - 40_000;
  await setPolicy(source, oldPolicy, then);
  const attemptId = crypto.randomUUID();
  await reserveUsage(source, { attemptId, operationId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    kind: "gnani_stt", model: "prisma-v3.0", audioSeconds: 1 }, then);
  await settleUsage(source, attemptId, "unknown", {}, then + 1);
  const before = await usageSummary(source, now);
  await copyClosedPhoneLedger(source, target, now);
  const copied = await usageSummary(target, now);
  assert.deepEqual(copied, before);
  assert.deepEqual(await usageSummary(source, now), before);
  assert.throws(() => planPhonePolicy(copied, evidence, now), /PHONE_ACTIVE_OR_UNKNOWN_ATTEMPTS/);
  await assert.rejects(copyClosedPhoneLedger(source, target, now));
  assert.deepEqual(await usageSummary(target, now), copied);
});

test("reconciled isolated plan caps one exchange per session and leaves the original closed", async t => {
  const source = createClient({ url: "file::memory:" }), target = createClient({ url: "file::memory:" });
  t.after(() => { source.close(); target.close(); });
  await initializeLedger(source);
  await setPolicy(source, oldPolicy, now - 40_000);
  await copyClosedPhoneLedger(source, target, now);
  const closed = await usageSummary(target, now);
  assert.throws(() => planPhonePolicy(closed, { ...evidence, exactRemainingCredits: 2000.99 }, now), /HEADROOM/);
  assert.throws(() => planPhonePolicy(closed, { ...evidence, verifiedAt: now - 60 * 60_000 }, now), /FRESH/);
  assert.throws(() => planPhonePolicy(closed, { ...evidence, otherKnownSpeechAttemptsToday: 15 }, now), /CEILING/);
  const plan = planPhonePolicy(closed, evidence, now);
  assert.equal(plan.verifiedCreditFloor, 4400);
  assert.equal(plan.reserveCredits, 2000);
  assert.equal(plan.maxGnaniRequests, 6);
  assert.equal(plan.maxLLMRequests, 4);
  assert.equal(plan.maxRequestsPerSession, 5);
  assert.equal(plan.maxConcurrent, 1);
  await setPolicy(target, plan, now);
  assert.equal((await usageSummary(target, now)).admissionOpen, true);
  assert.equal((await usageSummary(target, plan.expiresAt)).admissionOpen, false);
  assert.deepEqual(await usageSummary(source, now), closed);
});
