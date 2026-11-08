import { z } from "zod";
import { locales } from "../../domain/scenario";
import { EndingSchema, PublicSessionSchema, V3_LIMITS } from "../../domain/v3/contracts";
import { getScenario, scenarioIds } from "./scenarios";

const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const turn = z.number().int().min(1).max(V3_LIMITS.turns);
const origin = z.enum(["voice", "typed", "button"]);
export const ObservationSchema = z.object({ turn, origin,
  kind: z.enum(["boundary", "verification_intent", "question", "harmless_acknowledgement", "unsafe_commitment", "exit", "uncertain"]),
  evidence: z.string().max(V3_LIMITS.replyChars),
}).strict();
export type Observation = z.infer<typeof ObservationSchema>;
export const InternalSessionSchema = z.object({
  v: z.literal(3), mode: z.literal("trust-or-trap"), sessionId: z.uuid(), locale: z.enum(locales),
  turn: z.number().int().min(0).max(V3_LIMITS.turns), createdAt: time, updatedAt: time, expiresAt: time,
  ending: EndingSchema, lastCaller: z.string().trim().min(1).max(V3_LIMITS.callerChars), scenarioId: z.enum(scenarioIds),
  history: z.array(z.object({ turn, caller: z.string().max(V3_LIMITS.callerChars), participant: z.string().max(V3_LIMITS.replyChars), origin }).strict()).max(V3_LIMITS.history),
  observations: z.array(ObservationSchema).max(V3_LIMITS.turns * 4), verificationState: z.enum(["unchecked", "checked"]),
}).strict().superRefine((s, ctx) => {
  if (s.expiresAt !== s.createdAt + V3_LIMITS.sessionMs || s.updatedAt < s.createdAt ||
      s.history.length !== Math.min(s.turn, V3_LIMITS.history) ||
      s.history.some((h, i) => h.turn !== s.turn - s.history.length + i + 1) || s.observations.some((o) => o.turn > s.turn)) {
    ctx.addIssue({ code: "custom", message: "Inconsistent stored session" });
  }
});
export type StoredSession = z.infer<typeof InternalSessionSchema>;

/** Allowlist projection: hidden assignment, history and evaluation never cross this boundary. */
export function projectPublicSession(state: StoredSession) {
  const s = InternalSessionSchema.parse(state);
  return PublicSessionSchema.parse({ v: s.v, mode: s.mode, sessionId: s.sessionId, locale: s.locale,
    turn: s.turn, createdAt: s.createdAt, updatedAt: s.updatedAt, expiresAt: s.expiresAt,
    ending: s.ending, lastCaller: s.lastCaller,
    verification: s.verificationState === "checked" ? { checked: true, ...getScenario(s.scenarioId, s.locale).verification } : { checked: false },
  });
}
