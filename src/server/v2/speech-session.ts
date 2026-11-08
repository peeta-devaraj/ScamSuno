import type { Transaction } from "@libsql/client";
import { SessionSchema } from "../../domain/v2/contracts";

/** Speech precedes or follows a committed turn; it never shares a model-turn lease. */
export async function currentSpeechSession(
  tx: Transaction, context: { sessionId: string; expectedTurn: number }, now: number,
) {
  const result = await tx.execute({ sql: "SELECT state_json,turn_number,ended,lease_operation,expires_at FROM v2_sessions WHERE session_id=?",
    args: [context.sessionId] });
  const row = result.rows[0];
  if (!row || row.ended !== 0 || Number(row.turn_number) !== context.expectedTurn ||
      row.lease_operation || Number(row.expires_at) <= now) return null;
  try {
    const parsed = SessionSchema.safeParse(JSON.parse(String(row.state_json)));
    return parsed.success && !parsed.data.ending && parsed.data.turn === context.expectedTurn ? parsed.data : null;
  } catch { return null; }
}
