import { z } from "zod";
import { locales, intents } from "../scenario";

/** These contracts belong to the isolated V2 path. They do not change V1 sessions. */
export const LIMITS = Object.freeze({
  turns: 10, sessionMs: 8 * 60_000, history: 6, replyChars: 500, callerChars: 420,
});
export const SCENARIO_V2 = "kalpanik_practice_v2" as const;
export const phases = ["opening", "pressure", "practice_code", "ended"] as const;
export const endings = ["participant", "verified", "refused", "practice_disclosed", "limit", "uncertain", "expired"] as const;
export const criteria = ["protect_secrets", "verify_independently", "exit_safely"] as const;
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().trim().min(1).max(LIMITS.replyChars);

export const ReplySchema = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("typed"), text }).strict(),
  z.object({ origin: z.literal("voice"), text, transcription: z.object({
    provider: z.literal("gnani"), model: z.string().min(1).max(80),
    requestId: z.string().regex(/^[\w-]{1,128}$/), confirmed: z.literal(true),
  }).strict() }).strict(),
  z.object({ origin: z.literal("button"), id: z.enum(["refuse", "verify", "end", "continue"]) }).strict(),
]);
export type Reply = z.infer<typeof ReplySchema>;

/** Provider output is untrusted until checked against the actual participant reply. */
export const EvaluationSchema = z.object({
  intent: z.enum(intents), verify: z.boolean(), confidence: z.number().min(0).max(1),
  evidence: z.string().max(LIMITS.replyChars),
}).strict();
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type Assessment = Evaluation & {
  source: "hosted" | "button" | "guard" | "fixture";
  reason: "supported" | "uncertain" | "invalid_output" | "unsupported_evidence" | "ambiguous_disclosure";
};

export const DialogueSchema = z.object({
  locale: z.enum(locales), text: z.string().trim().min(1).max(LIMITS.callerChars),
  action: z.enum(["continue", "close"]),
}).strict();
export type Dialogue = z.infer<typeof DialogueSchema>;
export type ApprovedDialogue = Dialogue & { source: "hosted" | "authored_fallback" | "fixture" };

const assessment = EvaluationSchema.extend({
  source: z.enum(["hosted", "button", "guard", "fixture"]),
  reason: z.enum(["supported", "uncertain", "invalid_output", "unsupported_evidence", "ambiguous_disclosure"]),
}).strict();
export const SessionSchema = z.object({
  v: z.literal(2), scenarioId: z.literal(SCENARIO_V2), sessionId: z.uuid(), locale: z.enum(locales),
  createdAt: timestamp, updatedAt: timestamp, expiresAt: timestamp,
  turn: z.number().int().min(0).max(LIMITS.turns), phase: z.enum(phases),
  ending: z.enum(endings).nullable(), refusals: z.number().int().min(0).max(2),
  unclear: z.number().int().min(0).max(3),
  history: z.array(z.object({
    turn: z.number().int().min(1).max(LIMITS.turns), phase: z.enum(phases).exclude(["ended"]),
    caller: z.string().max(LIMITS.callerChars), participant: z.string().max(LIMITS.replyChars),
    origin: z.enum(["voice", "typed", "button"]),
  }).strict()).max(LIMITS.history),
  observations: z.array(z.object({
    turn: z.number().int().min(1).max(LIMITS.turns), demandActive: z.boolean(),
    origin: z.enum(["voice", "typed", "button"]), assessment,
  }).strict()).max(LIMITS.turns),
  lastCaller: z.string().min(1).max(LIMITS.callerChars),
}).strict().superRefine((s, ctx) => {
  if (s.expiresAt !== s.createdAt + LIMITS.sessionMs || s.updatedAt < s.createdAt ||
      (s.phase === "ended") !== (s.ending !== null) || s.observations.length !== s.turn ||
      s.history.length !== Math.min(s.turn, LIMITS.history) ||
      s.observations.some((o, i) => o.turn !== i + 1) ||
      s.history.some((h, i) => h.turn !== s.turn - s.history.length + i + 1)) {
    ctx.addIssue({ code: "custom", message: "Inconsistent conversation state" });
  }
});
export type ConversationSession = z.infer<typeof SessionSchema>;

/** Persistence must own this envelope; accepting a browser-supplied session is forbidden. */
export const OperationSchema = z.object({
  sessionId: z.uuid(), operationId: z.uuid(), expectedTurn: z.number().int().min(0).max(LIMITS.turns),
  reply: ReplySchema,
}).strict();
export type TurnOperation = z.infer<typeof OperationSchema>;
