import { OperationSchema, SessionSchema, type ConversationSession, type TurnOperation } from "../../domain/v2/contracts";
import { advanceConversation, attachCaller, ConversationConflict } from "../../domain/v2/controller";
import { ConversationModelError, requestCaller, requestEvaluation, type ConversationGateway } from "./caller";

export type PreparedTurn = {
  session: ConversationSession;
  callerSource: "hosted" | "fixture" | "authored_fallback";
  status: "ready" | "evaluation_unavailable" | "caller_fallback";
};

/**
 * No live transport or HTTP route is installed here. The owner must hold a durable
 * session/operation lease and provide a quota-admitted gateway before invoking this
 * function, then commit via expected-turn comparison. It prepares, never persists.
 * A gateway owns provider timeouts and accounting even if cancellation wins locally.
 */
export async function prepareConversationTurn(
  storedSession: ConversationSession, operation: TurnOperation, gateway: ConversationGateway,
  options: { source: "hosted" | "fixture"; now: number; signal?: AbortSignal },
): Promise<PreparedTurn> {
  const parsedSession = SessionSchema.safeParse(storedSession), parsedOperation = OperationSchema.safeParse(operation);
  if (!parsedSession.success || !Number.isSafeInteger(options.now) || options.now < storedSession.updatedAt) {
    throw new ConversationConflict("INVALID_SESSION");
  }
  if (!parsedOperation.success) throw new ConversationConflict("INVALID_OPERATION");
  const s = parsedSession.data, op = parsedOperation.data;
  if (s.ending) throw new ConversationConflict("SESSION_ENDED");
  if (s.sessionId !== op.sessionId || s.turn !== op.expectedTurn) throw new ConversationConflict("STALE_TURN");
  if (options.signal?.aborted) throw new ConversationModelError("ABORTED");
  if (options.now >= s.expiresAt) {
    return { session: advanceConversation(s, op, null, options.source, options.now),
      callerSource: "authored_fallback", status: "ready" };
  }
  let candidate: unknown = null;
  if (op.reply.origin !== "button") {
    try { candidate = await requestEvaluation(s, op.reply, gateway, options.signal); }
    catch (error) {
      if (options.signal?.aborted || (error instanceof ConversationModelError && error.code === "ABORTED")) {
        throw new ConversationModelError("ABORTED");
      }
      return { session: s, callerSource: "authored_fallback", status: "evaluation_unavailable" };
    }
  }
  let next = advanceConversation(s, op, candidate, options.source, options.now);
  if (next.ending || next.observations.at(-1)?.assessment.intent === "UNCLEAR") {
    return { session: next, callerSource: "authored_fallback", status: "ready" };
  }
  try {
    const dialogue = await requestCaller(next, op.reply, gateway, options.signal);
    const attached = attachCaller(next, dialogue, options.source);
    next = attached.session;
    return { session: next, callerSource: attached.source,
      status: attached.source === "authored_fallback" ? "caller_fallback" : "ready" };
  } catch (error) {
    if (options.signal?.aborted || (error instanceof ConversationModelError && error.code === "ABORTED")) {
      throw new ConversationModelError("ABORTED");
    }
    return { session: next, callerSource: "authored_fallback", status: "caller_fallback" };
  }
}
