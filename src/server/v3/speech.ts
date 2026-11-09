import type { Client, Transaction } from "@libsql/client";
import { createSpeechGateway, type SpeechSessionView } from "../v2/speech";
import { liveVoiceMode } from "../v2/voice-http";
import { liveTrustOrTrapMode } from "./config";
import { InternalSessionSchema } from "./public-session";
import { v3EnabledInTransaction } from "./control";

export function liveV3VoiceMode(): "live" | null {
  return liveTrustOrTrapMode() && liveVoiceMode() && process.env.STT_ENABLED === "true" ? "live" : null;
}

/** Transaction-bound V3-only reader. It returns no assignment, history or answer key. */
export async function currentSpeechSession(tx: Transaction, context: { sessionId: string; expectedTurn: number }, now: number): Promise<SpeechSessionView | null> {
  if (!await v3EnabledInTransaction(tx)) return null;
  const result = await tx.execute({ sql: "SELECT state_json,turn_number,ended,lease_operation,expires_at FROM v3_sessions WHERE session_id=?", args: [context.sessionId] });
  const row = result.rows[0];
  if (!row || row.ended !== 0 || Number(row.turn_number) !== context.expectedTurn || row.lease_operation || Number(row.expires_at) <= now) return null;
  try {
    const parsed = InternalSessionSchema.safeParse(JSON.parse(String(row.state_json)));
    if (!parsed.success || parsed.data.ending || parsed.data.turn !== context.expectedTurn || parsed.data.expiresAt <= now ||
        parsed.data.expiresAt !== Number(row.expires_at)) return null;
    const s = parsed.data;
    return { locale: s.locale, turn: s.turn, lastCaller: s.lastCaller, updatedAt: s.updatedAt, ending: s.ending };
  } catch { return null; }
}

export function createV3SpeechGateway(client: Client, context: { sessionId: string; expectedTurn: number; operationId: string }, transport: typeof fetch = fetch) {
  return createSpeechGateway(client, context, transport, {
    currentSpeechSession,
    enabled: () => Boolean(liveV3VoiceMode()),
    sttContext: {
      keyterms: ["bank", "service notice", "independent verification"],
      topic: "Fictional practice conversation about a bank service notice",
    },
  });
}
