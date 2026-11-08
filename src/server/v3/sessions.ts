import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { z } from "zod";
import { maskNumbers } from "../../domain/numbers";
import type { Locale } from "../../domain/scenario";
import { OperationSchema, type TurnOperation } from "../../domain/v2/contracts";
import { databaseWrite } from "../v2/database";
import { advanceSession, endSession, startSession, verifySession } from "./controller";
import { InternalSessionSchema, type StoredSession } from "./public-session";

const LEASE_MS = 60_000;
const uuid = z.uuid(), secretShape = /^[a-f0-9]{64}$/;
const VerifySchema = z.object({ sessionId: uuid, operationId: uuid, expectedTurn: z.number().int().min(0).max(10) }).strict();
export type VerificationOperation = z.infer<typeof VerifySchema>;
export class SessionStoreError extends Error {
  constructor(readonly code: "V3_SESSION_NOT_FOUND" | "V3_STALE_TURN" | "V3_OPERATION_CONFLICT" |
    "V3_OPERATION_IN_PROGRESS" | "V3_OPERATION_UNCERTAIN" | "V3_LEASE_LOST" | "V3_INVALID_STATE" | "V3_INVALID_OPERATION") {
    super(code); this.name = "V3SessionStoreError";
  }
}
const fail = (code: SessionStoreError["code"]): never => { throw new SessionStoreError(code); };
const clock = (now: number) => { if (!Number.isSafeInteger(now) || now < 0) fail("V3_INVALID_OPERATION"); };
const ownerHash = (secret: string) => {
  if (typeof secret !== "string" || !secretShape.test(secret)) return fail("V3_SESSION_NOT_FOUND");
  return createHash("sha256").update(secret).digest("hex");
};
// Reuse V2's transaction queue and rollback. Restore only our code-only domain
// error after rollback; SDK errors remain sanitized by databaseWrite.
async function write<T>(client: Client, action: (tx: Transaction) => Promise<T>): Promise<T> {
  let domainError: SessionStoreError | undefined;
  try { return await databaseWrite(client, async (tx) => {
    try { return await action(tx); }
    catch (error) { if (error instanceof SessionStoreError) domainError = error; throw error; }
  }); } catch (error) { throw domainError ?? error; }
}
function safeState(candidate: StoredSession) {
  const parsed = InternalSessionSchema.safeParse(candidate);
  if (!parsed.success) return fail("V3_INVALID_STATE");
  const s = parsed.data;
  return InternalSessionSchema.parse({ ...s, lastCaller: maskNumbers(s.lastCaller),
    history: s.history.map((h) => ({ ...h, caller: maskNumbers(h.caller), participant: maskNumbers(h.participant) })),
    observations: s.observations.map((o) => ({ ...o, evidence: maskNumbers(o.evidence) })),
  });
}
function state(value: unknown) {
  try { return safeState(JSON.parse(String(value))); }
  catch { return fail("V3_INVALID_STATE"); }
}
const digest = (secret: string, value: unknown) => createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex");
function sameDigest(stored: unknown, given: string) {
  const a = Buffer.from(String(stored)), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function initializeSessions(client: Client) {
  await write(client, async (tx) => {
    await tx.execute(`CREATE TABLE IF NOT EXISTS v3_sessions (
      session_id TEXT PRIMARY KEY,owner_hash TEXT NOT NULL,state_json TEXT NOT NULL,
      turn_number INTEGER NOT NULL,ended INTEGER NOT NULL DEFAULT 0,
      lease_operation TEXT,lease_until INTEGER,expires_at INTEGER NOT NULL)`);
    await tx.execute(`CREATE TABLE IF NOT EXISTS v3_turn_operations (
      operation_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,expected_turn INTEGER NOT NULL,
      request_digest TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','completed','abandoned')),
      created_at INTEGER NOT NULL,completed_at INTEGER)`);
    await tx.execute(`CREATE TABLE IF NOT EXISTS v3_verification_events (
      operation_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,expected_turn INTEGER NOT NULL,
      request_digest TEXT NOT NULL,created_at INTEGER NOT NULL)`);
    await tx.execute("CREATE INDEX IF NOT EXISTS v3_turn_session ON v3_turn_operations(session_id)");
    await tx.execute("CREATE INDEX IF NOT EXISTS v3_verification_session ON v3_verification_events(session_id)");
  });
}
export async function createStoredSession(client: Client, locale: Locale, now = Date.now(), selectIndex?: () => number) {
  clock(now);
  const session = safeState(startSession({ sessionId: randomUUID(), locale, now, selectIndex })), secret = randomBytes(32).toString("hex");
  await write(client, async (tx) => { await tx.execute({ sql: `INSERT INTO v3_sessions
    (session_id,owner_hash,state_json,turn_number,expires_at) VALUES (?,?,?,?,?)`,
  args: [session.sessionId, ownerHash(secret), JSON.stringify(session), 0, session.expiresAt] }); });
  return { session, secret };
}
async function owned(tx: Transaction, sessionId: string, secret: string) {
  if (!uuid.safeParse(sessionId).success) return fail("V3_SESSION_NOT_FOUND");
  const result = await tx.execute({ sql: "SELECT * FROM v3_sessions WHERE session_id=? AND owner_hash=?", args: [sessionId, ownerHash(secret)] });
  const row = result.rows[0];
  if (!row) return fail("V3_SESSION_NOT_FOUND");
  return { row, session: state(row.state_json) };
}
export async function readStoredSession(client: Client, sessionId: string, secret: string) {
  return write(client, async (tx) => (await owned(tx, sessionId, secret)).session);
}
export async function hasActiveTurnLease(tx: Transaction, context: { sessionId: string; turnOperationId: string }, now: number): Promise<boolean> {
  clock(now);
  if (!uuid.safeParse(context.sessionId).success || !uuid.safeParse(context.turnOperationId).success) return false;
  const result = await tx.execute({ sql: `SELECT s.ended,s.lease_operation,s.lease_until,s.expires_at,s.turn_number,o.status,o.expected_turn
    FROM v3_sessions s JOIN v3_turn_operations o ON o.session_id=s.session_id WHERE s.session_id=? AND o.operation_id=?`,
  args: [context.sessionId, context.turnOperationId] });
  const row = result.rows[0];
  return Boolean(row && row.ended === 0 && row.status === "active" && row.lease_operation === context.turnOperationId &&
    Number(row.lease_until) > now && Number(row.expires_at) > now && row.turn_number === row.expected_turn);
}
export async function assertActiveTurn(client: Client, context: { sessionId: string; turnOperationId: string }, now = Date.now()) {
  await write(client, async (tx) => { if (!await hasActiveTurnLease(tx, context, now)) fail("V3_LEASE_LOST"); });
}
async function save(tx: Transaction, candidate: StoredSession) {
  const s = safeState(candidate);
  await tx.execute({ sql: "UPDATE v3_sessions SET state_json=?,turn_number=?,ended=?,lease_operation=NULL,lease_until=NULL WHERE session_id=?",
    args: [JSON.stringify(s), s.turn, Number(Boolean(s.ending)), s.sessionId] });
  return s;
}
export type TurnClaim = { kind: "claimed" | "replay" | "ended"; session: StoredSession };
export async function claimTurn(client: Client, secret: string, candidate: TurnOperation, now = Date.now()): Promise<TurnClaim> {
  clock(now); ownerHash(secret);
  const parsed = OperationSchema.safeParse(candidate);
  if (!parsed.success) return fail("V3_INVALID_OPERATION");
  const op = parsed.data, requestDigest = digest(secret, op);
  return write(client, async (tx) => {
    const { row, session } = await owned(tx, op.sessionId, secret);
    if (now < session.updatedAt) return fail("V3_INVALID_OPERATION");
    const event = await tx.execute({ sql: "SELECT operation_id FROM v3_verification_events WHERE operation_id=?", args: [op.operationId] });
    if (event.rows.length) return fail("V3_OPERATION_CONFLICT");
    const existing = (await tx.execute({ sql: "SELECT * FROM v3_turn_operations WHERE operation_id=?", args: [op.operationId] })).rows[0];
    if (existing) {
      if (existing.session_id !== session.sessionId || !sameDigest(existing.request_digest, requestDigest)) return fail("V3_OPERATION_CONFLICT");
      if (existing.status === "completed") return { kind: "replay", session };
      if (existing.status === "abandoned" || Number(row.lease_until ?? 0) <= now) return fail("V3_OPERATION_UNCERTAIN");
      return fail("V3_OPERATION_IN_PROGRESS");
    }
    if (session.ending) return { kind: "ended", session };
    if (op.expectedTurn !== session.turn) return fail("V3_STALE_TURN");
    if (now >= session.expiresAt) return { kind: "ended", session: await save(tx, advanceSession(session, op, null, now)) };
    if (row.lease_operation && Number(row.lease_until) > now) return fail("V3_OPERATION_IN_PROGRESS");
    if (row.lease_operation) await tx.execute({ sql: "UPDATE v3_turn_operations SET status='abandoned' WHERE operation_id=? AND status='active'", args: [row.lease_operation] });
    await tx.execute({ sql: `INSERT INTO v3_turn_operations (operation_id,session_id,expected_turn,request_digest,status,created_at)
      VALUES (?,?,?,?,'active',?)`, args: [op.operationId, session.sessionId, op.expectedTurn, requestDigest, now] });
    await tx.execute({ sql: "UPDATE v3_sessions SET lease_operation=?,lease_until=? WHERE session_id=?",
      args: [op.operationId, Math.min(now + LEASE_MS, session.expiresAt), session.sessionId] });
    return { kind: "claimed", session };
  });
}
export async function commitTurn(client: Client, secret: string, operationId: string, prepared: StoredSession, now = Date.now()) {
  clock(now);
  if (!uuid.safeParse(operationId).success) return fail("V3_INVALID_OPERATION");
  const next = safeState(prepared);
  return write(client, async (tx) => {
    const { row, session: current } = await owned(tx, next.sessionId, secret);
    const op = (await tx.execute({ sql: "SELECT * FROM v3_turn_operations WHERE operation_id=? AND session_id=?", args: [operationId, current.sessionId] })).rows[0];
    if (op?.status === "completed") return current;
    if (!op || op.status !== "active" || current.ending || row.lease_operation !== operationId || Number(row.lease_until ?? 0) <= now ||
        Number(op.expected_turn) !== current.turn || now >= current.expiresAt) return fail("V3_LEASE_LOST");
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    // Failed evaluation can complete its operation without advancing the call.
    // Exact equality prevents this path from altering private state. Replays do
    // not dispatch again; an explicit retry needs a new operation ID.
    if (same(next, current)) {
      const unchanged = await save(tx, current);
      await tx.execute({ sql: "UPDATE v3_turn_operations SET status='completed',completed_at=? WHERE operation_id=? AND status='active'", args: [now, operationId] });
      return unchanged;
    }
    const appendedObservations = next.observations.slice(current.observations.length);
    if (next.locale !== current.locale || next.createdAt !== current.createdAt || next.expiresAt !== current.expiresAt ||
        next.scenarioId !== current.scenarioId || next.mode !== current.mode || next.verificationState !== current.verificationState ||
        next.updatedAt < current.updatedAt || next.updatedAt > now || next.turn !== current.turn + 1 ||
        !same(next.observations.slice(0, current.observations.length), current.observations) ||
        appendedObservations.length < 1 || appendedObservations.length > 4 || appendedObservations.some((o) => o.turn !== next.turn) ||
        !same(next.history.slice(0, -1), current.history.slice(Math.max(0, current.history.length - (next.history.length - 1)))) ||
        next.history.at(-1)?.caller !== current.lastCaller) return fail("V3_INVALID_STATE");
    const retained = await save(tx, next);
    await tx.execute({ sql: "UPDATE v3_turn_operations SET status='completed',completed_at=? WHERE operation_id=? AND status='active'", args: [now, operationId] });
    return retained;
  });
}
export async function endStoredSession(client: Client, sessionId: string, secret: string, now = Date.now()) {
  clock(now);
  return write(client, async (tx) => {
    const { session } = await owned(tx, sessionId, secret);
    if (session.ending) return session;
    if (now < session.updatedAt) return fail("V3_INVALID_OPERATION");
    await tx.execute({ sql: "UPDATE v3_turn_operations SET status='abandoned' WHERE session_id=? AND status='active'", args: [sessionId] });
    return save(tx, endSession(session, now));
  });
}
/** Independent simulator event. A caller/model can neither supply nor choose its result. */
export async function verifyStoredSession(client: Client, secret: string, candidate: VerificationOperation, now = Date.now()) {
  clock(now); ownerHash(secret);
  const parsed = VerifySchema.safeParse(candidate);
  if (!parsed.success) return fail("V3_INVALID_OPERATION");
  const op = parsed.data, requestDigest = digest(secret, { action: "verify", ...op });
  return write(client, async (tx) => {
    const { row, session } = await owned(tx, op.sessionId, secret);
    if (now < session.updatedAt) return fail("V3_INVALID_OPERATION");
    const existing = (await tx.execute({ sql: "SELECT * FROM v3_verification_events WHERE operation_id=?", args: [op.operationId] })).rows[0];
    if (existing) {
      if (existing.session_id !== session.sessionId || !sameDigest(existing.request_digest, requestDigest)) return fail("V3_OPERATION_CONFLICT");
      return session;
    }
    if ((await tx.execute({ sql: "SELECT operation_id FROM v3_turn_operations WHERE operation_id=?", args: [op.operationId] })).rows.length) return fail("V3_OPERATION_CONFLICT");
    if (op.expectedTurn !== session.turn) return fail("V3_STALE_TURN");
    if (row.lease_operation && Number(row.lease_until) > now) return fail("V3_OPERATION_IN_PROGRESS");
    if (row.lease_operation) await tx.execute({ sql: "UPDATE v3_turn_operations SET status='abandoned' WHERE operation_id=? AND status='active'", args: [row.lease_operation] });
    const verified = await save(tx, verifySession(session, now));
    await tx.execute({ sql: `INSERT INTO v3_verification_events (operation_id,session_id,expected_turn,request_digest,created_at)
      VALUES (?,?,?,?,?)`, args: [op.operationId, session.sessionId, op.expectedTurn, requestDigest, now] });
    return verified;
  });
}
