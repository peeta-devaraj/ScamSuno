import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { locales } from "../../domain/scenario";
import { LIMITS } from "../../domain/v2/contracts";

export const VOICE_PROOF_TTL_MS = 120_000;
const ContextSchema = z.object({
  sessionId: z.uuid(), expectedTurn: z.number().int().min(0).max(LIMITS.turns), locale: z.enum(locales),
  // Only outer whitespace and canonical Unicode normalization are interchangeable.
  // Quotes, refusal words, inner whitespace and number formatting remain bound.
  text: z.string().transform((text) => text.trim().normalize("NFC"))
    .pipe(z.string().min(1).max(LIMITS.replyChars)),
  model: z.string().regex(/^(?:gnani-)?prisma-v(?:3\.0|2\.5)$/),
  requestId: z.string().regex(/^[\w-]{1,128}$/),
}).strict();
export type VoiceProofContext = z.infer<typeof ContextSchema>;
const secretShape = /^[a-f0-9]{64}$/;
const proofShape = /^[a-f0-9]{64}$/;
const validClock = (now: number) => Number.isSafeInteger(now) && now >= 0 &&
  now <= Number.MAX_SAFE_INTEGER - VOICE_PROOF_TTL_MS;

export class VoiceProofError extends Error {
  readonly code = "V2_INVALID_VOICE_CONTEXT";
  constructor() { super("V2_INVALID_VOICE_CONTEXT"); this.name = "VoiceProofError"; }
}

export function voiceProofReady() {
  return secretShape.test(process.env.V2_VOICE_PROOF_SECRET ?? "");
}

function checked(secret: string, candidate: VoiceProofContext, signingSecret: string | undefined) {
  if (typeof secret !== "string" || !secretShape.test(secret) ||
      typeof signingSecret !== "string" || !secretShape.test(signingSecret) || signingSecret === secret) return null;
  const context = ContextSchema.safeParse(candidate);
  // The owner cookie is known to its recipient. Bind it with a server-only key;
  // possession of a valid session must never permit forging STT provenance.
  const key = createHmac("sha256", Buffer.from(signingSecret, "hex")).update(`scamsuno-v2-voice-owner:${secret}`).digest();
  return context.success ? { key, context: context.data } : null;
}

function signature(key: Buffer, context: VoiceProofContext, expiresAt: number) {
  return createHmac("sha256", key).update(JSON.stringify([
    "scamsuno-v2-voice-proof", 2, context.sessionId, context.expectedTurn, context.locale,
    context.text, context.model, context.requestId, expiresAt,
  ])).digest();
}

/** A dedicated server-only signing key and the owner bind the short-lived proof. */
export function mintVoiceProof(secret: string, context: VoiceProofContext, now = Date.now(), signingSecret = process.env.V2_VOICE_PROOF_SECRET) {
  try {
    const input = checked(secret, context, signingSecret);
    if (!input || !validClock(now)) throw new VoiceProofError();
    const expiresAt = now + VOICE_PROOF_TTL_MS;
    return { proof: signature(input.key, input.context, expiresAt).toString("hex"), expiresAt };
  } catch { throw new VoiceProofError(); }
}

export function verifyVoiceProof(
  secret: string, context: VoiceProofContext, proof: string, expiresAt: number, now = Date.now(), signingSecret = process.env.V2_VOICE_PROOF_SECRET,
): boolean {
  try {
    if (!validClock(now) || !Number.isSafeInteger(expiresAt) || expiresAt <= now ||
        expiresAt > now + VOICE_PROOF_TTL_MS || typeof proof !== "string" || !proofShape.test(proof)) return false;
    const input = checked(secret, context, signingSecret);
    if (!input) return false;
    return timingSafeEqual(Buffer.from(proof, "hex"), signature(input.key, input.context, expiresAt));
  } catch { return false; }
}
