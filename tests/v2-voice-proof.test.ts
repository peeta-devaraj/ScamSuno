import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, after } from "node:test";

// Dedicated synthetic server signing key; never a provider credential.
const previousProofKey = process.env.V2_VOICE_PROOF_SECRET;
before(() => { process.env.V2_VOICE_PROOF_SECRET = "c".repeat(64); });
after(() => { if (previousProofKey === undefined) delete process.env.V2_VOICE_PROOF_SECRET; else process.env.V2_VOICE_PROOF_SECRET = previousProofKey; });
import test from "node:test";
import { mintVoiceProof, verifyVoiceProof, VOICE_PROOF_TTL_MS, VoiceProofError,
  type VoiceProofContext } from "../src/server/v2/voice-proof";

// Synthetic session-owner secrets only; no provider credential is used by these tests.
const secret = "a".repeat(64);
const now = 1_800_000_000_000;
const context = (changes: Partial<VoiceProofContext> = {}): VoiceProofContext => ({
  sessionId: "2374ab2c-e963-49db-bba8-4a7617154371", expectedTurn: 0, locale: "en",
  text: "I will not share that code.", model: "prisma-v3.0", requestId: "fixture-request-001", ...changes,
});

test("voice confirmation proofs bind actual transcripts in all four supported locales", () => {
  const replies = { en: "I will not share ‘482197’.", hi: "मैं ‘४८२१९७’ नहीं बताऊँगी।",
    ta: "நான் ‘௪௮௨௧௯௭’ சொல்ல மாட்டேன்.", te: "నేను ‘౪౮౨౧౯౭’ చెప్పను." };
  for (const locale of ["ta", "te", "en", "hi"] as const) {
    const input = context({ locale, text: replies[locale] });
    const minted = mintVoiceProof(secret, input, now);
    assert.match(minted.proof, /^[a-f0-9]{64}$/);
    assert.equal(minted.expiresAt, now + 120_000);
    assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, now), true);
    assert.equal(mintVoiceProof(secret, input, now).proof, minted.proof);
  }
});

test("wrong owner, session, turn, locale, transcript or Prisma metadata invalidates the proof", () => {
  const input = context(), minted = mintVoiceProof(secret, input, now);
  assert.equal(verifyVoiceProof("b".repeat(64), input, minted.proof, minted.expiresAt, now), false);
  for (const modified of [
    context({ sessionId: "4d137c3f-2cab-4417-9018-343b91d5532f" }), context({ expectedTurn: 1 }),
    context({ locale: "te" }), context({ text: "I will share that code." }),
    context({ model: "prisma-v2.5" }), context({ model: "gnani-prisma-v3.0" }), context({ requestId: "fixture-request-002" }),
  ]) assert.equal(verifyVoiceProof(secret, modified, minted.proof, minted.expiresAt, now), false);
  assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt - 1, now), false);
  assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt + 1, now + 1), false);
});

test("proof normalization preserves quotes, refusals, inner spacing and unmasked numbers", () => {
  const input = context({ text: "I will not share ‘482197’." });
  const minted = mintVoiceProof(secret, input, now);
  for (const text of ["482197", "I will share ‘482197’.", "I will not share 482197.",
    "I will not share ‘••••••’.", "I  will not share ‘482197’.", "I will not share ‘482198’."]) {
    assert.equal(verifyVoiceProof(secret, context({ text }), minted.proof, minted.expiresAt, now), false, text);
  }
  assert.equal(verifyVoiceProof(secret, context({ text: " \nI will not share ‘482197’.\t " }), minted.proof, minted.expiresAt, now), true);
  const decomposed = context({ text: "  cafe\u0301  " });
  const canonical = context({ text: "café" });
  const unicode = mintVoiceProof(secret, decomposed, now);
  assert.equal(verifyVoiceProof(secret, canonical, unicode.proof, unicode.expiresAt, now), true);
  const internal = context({ text: "I will\nnot share." });
  const lineProof = mintVoiceProof(secret, internal, now);
  assert.equal(verifyVoiceProof(secret, context({ text: "I will not share." }), lineProof.proof, lineProof.expiresAt, now), false);
});

test("proof TTL rejects expiration, future dates beyond the bound and invalid clocks", () => {
  const input = context(), minted = mintVoiceProof(secret, input, now);
  assert.equal(VOICE_PROOF_TTL_MS, 120_000);
  assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, minted.expiresAt - 1), true);
  assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, minted.expiresAt), false);
  assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, minted.expiresAt + 1), false);
  const future = mintVoiceProof(secret, input, now + 1);
  assert.equal(verifyVoiceProof(secret, input, future.proof, future.expiresAt, now), false);
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, now + 0.5]) {
    assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, invalid), false);
    assert.throws(() => mintVoiceProof(secret, input, invalid), { code: "V2_INVALID_VOICE_CONTEXT" });
  }
  for (const expiresAt of [-1, Number.NaN, Number.POSITIVE_INFINITY, minted.expiresAt + 0.5]) {
    assert.equal(verifyVoiceProof(secret, input, minted.proof, expiresAt, now), false);
  }
});

test("only known Prisma models, canonical identifiers and bounded confirmation contexts are signed", () => {
  for (const model of ["prisma-v3.0", "prisma-v2.5", "gnani-prisma-v3.0", "gnani-prisma-v2.5"]) {
    const input = context({ model, expectedTurn: 10, text: "x".repeat(500), requestId: "r".repeat(128) });
    const minted = mintVoiceProof(secret, input, now);
    assert.equal(verifyVoiceProof(secret, input, minted.proof, minted.expiresAt, now), true);
  }
  for (const input of [null, {}, { ...context(), extra: "not allowed" }, context({ sessionId: "bad" }),
    context({ expectedTurn: -1 }), context({ expectedTurn: 11 }), context({ expectedTurn: 0.5 }),
    context({ locale: "fr" as VoiceProofContext["locale"] }), context({ text: " \n\t " }), context({ text: "x".repeat(501) }),
    context({ model: "unverified-model" }), context({ requestId: "" }), context({ requestId: "r".repeat(129) }),
    context({ requestId: "id\nprivate" }), context({ requestId: "https://example.invalid" })]) {
    assert.throws(() => mintVoiceProof(secret, input as VoiceProofContext, now), { code: "V2_INVALID_VOICE_CONTEXT" });
    assert.equal(verifyVoiceProof(secret, input as VoiceProofContext, "a".repeat(64), now + VOICE_PROOF_TTL_MS, now), false);
  }
});

test("bad proof/key shapes fail closed and invalid mint errors expose no sensitive context", () => {
  const input = context(), minted = mintVoiceProof(secret, input, now);
  for (const proof of ["", "a".repeat(63), "a".repeat(65), "z".repeat(64), minted.proof.toUpperCase(),
    `${minted.proof}\n`, null, 42, {}]) {
    assert.equal(verifyVoiceProof(secret, input, proof as string, minted.expiresAt, now), false);
  }
  for (const key of ["", "a".repeat(63), "a".repeat(65), "z".repeat(64), `${secret}\n`, null]) {
    assert.equal(verifyVoiceProof(key as string, input, minted.proof, minted.expiresAt, now), false);
    assert.throws(() => mintVoiceProof(key as string, input, now), (error: unknown) => {
      assert.ok(error instanceof VoiceProofError);
      assert.equal(error.message, "V2_INVALID_VOICE_CONTEXT");
      assert.equal(JSON.stringify(error).includes(input.text), false);
      assert.equal(JSON.stringify(error).includes(secret), false);
      return true;
    });
  }
});

test("knowing the owner cookie cannot forge voice provenance without the server key", () => {
  const input = context(), expiresAt = now + VOICE_PROOF_TTL_MS;
  const legacyForgery = createHmac("sha256", Buffer.from(secret, "hex")).update(JSON.stringify([
    "scamsuno-v2-voice-proof", 2, input.sessionId, input.expectedTurn, input.locale,
    input.text, input.model, input.requestId, expiresAt,
  ])).digest("hex");
  assert.equal(verifyVoiceProof(secret, input, legacyForgery, expiresAt, now), false);
  const wrongServer = mintVoiceProof(secret, input, now, "b".repeat(64));
  assert.equal(verifyVoiceProof(secret, input, wrongServer.proof, expiresAt, now), false);
  for (const signingKey of ["", "bad", secret]) {
    assert.throws(() => mintVoiceProof(secret, input, now, signingKey), VoiceProofError);
    assert.equal(verifyVoiceProof(secret, input, legacyForgery, expiresAt, now, signingKey), false);
  }
});
