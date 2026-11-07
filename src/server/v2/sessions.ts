import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Client, Transaction } from "@libsql/client";
import { maskNumbers } from "../../domain/numbers";
import type { Locale } from "../../domain/scenario";
import { OperationSchema, SessionSchema, type ConversationSession, type TurnOperation } from "../../domain/v2/contracts";
import { advanceConversation, startConversation } from "../../domain/v2/controller";
import { databaseWrite } from "./database";

const LEASE_MS = 60_000;
const uuid = z.uuid();
const secretShape = z.string().regex(/^[a-f0-9]{64}$/);
export class SessionStoreError extends Error {
  constructor(readonly code: "V2_SESSION_NOT_FOUND" | "V2_SESSION_ENDED" | "V2_STALE_TURN" |
    "V2_OPERATION_CONFLICT" | "V2_OPERATION_IN_PROGRESS" | "V2_OPERATION_UNCERTAIN" |
    "V2_LEASE_LOST" | "V2_INVALID_STATE" | "V2_INVALID_OPERATION") {
    super(code); this.name = "SessionStoreError";
  }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function ownerHash(secret: string) {
  if (!secretShape.safeParse(secret).success) throw new SessionStoreError("V2_SESSION_NOT_FOUND");
  return hash(secret);
}
function state(json: unknown): ConversationSession {
  try { return SessionSchema.parse(JSON.parse(String(json))); }
  catch { throw new SessionStoreError("V2_INVALID_STATE"); }
}
function checkedTime(now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new SessionStoreError("V2_INVALID_OPERATION");
}
function safeState(session: ConversationSession) {
  const s = SessionSchema.parse(session);
  return SessionSchema.parse({ ...s, lastCaller: maskNumbers(s.lastCaller),
    history: s.history.map((h) => ({ ...h, caller: maskNumbers(h.caller), participant: maskNumbers(h.participant) })),
    observations: s.observations.map((o) => ({ ...o, assessment: { ...o.assessment, evidence: maskNumbers(o.assessment.evidence) } })),
  });
}

export async function initializeSessions(client: Client) {
  await databaseWrite(client, async (tx) => {
    await tx.execute(`CREATE TABLE IF NOT EXISTS v2_sessions (
      session_id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, state_json TEXT NOT NULL,
      turn_number INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0,
      lease_operation TEXT, lease_until INTEGER, expires_at INTEGER NOT NULL)`);
    await tx.execute(`CREATE TABLE IF NOT EXISTS v2_turn_operations (
      operation_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, expected_turn INTEGER NOT NULL,
      request_digest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','completed','abandoned')),
      created_at INTEGER NOT NULL, completed_at INTEGER)`);
    await tx.execute("CREATE INDEX IF NOT EXISTS v2_turn_operations_session ON v2_turn_operations(session_id)");
  });
}

export async function createStoredSession(client: Client, locale: Locale, now = Date.now()) {
  checkedTime(now);
  const session = startConversation(randomUUID(), locale, now), secret = randomBytes(32).toString("hex");
  await databaseWrite(client, async (tx) => {
    await tx.execute({ sql: `INSERT INTO v2_sessions
      (session_id,owner_hash,state_json,turn_number,expires_at) VALUES (?,?,?,?,?)`,
    args: [session.sessionId, ownerHash(secret), JSON.stringify(safeState(session)), 0, session.expiresAt] });
  });
  return { session, secret };
}

async function owned(tx: Transaction, sessionId: string, secret: string) {
  if (!uuid.safeParse(sessionId).success) throw new SessionStoreError("V2_SESSION_NOT_FOUND");
  const result = await tx.execute({ sql: "SELECT * FROM v2_sessions WHERE session_id=? AND owner_hash=?",
    args: [sessionId, ownerHash(secret)] });
  const row = result.rows[0];
  if (!row) throw new SessionStoreError("V2_SESSION_NOT_FOUND");
  return { row, session: state(row.state_json) };
}

export async function readStoredSession(client: Client, sessionId: string, secret: string) {
  return databaseWrite(client, async (tx) => (await owned(tx, sessionId, secret)).session);
}

/** Run inside the same write transaction that authorizes a paid upstream dispatch. */
export async function hasActiveTurnLease(
  tx: Transaction, context: { sessionId: string; turnOperationId: string }, now: number,
): Promise<boolean> {
  const result = await tx.execute({ sql: `SELECT s.ended,s.lease_operation,s.lease_until,s.expires_at,s.turn_number,
    o.status,o.expected_turn FROM v2_sessions s JOIN v2_turn_operations o ON o.session_id=s.session_id
    WHERE s.session_id=? AND o.operation_id=?`, args: [context.sessionId, context.turnOperationId] });
  const row = result.rows[0];
  return Boolean(row && row.ended === 0 && row.status === "active" && row.lease_operation === context.turnOperationId &&
    Number(row.lease_until) > now && Number(row.expires_at) > now && row.turn_number === row.expected_turn);
}

export async function assertActiveTurn(client: Client, context: { sessionId: string; turnOperationId: string }, now = Date.now()) {
  await databaseWrite(client, async (tx) => {
    if (!await hasActiveTurnLease(tx, context, now)) throw new SessionStoreError("V2_LEASE_LOST");
  });
}

export type TurnClaim = { kind: "claimed" | "replay" | "ended"; session: ConversationSession };
/** Claim by the server's opaque owner secret, not a client-supplied session envelope. */
export async function claimTurn(client: Client, secret: string, input: TurnOperation, now = Date.now()): Promise<TurnClaim> {
  checkedTime(now);
  const parsed = OperationSchema.safeParse(input);
  if (!parsed.success) throw new SessionStoreError("V2_INVALID_OPERATION");
  const operation = parsed.data;
  ownerHash(secret);
  // HMAC prevents an offline dictionary of reply text from a database-only disclosure.
  const digest = createHmac("sha256", secret).update(JSON.stringify(operation)).digest("hex");
  return databaseWrite(client, async (tx) => {
    const { row, session } = await owned(tx, operation.sessionId, secret);
    if (now < session.updatedAt) throw new SessionStoreError("V2_INVALID_OPERATION");
    const existing = (await tx.execute({ sql: "SELECT * FROM v2_turn_operations WHERE operation_id=?",
      args: [operation.operationId] })).rows[0];
    if (existing) {
      const saved = Buffer.from(String(existing.request_digest)), given = Buffer.from(digest);
      if (existing.session_id !== operation.sessionId || saved.length !== given.length || !timingSafeEqual(saved, given)) {
        throw new SessionStoreError("V2_OPERATION_CONFLICT");
      }
      if (existing.status === "completed") return { kind: "replay", session };
      if (existing.status === "abandoned" || Number(row.lease_until ?? 0) <= now) {
        throw new SessionStoreError("V2_OPERATION_UNCERTAIN");
      }
      throw new SessionStoreError("V2_OPERATION_IN_PROGRESS");
    }
    if (session.ending) return { kind: "ended", session };
    if (operation.expectedTurn !== session.turn) throw new SessionStoreError("V2_STALE_TURN");
    if (now >= session.expiresAt) {
      const ended = advanceConversation(session, operation, null, "hosted", now);
      await save(tx, ended);
      return { kind: "ended", session: ended };
    }
    if (row.lease_operation && Number(row.lease_until) > now) throw new SessionStoreError("V2_OPERATION_IN_PROGRESS");
    if (row.lease_operation) await tx.execute({ sql: "UPDATE v2_turn_operations SET status='abandoned' WHERE operation_id=? AND status='active'",
      args: [row.lease_operation] });
    await tx.execute({ sql: `INSERT INTO v2_turn_operations
      (operation_id,session_id,expected_turn,request_digest,status,created_at) VALUES (?,?,?,?,'active',?)`,
    args: [operation.operationId, session.sessionId, operation.expectedTurn, digest, now] });
    await tx.execute({ sql: "UPDATE v2_sessions SET lease_operation=?,lease_until=? WHERE session_id=?",
      args: [operation.operationId, Math.min(now + LEASE_MS, session.expiresAt), session.sessionId] });
    return { kind: "claimed", session };
  });
}

async function save(tx: Transaction, s: ConversationSession) {
  const retained = safeState(s);
  await tx.execute({ sql: `UPDATE v2_sessions SET state_json=?,turn_number=?,ended=?,lease_operation=NULL,lease_until=NULL WHERE session_id=?`,
    args: [JSON.stringify(retained), s.turn, Number(Boolean(s.ending)), s.sessionId] });
  return retained;
}

/** Commit only the currently leased, server-prepared state. Late work loses to End Call. */
export async function commitTurn(
  client: Client, secret: string, operationId: string, prepared: ConversationSession, now = Date.now(),
) {
  checkedTime(now);
  if (!uuid.safeParse(operationId).success) throw new SessionStoreError("V2_INVALID_OPERATION");
  const parsed = SessionSchema.safeParse(prepared);
  if (!parsed.success) throw new SessionStoreError("V2_INVALID_STATE");
  return databaseWrite(client, async (tx) => {
    const next = parsed.data;
    const { row, session: current } = await owned(tx, next.sessionId, secret);
    const op = (await tx.execute({ sql: "SELECT * FROM v2_turn_operations WHERE operation_id=? AND session_id=?",
      args: [operationId, current.sessionId] })).rows[0];
    if (op?.status === "completed") return current;
    if (!op || op.status !== "active" || current.ending || row.lease_operation !== operationId ||
        Number(row.lease_until ?? 0) <= now || Number(op.expected_turn) !== current.turn) throw new SessionStoreError("V2_LEASE_LOST");
    if (next.locale !== current.locale || next.createdAt !== current.createdAt || next.expiresAt !== current.expiresAt ||
        next.updatedAt < current.updatedAt || next.updatedAt > now || next.turn < current.turn || next.turn > current.turn + 1 ||
        (next.turn === current.turn && JSON.stringify(next) !== JSON.stringify(current))) throw new SessionStoreError("V2_INVALID_STATE");
    const saved = await save(tx, next);
    await tx.execute({ sql: "UPDATE v2_turn_operations SET status='completed',completed_at=? WHERE operation_id=? AND status='active'",
      args: [now, operationId] });
    return saved;
  });
}

/** Authenticated hangup does not wait for or trust a model response or an active lease. */
export async function endStoredSession(client: Client, sessionId: string, secret: string, now = Date.now()) {
  checkedTime(now);
  return databaseWrite(client, async (tx) => {
    const { session } = await owned(tx, sessionId, secret);
    if (session.ending) return session;
    if (now < session.updatedAt) throw new SessionStoreError("V2_INVALID_OPERATION");
    const ended = advanceConversation(session, { sessionId, operationId: randomUUID(), expectedTurn: session.turn,
      reply: { origin: "button", id: "end" } }, null, "hosted", now);
    await tx.execute({ sql: "UPDATE v2_turn_operations SET status='abandoned' WHERE session_id=? AND status='active'", args: [sessionId] });
    return save(tx, ended);
  });
}
