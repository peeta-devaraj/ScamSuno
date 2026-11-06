import { createHmac, timingSafeEqual } from "node:crypto";
import { mockMode, speechKey } from "./gnani/client";
import type { SttMetadata } from "../domain/engine";
import type { Locale } from "../domain/scenario";

function mac(locale: Locale, text: string, stt: SttMetadata, expiry: number) {
  const key = speechKey() || (mockMode() ? "scamsuno-local-mock-only" : "");
  if (!key) return null;
  return createHmac("sha256", key).update(JSON.stringify([
    "scamsuno-stt-v1", locale, text, stt.model, stt.gnaniRequestId, stt.detectedLanguage ?? null, stt.usedFallback, expiry,
  ])).digest("base64url");
}

export function mintProof(locale: Locale, text: string, stt: SttMetadata) {
  const expiry = Date.now() + 15 * 60_000;
  return `${expiry}.${mac(locale, text, stt, expiry)}`;
}

export function verifyProof(proof: string, locale: Locale, text: string, stt: SttMetadata) {
  const [time, signature, ...rest] = proof.split(".");
  const expiry = Number(time);
  if (rest.length || !signature || !Number.isSafeInteger(expiry) || expiry < Date.now()) return false;
  const expected = mac(locale, text, stt, expiry);
  return expected !== null && signature.length === expected.length &&
    /^[\w-]+$/.test(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
