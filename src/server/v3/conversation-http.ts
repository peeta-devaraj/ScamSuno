import type { Client } from "@libsql/client";
import { z } from "zod";
import { locales } from "../../domain/scenario";
import { OperationSchema } from "../../domain/v2/contracts";
import { boundedBody, failure, reply, withinLimit } from "../http";
import type { ConversationGateway } from "../v2/caller";
import { verifyVoiceProof } from "../v2/voice-proof";
import { prepareConversationTurn } from "./conversation";
import { v3AdmissionEnabled } from "./control";
import { buildDebrief } from "./controller";
import { projectPublicSession, type StoredSession } from "./public-session";
import { assertActiveTurn, claimTurn, commitTurn, createStoredSession, endStoredSession, readStoredSession, verifyStoredSession } from "./sessions";

const InputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), locale: z.enum(locales) }).strict(),
  z.object({ action: z.literal("reply"), operation: OperationSchema,
    confirmation: z.object({ proof: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int().nonnegative() }).strict().optional(),
  }).strict(),
  z.object({ action: z.literal("verify"), operation: z.object({ sessionId: z.uuid(), operationId: z.uuid(), expectedTurn: z.number().int().min(0).max(10) }).strict() }).strict(),
  z.object({ action: z.literal("end"), sessionId: z.uuid() }).strict(),
]);
export type ConversationHttpDependencies = {
  mode: () => "live" | "fixture" | null;
  database: () => Promise<Client>;
  gateway: (client: Client, context: { sessionId: string; turnOperationId: string }) => ConversationGateway;
};
const cookieName = "scamsuno_v3";
export function sessionOwner(request: Request, sessionId: string) {
  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.length > 8192 || !z.uuid().safeParse(sessionId).success) return null;
  const matches = cookies.split(";").map((value) => value.trim()).filter((value) => value.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(cookieName.length + 1);
  return value.startsWith(`${sessionId}.`) && /^[a-f0-9]{64}$/.test(value.slice(sessionId.length + 1)) ? value.slice(sessionId.length + 1) : null;
}
function trustedOrigin(request: Request) {
  const url = new URL(request.url);
  const loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.VERCEL_ENV;
  return request.headers.get("origin") === url.origin && (url.protocol === "https:" || loopback);
}
function stateResponse(session: StoredSession, mode: "live" | "fixture" | "disabled", status = "ready", callerSource = "authored_fallback") {
  return reply({ ok: true, mode, educationalSimulation: true, session: projectPublicSession(session), status, callerSource,
    debrief: session.ending ? buildDebrief(session) : null });
}

/** Production wiring supplies live adapters only; fixture injection is local test infrastructure. */
export function createConversationHandler(deps: ConversationHttpDependencies) {
  return async function POST(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST" || !trustedOrigin(request) ||
          request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return failure("V3_INVALID_REQUEST", "Open the practice page to continue.", 403);
      }
      const body = await boundedBody(request, 4096);
      if (!body) return failure("V3_INVALID_REQUEST", "Could not read that request.", 400);
      let decoded: unknown;
      try { decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
      catch { return failure("V3_INVALID_REQUEST", "Could not read that request.", 400); }
      const parsed = InputSchema.safeParse(decoded);
      if (!parsed.success) return failure("V3_INVALID_REQUEST", "Could not read that request.", 400);
      const input = parsed.data, mode = deps.mode();
      const enabled = mode && !(mode === "fixture" && (Boolean(process.env.VERCEL) || ["preview", "production"].includes(process.env.VERCEL_ENV ?? "")));
      if (input.action === "start" || input.action === "reply") {
        if (!enabled) return failure("V3_NOT_READY", "Trust or Trap is not enabled yet.", 503);
        if (!withinLimit(request, "v3", 80)) return failure("V3_RATE_LIMITED", "Please wait before starting another request.", 429);
      }
      const sessionId = input.action === "start" ? null : input.action === "end" ? input.sessionId : input.operation.sessionId;
      const secret = sessionId ? sessionOwner(request, sessionId) : null;
      if (input.action !== "start" && !secret) return failure("V3_SESSION_NOT_FOUND", "Start a practice call to continue.", 401);
      const client = await deps.database();
      if ((input.action === "start" || input.action === "reply") && !await v3AdmissionEnabled(client)) {
        return failure("V3_PAUSED", "Trust or Trap is paused. You can still end this call or check independently.", 503);
      }
      if (input.action === "start") {
        const created = await createStoredSession(client, input.locale), response = stateResponse(created.session, mode!);
        response.headers.set("Set-Cookie", `${cookieName}=${created.session.sessionId}.${created.secret}; HttpOnly; SameSite=Strict; Path=/api/v3; Max-Age=480${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`);
        return response;
      }
      const responseMode = enabled ? mode! : "disabled";
      if (input.action === "end") return stateResponse(await endStoredSession(client, sessionId!, secret!), responseMode);
      if (input.action === "verify") {
        // Independent verification has no provider call. It remains available to
        // owned sessions after End/flag rollback, separately bounded from inference.
        if (!withinLimit(request, "v3-verification", 80)) return failure("V3_RATE_LIMITED", "Please wait before checking again.", 429);
        return stateResponse(await verifyStoredSession(client, secret!, input.operation), responseMode);
      }
      const participant = input.operation.reply;
      if (participant.origin === "voice") {
        const stored = await readStoredSession(client, sessionId!, secret!), confirmation = input.confirmation;
        if (!confirmation || !verifyVoiceProof(secret!, { sessionId: sessionId!, expectedTurn: input.operation.expectedTurn,
          locale: stored.locale, text: participant.text, model: participant.transcription.model, requestId: participant.transcription.requestId,
        }, confirmation.proof, confirmation.expiresAt)) return failure("V3_VOICE_CONFIRMATION_INVALID", "Record again or send an edited reply as typed text.", 400);
      } else if (input.confirmation) return failure("V3_INVALID_REQUEST", "Only unchanged recorded replies use voice confirmation.", 400);
      const claim = await claimTurn(client, secret!, input.operation);
      if (claim.kind !== "claimed") return stateResponse(claim.session, mode!);
      const prepared = await prepareConversationTurn(claim.session, input.operation, deps.gateway(client, { sessionId: sessionId!, turnOperationId: input.operation.operationId }), {
        source: mode === "fixture" ? "fixture" : "hosted", now: Date.now(), signal: request.signal,
        assertActive: () => assertActiveTurn(client, { sessionId: sessionId!, turnOperationId: input.operation.operationId }),
      });
      return stateResponse(await commitTurn(client, secret!, input.operation.operationId, prepared.session), mode!, prepared.status, prepared.callerSource);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "V3_SESSION_NOT_FOUND") return failure(code, "Start a practice call to continue.", 401);
      if (["V3_STALE_TURN", "V3_OPERATION_CONFLICT", "V3_OPERATION_IN_PROGRESS", "V3_OPERATION_UNCERTAIN", "V3_LEASE_LOST"].includes(code)) {
        return failure(code, "This call changed. End it or start a new practice call.", 409);
      }
      if (error instanceof SyntaxError || code === "V3_INVALID_OPERATION" || code === "V3_INVALID_STATE") return failure("V3_INVALID_REQUEST", "Could not read that request.", 400);
      return failure("V3_UNAVAILABLE", "The practice call is temporarily unavailable. You can still end it.", 503, true);
    }
  };
}
