import type { Client } from "@libsql/client";
import { databaseWrite } from "../src/server/v2/database";
import { initializeLedger, LEDGER_LIMITS, readUsageAdmission, type UsagePolicy, type UsageSummary } from "../src/server/v2/ledger";

const tables = [
  "v2_usage_policy",
  "v2_usage_policy_history",
  "v2_usage_attempts",
  "v2_usage_reconciliations",
  "v2_usage_unknown_acknowledgements",
] as const;

// Operator use with a newly provisioned, separately credentialed store only.
// Copy accounting without copying any participant/session data.
export async function copyClosedPhoneLedger(source: Client, destination: Client, now = Date.now()) {
  if (source === destination) throw new Error("PHONE_STORE_MUST_BE_SEPARATE");
  const read = await source.transaction("read");
  let snapshot;
  try {
    const admission = await readUsageAdmission(read, now);
    if (admission.admissionOpen) throw new Error("PHONE_SOURCE_MUST_BE_CLOSED");
    const pending = await read.execute("SELECT 1 FROM v2_usage_attempts WHERE status IN ('reserved','dispatched') LIMIT 1");
    if (pending.rows.length) throw new Error("PHONE_SOURCE_HAS_IN_FLIGHT_ATTEMPTS");
    snapshot = [];
    for (const table of tables) {
      const result = await read.execute(`SELECT * FROM ${table}`);
      snapshot.push({ table, columns: result.columns, rows: result.rows.map(row => Array.from(row)) });
    }
    await read.commit();
  } finally {
    read.close();
  }

  await initializeLedger(destination);
  return databaseWrite(destination, async tx => {
    for (const { table } of snapshot) {
      if ((await tx.execute(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length) {
        throw new Error("PHONE_DESTINATION_MUST_BE_EMPTY");
      }
    }
    for (const { table, columns, rows } of snapshot) {
      // Columns come from the known ledger schema. Reject malformed identifiers.
      if (columns.some(column => !/^\w+$/.test(column))) throw new Error("PHONE_INVALID_LEDGER_SCHEMA");
      const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
      for (const args of rows) await tx.execute({ sql, args });
      if (Number((await tx.execute(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count) !== rows.length) {
        throw new Error("PHONE_LEDGER_COPY_MISMATCH");
      }
    }
    if ((await readUsageAdmission(tx, now)).admissionOpen) throw new Error("PHONE_DESTINATION_MUST_STAY_CLOSED");
    return Object.fromEntries(snapshot.map(({ table, rows }) => [table, rows.length]));
  });
}

export const PHONE_WINDOW = {
  speechAttempts: 6,
  modelAttempts: 4,
  sessionAttempts: 5,
  concurrency: 1,
  durationMs: 20 * 60_000,
  reserveCredits: 2_000,
} as const;

/** Plans only. Caller must verify dashboard evidence and deployment/store isolation before applying. */
export function planPhonePolicy(
  ledger: Pick<UsageSummary, "policy" | "admissionOpen" | "counters">,
  evidence: { verifiedAt: number; exactRemainingCredits: number; otherKnownSpeechAttemptsToday: number },
  now = Date.now(),
): UsagePolicy {
  const { verifiedAt, exactRemainingCredits, otherKnownSpeechAttemptsToday } = evidence;
  const dayMs = 24 * 60 * 60_000;
  const endOfUtcDay = (Math.floor(now / dayMs) + 1) * dayMs;
  const expiresAt = now + PHONE_WINDOW.durationMs;
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(verifiedAt) || verifiedAt > now ||
      now - verifiedAt > 15 * 60_000 || verifiedAt < (ledger.policy?.reconciledAt ?? 0) ||
      verifiedAt < endOfUtcDay - dayMs || expiresAt > endOfUtcDay) {
    throw new Error("PHONE_FRESH_PROVIDER_EVIDENCE_REQUIRED");
  }
  if (ledger.admissionOpen || ledger.counters.active !== 0) throw new Error("PHONE_ACTIVE_OR_UNKNOWN_ATTEMPTS");
  const reserveCredits = Math.max(PHONE_WINDOW.reserveCredits, ledger.policy?.reserveCredits ?? 0);
  const verifiedCreditFloor = Math.floor(exactRemainingCredits);
  if (!Number.isSafeInteger(verifiedCreditFloor) || verifiedCreditFloor <= reserveCredits) {
    throw new Error("PHONE_INSUFFICIENT_VERIFIED_HEADROOM");
  }
  const gnaniDaily = ledger.counters.gnani.daily + PHONE_WINDOW.speechAttempts;
  const modelDaily = ledger.counters.llm.daily + PHONE_WINDOW.modelAttempts;
  if (!Number.isSafeInteger(otherKnownSpeechAttemptsToday) || otherKnownSpeechAttemptsToday < 0 ||
      gnaniDaily + otherKnownSpeechAttemptsToday > LEDGER_LIMITS.providerRequests ||
      modelDaily > LEDGER_LIMITS.llmRequests) throw new Error("PHONE_DAILY_CEILING");
  return {
    enabled: true, killSwitch: false,
    reconciledAt: verifiedAt, expiresAt,
    verifiedCreditFloor, reserveCredits,
    // Daily ceilings include earlier attempts. Since-reconciliation limits must
    // be at least the daily ceilings to satisfy the existing ledger contract.
    maxGnaniRequests: gnaniDaily, maxGnaniRequestsPerDay: gnaniDaily,
    maxLLMRequests: modelDaily, maxLLMRequestsPerDay: modelDaily,
    maxRequestsPerSession: PHONE_WINDOW.sessionAttempts, maxConcurrent: PHONE_WINDOW.concurrency,
    maxSTTSeconds: 15, maxTTSChars: 420,
  };
}
