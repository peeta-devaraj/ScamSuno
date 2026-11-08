import { z } from "zod";
import { locales } from "../scenario";

// Types erase at build time. Scenario records and assignment live only on the server.
export type ScenarioId = "routine_update" | "kyc_pressure" | "unverified_notice";
export const V3_LIMITS = Object.freeze({ turns: 10, history: 6, replyChars: 500, callerChars: 420, sessionMs: 480_000 });
export const EndingSchema = z.enum(["participant", "verified", "refused", "limit", "expired", "uncertain"]).nullable();
export const VerificationFindingSchema = z.enum(["corroborated", "contradicted", "inconclusive"]);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const PublicSessionSchema = z.object({
  v: z.literal(3), mode: z.literal("trust-or-trap"), sessionId: z.uuid(), locale: z.enum(locales),
  turn: z.number().int().min(0).max(V3_LIMITS.turns), createdAt: time, updatedAt: time, expiresAt: time,
  ending: EndingSchema, lastCaller: z.string().trim().min(1).max(V3_LIMITS.callerChars),
  verification: z.discriminatedUnion("checked", [
    z.object({ checked: z.literal(false) }).strict(),
    z.object({ checked: z.literal(true), finding: VerificationFindingSchema,
      message: z.string().min(1).max(1200) }).strict(),
  ]),
}).strict().superRefine((s, ctx) => {
  if (s.expiresAt !== s.createdAt + V3_LIMITS.sessionMs || s.updatedAt < s.createdAt) {
    ctx.addIssue({ code: "custom", message: "Inconsistent public session" });
  }
});
export type PublicSession = z.infer<typeof PublicSessionSchema>;
