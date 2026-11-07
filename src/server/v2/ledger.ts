import type { Client, Row, Transaction } from "@libsql/client";
import { z } from "zod";
import { databaseWrite } from "./database";

const DAY = 86_400_000;
export const LEDGER_LIMITS = Object.freeze({
  providerRequests: 20, requestsPerSession: 40, concurrent: 2,
  sttSeconds: 20, ttsChars: 420, minimumReserve: 1_000, policyLifetimeMs: DAY,
});
const time = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const count = (max: number) => z.number().int().min(0).max(max);
const positiveCount = (max: number) => z.number().int().min(1).max(max);
const PolicySchema = z.object({
  enabled: z.boolean(), killSwitch: z.boolean(), reconciledAt: time, expiresAt: time,
  verifiedCreditFloor: positiveCount(1_000_000_000), reserveCredits: z.number().int().min(1_000).max(1_000_000_000),
  maxGnaniRequests: count(20), maxGnaniRequestsPerDay: count(20),
  maxLLMRequests: count(20), maxLLMRequestsPerDay: count(20),
  maxRequestsPerSession: positiveCount(40), maxConcurrent: positiveCount(2),
  maxSTTSeconds: z.number().positive().max(20), maxTTSChars: positiveCount(420),
}).strict().superRefine((p, ctx) => {
  if (p.verifiedCreditFloor <= p.reserveCredits || p.expiresAt <= p.reconciledAt ||
      p.expiresAt - p.reconciledAt > DAY || p.maxGnaniRequestsPerDay > p.maxGnaniRequests ||
      p.maxLLMRequestsPerDay > p.maxLLMRequests) ctx.addIssue({ code: "custom", message: "V2_INVALID_POLICY" });
});
export type UsagePolicy = z.infer<typeof PolicySchema>;
const identity = {
  attemptId: z.uuid(), operationId: z.uuid(), sessionId: z.uuid(),
  // Server-selected identifier only: never accept a browser's provider/model choice.
  model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,119}$/),
};
const AttemptSchema = z.discriminatedUnion("kind", [
  z.object({ ...identity, kind: z.literal("gnani_stt"), audioSeconds: z.number().positive().max(20) }).strict(),
  z.object({ ...identity, kind: z.literal("gnani_tts"), textChars: positiveCount(420) }).strict(),
  z.object({ ...identity, kind: z.literal("caller") }).strict(),
  z.object({ ...identity, kind: z.literal("evaluator") }).strict(),
]);
export type UsageAttemptInput = z.infer<typeof AttemptSchema>;
export type UsageKind = UsageAttemptInput["kind"];
export type UsageStatus = "reserved" | "dispatched" | "succeeded" | "failed" | "unknown" | "released";
export type SettlementStatus = Exclude<UsageStatus, "reserved" | "dispatched">;
export type UsageAttempt = {
  attemptId: string; operationId: string; sessionId: string; kind: UsageKind; model: string;
  audioSeconds: number | null; textChars: number | null;
  reservedAt: number; policyReconciledAt: number; dispatchedAt: number | null; settledAt: number | null;
  status: UsageStatus; latencyMs: number | null; providerRequestId: string | null; statusCode: number | null; actualCredits: null;
};
export type UsageTiming = { latencyMs?: number; providerRequestId?: string; statusCode?: number };
const TimingSchema = z.object({ latencyMs: count(DAY).optional(),
  providerRequestId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/).optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
}).strict();
export type LedgerErrorCode = "V2_INVALID_POLICY" | "V2_INVALID_ATTEMPT" | "V2_INVALID_TIME" |
  "V2_ADMISSION_CLOSED" | "V2_QUOTA_EXCEEDED" | "V2_IDENTITY_CONFLICT" | "V2_ATTEMPT_NOT_FOUND" |
  "V2_INVALID_TRANSITION" | "V2_INVALID_SETTLEMENT" | "V2_STORE_UNAVAILABLE";
export class LedgerError extends Error {
  constructor(readonly code: LedgerErrorCode) { super(code); this.name = "LedgerError"; }
}
const fail = (code: LedgerErrorCode): never => { throw new LedgerError(code); };
const checkedTime = (now: number) => time.safeParse(now).success ? now : fail("V2_INVALID_TIME");
const checkedId = (id: string) => z.uuid().safeParse(id).success ? id.toLowerCase() : fail("V2_INVALID_ATTEMPT");

async function write<T>(client: Client, action: (tx: Transaction) => Promise<T>): Promise<T> {
  try { return await databaseWrite(client, action); }
  catch (error) {
    if (error instanceof LedgerError) throw error;
    // No SQL text, connection information, SDK details or supplied data escapes.
    throw new LedgerError("V2_STORE_UNAVAILABLE");
  }
}

/** Additive only. Missing policy means closed; initialization never opens admission. */
export async function initializeLedger(client: Client): Promise<void> {
  await write(client, async (tx) => {
    await tx.execute(`CREATE TABLE IF NOT EXISTS v2_usage_policy (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1), payload TEXT NOT NULL
    )`);
    await tx.execute(`CREATE TABLE IF NOT EXISTS v2_usage_policy_history (
      revision INTEGER PRIMARY KEY AUTOINCREMENT, configured_at INTEGER NOT NULL, payload TEXT NOT NULL
    )`);
    await tx.execute(`CREATE TABLE IF NOT EXISTS v2_usage_attempts (
      attempt_id TEXT PRIMARY KEY, operation_id TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('gnani_stt','gnani_tts','caller','evaluator')), model TEXT NOT NULL,
      audio_seconds REAL, text_chars INTEGER, reserved_at INTEGER NOT NULL, policy_reconciled_at INTEGER NOT NULL,
      dispatched_at INTEGER, settled_at INTEGER,
      status TEXT NOT NULL CHECK (status IN ('reserved','dispatched','succeeded','failed','unknown','released')),
      latency_ms INTEGER, provider_request_id TEXT, status_code INTEGER, actual_credits REAL CHECK (actual_credits IS NULL)
    )`);
    await tx.execute("CREATE INDEX IF NOT EXISTS v2_usage_time ON v2_usage_attempts (reserved_at)");
    await tx.execute("CREATE INDEX IF NOT EXISTS v2_usage_session ON v2_usage_attempts (session_id)");
  });
}

async function policyFrom(tx: Transaction): Promise<UsagePolicy | null> {
  const result = await tx.execute("SELECT payload FROM v2_usage_policy WHERE singleton = 1");
  if (!result.rows.length) return null;
  try {
    const parsed = PolicySchema.safeParse(JSON.parse(String(result.rows[0].payload)));
    return parsed.success ? parsed.data : fail("V2_STORE_UNAVAILABLE");
  } catch { return fail("V2_STORE_UNAVAILABLE"); }
}

/** Trusted operator action only; timestamps and ceilings must never come from public requests. */
export async function setPolicy(client: Client, candidate: UsagePolicy, now = Date.now()): Promise<UsagePolicy> {
  checkedTime(now);
  const parsed = PolicySchema.safeParse(candidate);
  if (!parsed.success || parsed.data.reconciledAt > now || parsed.data.expiresAt <= now) return fail("V2_INVALID_POLICY");
  const policy = parsed.data;
  return write(client, async (tx) => {
    const previous = await policyFrom(tx);
    if (previous && policy.reconciledAt < previous.reconciledAt) return fail("V2_INVALID_POLICY");
    const payload = JSON.stringify(policy);
    await tx.execute({ sql: "INSERT INTO v2_usage_policy_history (configured_at,payload) VALUES (?,?)", args: [now, payload] });
    await tx.execute({ sql: "INSERT INTO v2_usage_policy (singleton,payload) VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload", args: [payload] });
    return policy;
  });
}

function isOpen(policy: UsagePolicy | null, now: number): policy is UsagePolicy {
  return Boolean(policy?.enabled && !policy.killSwitch && policy.reconciledAt <= now && policy.expiresAt > now &&
    policy.verifiedCreditFloor > policy.reserveCredits);
}

function attemptFrom(row: Row): UsageAttempt {
  const optionalNumber = (value: unknown) => value === null ? null : Number(value);
  return {
    attemptId: String(row.attempt_id), operationId: String(row.operation_id), sessionId: String(row.session_id),
    kind: String(row.kind) as UsageKind, model: String(row.model), audioSeconds: optionalNumber(row.audio_seconds),
    textChars: optionalNumber(row.text_chars), reservedAt: Number(row.reserved_at), policyReconciledAt: Number(row.policy_reconciled_at),
    dispatchedAt: optionalNumber(row.dispatched_at), settledAt: optionalNumber(row.settled_at),
    status: String(row.status) as UsageStatus, latencyMs: optionalNumber(row.latency_ms),
    providerRequestId: row.provider_request_id === null ? null : String(row.provider_request_id),
    statusCode: optionalNumber(row.status_code), actualCredits: null,
  };
}

async function existingAttempt(tx: Transaction, attemptId: string): Promise<UsageAttempt> {
  const result = await tx.execute({ sql: "SELECT * FROM v2_usage_attempts WHERE attempt_id = ?", args: [attemptId] });
  return result.rows.length ? attemptFrom(result.rows[0]) : fail("V2_ATTEMPT_NOT_FOUND");
}

export type UsageCounters = {
  gnani: { totalSinceReconciliation: number; daily: number };
  llm: { totalSinceReconciliation: number; daily: number };
  active: number; sessionRequests: number;
};

async function counters(tx: Transaction, policy: UsagePolicy | null, now: number, sessionId = ""): Promise<UsageCounters> {
  const dayStart = Math.floor(now / DAY) * DAY;
  const result = await tx.execute({ sql: `SELECT
    COALESCE(SUM(CASE WHEN kind IN ('gnani_stt','gnani_tts') AND (reserved_at >= ? OR status IN ('reserved','dispatched','unknown')) THEN 1 ELSE 0 END),0) AS gnani_total,
    COALESCE(SUM(CASE WHEN kind IN ('caller','evaluator') AND (reserved_at >= ? OR status IN ('reserved','dispatched','unknown')) THEN 1 ELSE 0 END),0) AS llm_total,
    COALESCE(SUM(CASE WHEN kind IN ('gnani_stt','gnani_tts') AND reserved_at >= ? AND reserved_at < ? THEN 1 ELSE 0 END),0) AS gnani_day,
    COALESCE(SUM(CASE WHEN kind IN ('caller','evaluator') AND reserved_at >= ? AND reserved_at < ? THEN 1 ELSE 0 END),0) AS llm_day,
    COALESCE(SUM(CASE WHEN status IN ('reserved','dispatched','unknown') THEN 1 ELSE 0 END),0) AS active,
    COALESCE(SUM(CASE WHEN session_id = ? THEN 1 ELSE 0 END),0) AS session_count
    FROM v2_usage_attempts WHERE status <> 'released'`, args: [policy?.reconciledAt ?? 0, policy?.reconciledAt ?? 0,
    dayStart, dayStart + DAY, dayStart, dayStart + DAY, sessionId] });
  const row = result.rows[0];
  return { gnani: { totalSinceReconciliation: Number(row.gnani_total), daily: Number(row.gnani_day) },
    llm: { totalSinceReconciliation: Number(row.llm_total), daily: Number(row.llm_day) },
    active: Number(row.active), sessionRequests: Number(row.session_count) };
}

function enforce(policy: UsagePolicy, usage: UsageCounters, attempt: UsageAttemptInput | UsageAttempt, alreadyReserved: boolean) {
  const gnani = attempt.kind === "gnani_stt" || attempt.kind === "gnani_tts";
  const provider = gnani ? usage.gnani : usage.llm;
  const maxTotal = gnani ? policy.maxGnaniRequests : policy.maxLLMRequests;
  const maxDaily = gnani ? policy.maxGnaniRequestsPerDay : policy.maxLLMRequestsPerDay;
  const increment = alreadyReserved ? 0 : 1;
  if (provider.totalSinceReconciliation + increment > maxTotal || provider.daily + increment > maxDaily ||
      usage.active + increment > policy.maxConcurrent || usage.sessionRequests + increment > policy.maxRequestsPerSession ||
      (attempt.kind === "gnani_stt" && Number(attempt.audioSeconds) > policy.maxSTTSeconds) ||
      (attempt.kind === "gnani_tts" && Number(attempt.textChars) > policy.maxTTSChars)) fail("V2_QUOTA_EXCEEDED");
}

function sameMetadata(stored: UsageAttempt, input: UsageAttemptInput) {
  return stored.operationId === input.operationId && stored.sessionId === input.sessionId && stored.kind === input.kind &&
    stored.model === input.model && stored.audioSeconds === ("audioSeconds" in input ? input.audioSeconds : null) &&
    stored.textChars === ("textChars" in input ? input.textChars : null);
}

export async function reserveUsage(
  client: Client, candidate: UsageAttemptInput, now = Date.now(),
): Promise<{ admitted: boolean; attempt: UsageAttempt }> {
  checkedTime(now);
  const parsed = AttemptSchema.safeParse(candidate);
  if (!parsed.success) return fail("V2_INVALID_ATTEMPT");
  const input = { ...parsed.data, attemptId: parsed.data.attemptId.toLowerCase(),
    operationId: parsed.data.operationId.toLowerCase(), sessionId: parsed.data.sessionId.toLowerCase() };
  return write(client, async (tx) => {
    const existing = await tx.execute({ sql: "SELECT * FROM v2_usage_attempts WHERE attempt_id = ? OR operation_id = ?", args: [input.attemptId, input.operationId] });
    if (existing.rows.length) {
      const stored = attemptFrom(existing.rows[0]);
      if (existing.rows.length !== 1 || !sameMetadata(stored, input)) return fail("V2_IDENTITY_CONFLICT");
      return { admitted: false, attempt: stored };
    }
    const policy = await policyFrom(tx);
    if (!isOpen(policy, now)) return fail("V2_ADMISSION_CLOSED");
    enforce(policy, await counters(tx, policy, now, input.sessionId), input, false);
    await tx.execute({ sql: `INSERT INTO v2_usage_attempts
      (attempt_id,operation_id,session_id,kind,model,audio_seconds,text_chars,reserved_at,policy_reconciled_at,status)
      VALUES (?,?,?,?,?,?,?,?,?,'reserved')`, args: [input.attemptId, input.operationId, input.sessionId, input.kind, input.model,
      "audioSeconds" in input ? input.audioSeconds : null, "textChars" in input ? input.textChars : null, now, policy.reconciledAt] });
    return { admitted: true, attempt: await existingAttempt(tx, input.attemptId) };
  });
}

/** A provider call is allowed ONLY when this transaction commits with dispatch:true. */
export async function markDispatched(
  client: Client, attemptId: string, now?: number,
  guard?: (tx: Transaction, now: number) => Promise<boolean>,
): Promise<{ dispatch: boolean; attempt: UsageAttempt; reason?: "V2_ADMISSION_CLOSED" | "V2_QUOTA_EXCEEDED" | "V2_SESSION_INACTIVE" }> {
  if (now !== undefined) checkedTime(now);
  const id = checkedId(attemptId);
  return write(client, async (tx) => {
    // Read the production clock only after waiting for the write lock/queue.
    // Explicit timestamps remain available for deterministic fixture tests.
    const effectiveNow = checkedTime(now ?? Date.now());
    const attempt = await existingAttempt(tx, id);
    if (effectiveNow < attempt.reservedAt) return fail("V2_INVALID_TIME");
    if (attempt.status !== "reserved") return { dispatch: false, attempt };
    const policy = await policyFrom(tx);
    if (!isOpen(policy, effectiveNow)) return { dispatch: false, attempt, reason: "V2_ADMISSION_CLOSED" };
    try { enforce(policy, await counters(tx, policy, effectiveNow, attempt.sessionId), attempt, true); }
    catch (error) {
      if (error instanceof LedgerError && error.code === "V2_QUOTA_EXCEEDED") return { dispatch: false, attempt, reason: "V2_QUOTA_EXCEEDED" };
      throw error;
    }
    if (guard) {
      let active: boolean;
      try { active = (await guard(tx, effectiveNow)) === true; }
      catch { return fail("V2_STORE_UNAVAILABLE"); }
      if (!active) return { dispatch: false, attempt, reason: "V2_SESSION_INACTIVE" };
    }
    await tx.execute({ sql: "UPDATE v2_usage_attempts SET status='dispatched',dispatched_at=? WHERE attempt_id=? AND status='reserved'", args: [effectiveNow, id] });
    return { dispatch: true, attempt: await existingAttempt(tx, id) };
  });
}

export async function settleUsage(
  client: Client, attemptId: string, status: SettlementStatus, timing: UsageTiming = {}, now = Date.now(),
): Promise<{ changed: boolean; attempt: UsageAttempt }> {
  checkedTime(now); const id = checkedId(attemptId);
  const parsed = TimingSchema.safeParse(timing);
  if (!parsed.success || !["succeeded", "failed", "unknown", "released"].includes(status)) return fail("V2_INVALID_SETTLEMENT");
  return write(client, async (tx) => {
    const attempt = await existingAttempt(tx, id);
    if (now < (attempt.settledAt ?? attempt.dispatchedAt ?? attempt.reservedAt)) return fail("V2_INVALID_TIME");
    if (attempt.status === status) return { changed: false, attempt };
    if (status === "released" && attempt.status !== "reserved") return fail("V2_INVALID_TRANSITION");
    if (attempt.status === "released") return fail("V2_INVALID_TRANSITION");
    // Contradictory terminal reports or an outcome without a recorded dispatch are
    // quarantined as unknown. Unknown never auto-refunds or silently resolves itself.
    const next: UsageStatus = attempt.status === "unknown" ||
      (attempt.status === "reserved" && status !== "released") ||
      ((attempt.status === "succeeded" || attempt.status === "failed") && status !== attempt.status) ? "unknown" : status;
    if (attempt.status === next) return { changed: false, attempt };
    await tx.execute({ sql: "UPDATE v2_usage_attempts SET status=?,settled_at=?,latency_ms=?,provider_request_id=?,status_code=? WHERE attempt_id=?",
      args: [next, now, attempt.latencyMs ?? parsed.data.latencyMs ?? null,
      attempt.providerRequestId ?? parsed.data.providerRequestId ?? null, attempt.statusCode ?? parsed.data.statusCode ?? null, id] });
    return { changed: true, attempt: await existingAttempt(tx, id) };
  });
}

export type UsageSummary = {
  asOf: number; policy: UsagePolicy | null; admissionOpen: boolean; actualCredits: null;
  counters: UsageCounters; byStatus: Record<UsageStatus, number>; byKind: Record<UsageKind, number>;
  recent: UsageAttempt[];
};

export async function usageSummary(client: Client, now: number): Promise<UsageSummary> {
  checkedTime(now);
  return write(client, async (tx) => {
    const policy = await policyFrom(tx);
    const usage = await counters(tx, policy, now);
    const grouped = await tx.execute("SELECT kind,status,COUNT(*) AS count FROM v2_usage_attempts GROUP BY kind,status");
    const byStatus: UsageSummary["byStatus"] = { reserved: 0, dispatched: 0, succeeded: 0, failed: 0, unknown: 0, released: 0 };
    const byKind: UsageSummary["byKind"] = { gnani_stt: 0, gnani_tts: 0, caller: 0, evaluator: 0 };
    for (const row of grouped.rows) {
      byStatus[String(row.status) as UsageStatus] += Number(row.count);
      byKind[String(row.kind) as UsageKind] += Number(row.count);
    }
    const recent = await tx.execute("SELECT * FROM v2_usage_attempts ORDER BY reserved_at DESC,attempt_id LIMIT 50");
    return { asOf: now, policy, admissionOpen: isOpen(policy, now), actualCredits: null,
      counters: usage, byStatus, byKind, recent: recent.rows.map(attemptFrom) };
  });
}
