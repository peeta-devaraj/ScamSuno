import type { Client } from "@libsql/client";
import { z } from "zod";
import { locales } from "../../domain/scenario";
import { encodeConversationShare } from "../../domain/share";
import { conversationScore } from "../../domain/v2/controller";
import { OperationSchema, type ConversationSession } from "../../domain/v2/contracts";
import { boundedBody, failure, reply, withinLimit } from "../http";
import type { ConversationGateway } from "./caller";
import { prepareConversationTurn } from "./conversation";
import { assertActiveTurn, claimTurn, commitTurn, createStoredSession, endStoredSession, readStoredSession } from "./sessions";
import { verifyVoiceProof } from "./voice-proof";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), locale: z.enum(locales) }).strict(),
  z.object({ action: z.literal("reply"), operation: OperationSchema,
    confirmation: z.object({ proof: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int().nonnegative() }).strict().optional(),
  }).strict(),
  z.object({ action: z.literal("end"), sessionId: z.uuid() }).strict(),
]);
export type ConversationHttpDependencies = {
  mode: () => "live" | "fixture" | null;
  database: () => Promise<Client>;
  gateway: (client: Client, context: { sessionId: string; turnOperationId: string }) => ConversationGateway;
};
const cookieName = "scamsuno_v2";
export function sessionOwner(request: Request, sessionId: string) {
  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.length > 8192) return null;
  const values = cookies.split(";").map((v) => v.trim()).filter((v) => v.startsWith(`${cookieName}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(cookieName.length + 1);
  return value.startsWith(`${sessionId}.`) && /^[a-f0-9]{64}$/.test(value.slice(sessionId.length + 1)) ?
    value.slice(sessionId.length + 1) : null;
}
function stateResponse(session: ConversationSession, mode: "live" | "fixture" | "disabled", status = "ready", callerSource = "authored_fallback") {
  return reply({ ok: true, mode, educationalSimulation: true, session, status, callerSource,
    result: session.ending ? { ...conversationScore(session), shareToken: encodeConversationShare(session) } : null });
}

/** The factory is dependency-injected for explicit fixture tests. The deployed route supplies only live services. */
export function createConversationHandler(deps: ConversationHttpDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const mode = deps.mode();
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin ||
        !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return failure("V2_INVALID_REQUEST", "Open the call page to continue.", 403);
    }
    try {
      const body = await boundedBody(request, 4096);
      if (!body) return failure("V2_INVALID_REQUEST", "Could not read that reply.", 400);
      const parsed = inputSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
      if (!parsed.success) return failure("V2_INVALID_REQUEST", "Could not read that reply.", 400);
      const input = parsed.data;
      // An authenticated End Call remains available when inference is disabled,
      // policy expires, the kill switch fires, or generic turn traffic is limited.
      const enabled = mode && !(mode === "fixture" && process.env.VERCEL_ENV === "production");
      if (input.action !== "end") {
        if (!enabled) return failure("V2_NOT_READY", "The conversational preview is not enabled yet.", 503);
        if (!withinLimit(request, "v2", 80)) return failure("V2_RATE_LIMITED", "Please wait before trying another call.", 429);
      }
      const sessionId = input.action === "start" ? null : input.action === "end" ? input.sessionId : input.operation.sessionId;
      const secret = sessionId ? sessionOwner(request, sessionId) : null;
      if (input.action !== "start" && !secret) return failure("V2_SESSION_NOT_FOUND", "Start a new practice call to continue.", 401);
      const client = await deps.database();
      if (input.action === "start") {
        const created = await createStoredSession(client, input.locale);
        const response = stateResponse(created.session, mode!);
        response.headers.set("Set-Cookie", `${cookieName}=${created.session.sessionId}.${created.secret}; HttpOnly; SameSite=Strict; Path=/api/v2; Max-Age=480${url.protocol === "https:" ? "; Secure" : ""}`);
        return response;
      }
      if (input.action === "end") return stateResponse(await endStoredSession(client, sessionId!, secret!), enabled ? mode! : "disabled");
      const participant = input.operation.reply;
      if (participant.origin === "voice") {
        const stored = await readStoredSession(client, sessionId!, secret!);
        const confirmation = input.confirmation;
        if (!confirmation || !verifyVoiceProof(secret!, {
          sessionId: sessionId!, expectedTurn: input.operation.expectedTurn, locale: stored.locale,
          text: participant.text, model: participant.transcription.model, requestId: participant.transcription.requestId,
        }, confirmation.proof, confirmation.expiresAt)) {
          return failure("V2_VOICE_CONFIRMATION_INVALID", "Record again or send the edited reply as typed text.", 400);
        }
      } else if (input.confirmation) return failure("V2_INVALID_REQUEST", "Only unchanged recorded replies use voice confirmation.", 400);
      const claim = await claimTurn(client, secret!, input.operation);
      if (claim.kind !== "claimed") return stateResponse(claim.session, mode!);
      const prepared = await prepareConversationTurn(claim.session, input.operation, deps.gateway(client, {
        sessionId: sessionId!, turnOperationId: input.operation.operationId,
      }), { source: mode === "fixture" ? "fixture" : "hosted", now: Date.now(), signal: request.signal,
        assertActive: () => assertActiveTurn(client, { sessionId: sessionId!, turnOperationId: input.operation.operationId }) });
      const committed = await commitTurn(client, secret!, input.operation.operationId, prepared.session);
      return stateResponse(committed, mode!, prepared.status, prepared.callerSource);
    } catch (error) {
      // Deliberately return allowlisted codes only; SDK/provider messages may contain secrets or reply text.
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (["V2_SESSION_NOT_FOUND"].includes(code)) return failure(code, "Start a new practice call to continue.", 401);
      if (["V2_STALE_TURN", "V2_OPERATION_CONFLICT", "V2_OPERATION_IN_PROGRESS", "V2_OPERATION_UNCERTAIN", "V2_LEASE_LOST"].includes(code)) {
        return failure(code, "This call changed. End it or start a new practice call.", 409);
      }
      if (error instanceof SyntaxError || code === "V2_INVALID_OPERATION" || code === "V2_INVALID_STATE") {
        return failure("V2_INVALID_REQUEST", "Could not read that reply.", 400);
      }
      return failure("V2_UNAVAILABLE", "The conversational preview is temporarily unavailable. You can end this call.", 503, true);
    }
  };
}
