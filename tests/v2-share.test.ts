import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { start, step } from "../src/domain/engine";
import { locales, SCENARIO, type Locale } from "../src/domain/scenario";
import { copy } from "../src/domain/copy";
import { decodeShare, encodeConversationShare, encodeShare, outcomeLabel, outcomeNames, shareStats } from "../src/domain/share";
import { advanceConversation, conversationScore, startConversation } from "../src/domain/v2/controller";
import { SCENARIO_V2, type ConversationSession, type Reply } from "../src/domain/v2/contracts";
import { GET as card } from "../app/api/card/route";

const now = 1_800_000_000_000;
const token = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
function apply(session: ConversationSession, reply: Reply, intent = "ACKNOWLEDGE", verify = false) {
  return advanceConversation(session, { sessionId: session.sessionId, operationId: randomUUID(), expectedTurn: session.turn, reply },
    { intent, verify, confidence: 0.99, evidence: reply.origin === "button" ? "" : reply.text }, "fixture", session.updatedAt + 1);
}
function initial(locale: Locale = "en") { return startConversation(randomUUID(), locale, now); }
function practice(locale: Locale = "en") {
  return apply(apply(initial(locale), { origin: "button", id: "continue" }), { origin: "button", id: "continue" });
}
function disclosed(locale: Locale = "en") {
  return apply(practice(locale), { origin: "typed", text: "482197" }, "COMPLY");
}

test("V1 share encoding, labels and tested-only point totals retain their exact contract", () => {
  const session = step(start("v1-private-id", "en"), { intent: "HANG_UP", verify: false, confidence: 1,
    evidence: "private reply", source: "button", reasons: [], degraded: false }, { inputMode: "button", text: "hang_up" });
  const expected = { v: 1, s: SCENARIO, l: "en", o: "END_SAFE", c: ["NOT_TESTED", "NOT_TESTED", "PASS"] };
  assert.equal(encodeShare(session), token(expected));
  assert.deepEqual(decodeShare(encodeShare(session)), expected);
  assert.deepEqual(outcomeNames, { END_SAFE: "Ended safely", END_VERIFIED: "Verified independently",
    END_SCAMMED: "Fell for the simulation", END_INCOMPLETE: "No clear decision" });
  const decoded = decodeShare(encodeShare(session))!;
  assert.deepEqual(shareStats(decoded), { earned: 15, possible: 15, criteria: [
    { name: "Protect your code", grade: "Not tested" }, { name: "Verify independently", grade: "Not tested" },
    { name: "End the call safely", grade: "Passed" },
  ] });
  for (const locale of locales) {
    const localized = decodeShare(token({ ...expected, l: locale }))!;
    assert.equal(outcomeLabel(localized), locale === "en" ? outcomeNames.END_SAFE : copy[locale].END_SAFE);
    assert.equal(shareStats(localized).criteria[0].name, "Protect your code", "V1 card criteria remain English");
  }
});

test("V2 round trips only version, scenario, locale, terminal and three enum grades", () => {
  for (const locale of locales) {
    const session = disclosed(locale);
    assert.equal(session.ending, "practice_disclosed");
    const encoded = encodeConversationShare(session);
    const decoded = decodeShare(encoded);
    assert.deepEqual(decoded, { v: 2, s: SCENARIO_V2, l: locale, o: "END_SCAMMED", c: ["FAIL", "NOT_TESTED", "FAIL"] });
    assert.ok(encoded.length <= 256);
    assert.deepEqual(Object.keys(decoded!).sort(), ["c", "l", "o", "s", "v"]);
  }
});

test("V2 shares use the conversation score and exclude untested criteria from every denominator", () => {
  const early = apply(initial(), { origin: "button", id: "end" });
  const verified = apply(initial(), { origin: "button", id: "verify" });
  const questioned = apply(apply(initial(), { origin: "typed", text: "Who are you?" }, "QUESTION"), { origin: "button", id: "end" });
  const refused = apply(apply(practice(), { origin: "button", id: "refuse" }), { origin: "button", id: "refuse" });
  for (const [session, expected] of [[early, [15, 15]], [verified, [40, 40]], [questioned, [25, 40]],
    [refused, [48, 55]], [disclosed(), [0, 55]]] as const) {
    const score = conversationScore(session);
    const stats = shareStats(decodeShare(encodeConversationShare(session))!);
    assert.deepEqual([stats.earned, stats.possible], expected);
    assert.deepEqual([stats.earned, stats.possible], [score.earned, score.possible]);
  }
});

test("all supported V2 endings map to the established terminal enum without diagnostic claims", () => {
  const participant = apply(initial(), { origin: "button", id: "end" });
  const refused = apply(apply(initial(), { origin: "button", id: "refuse" }), { origin: "button", id: "refuse" });
  const verified = apply(initial(), { origin: "button", id: "verify" });
  let limit = initial(); for (let i = 0; i < 10; i++) limit = apply(limit, { origin: "button", id: "continue" });
  let uncertain = initial(); for (let i = 0; i < 3; i++) uncertain = apply(uncertain, { origin: "typed", text: "..." }, "UNCLEAR");
  const opening = initial();
  const expired = advanceConversation(opening, { sessionId: opening.sessionId, operationId: randomUUID(), expectedTurn: 0,
    reply: { origin: "typed", text: "Are you there?" } }, null, "fixture", opening.expiresAt);
  for (const [session, outcome] of [[participant, "END_SAFE"], [refused, "END_SAFE"], [verified, "END_VERIFIED"],
    [disclosed(), "END_SCAMMED"], [limit, "END_INCOMPLETE"], [uncertain, "END_INCOMPLETE"], [expired, "END_INCOMPLETE"]] as const) {
    assert.equal(decodeShare(encodeConversationShare(session))?.o, outcome);
  }
  assert.throws(() => encodeConversationShare(initial()), /^Error: V2_SHARE_NOT_READY$/);
});

test("strict decoding rejects private additions, invalid enums, mixed versions and malformed tokens", () => {
  const valid = { v: 2, s: SCENARIO_V2, l: "ta", o: "END_SAFE", c: ["NOT_TESTED", "NOT_TESTED", "PASS"] };
  for (const changed of [{ v: 3 }, { s: SCENARIO }, { l: "private-locale" }, { o: "You were scammed" },
    { c: ["NOT_TESTED", "NOT_TESTED", "secret reply"] }, { c: ["PASS", "PASS"] }, { c: ["MISSED", "PASS", "PASS"] },
    ...["text", "transcript", "sessionId", "requestId", "model", "voice", "origin", "proof", "audio", "history", "source", "confidence"]
      .map((name) => ({ [name]: "private fixture value" }))]) {
    assert.equal(decodeShare(token({ ...valid, ...changed })), null);
  }
  for (const bad of [null, "", "!invalid", "x".repeat(257), token(null), token([valid]), token({ ...valid, v: 1 }), token({ transcript: "private" })]) {
    assert.equal(decodeShare(bad), null);
  }
});

test("sharing excludes replies, caller history, voice evidence, source and identity in every input mode", () => {
  const text = "I am hanging up. My private reference is 482197.";
  const replies: Reply[] = [{ origin: "button", id: "end" }, { origin: "typed", text },
    { origin: "voice", text, transcription: { provider: "gnani", model: "prisma-v3.0", requestId: "private-provider-request", confirmed: true } }];
  const shared = replies.map((reply) => {
    const session = apply(initial(), reply, "HANG_UP");
    const encoded = encodeConversationShare(session);
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    for (const privateValue of [text, "482197", session.sessionId, "private-provider-request", "prisma", "gnani", "voice", "typed", "button", "fixture"]) {
      assert.equal(raw.includes(privateValue), false);
    }
    return encoded;
  });
  assert.equal(new Set(shared).size, 1, "equivalent training grades share identically across reply origins");
});

test("V2 practice outcomes and criterion grades are localized in all four languages", () => {
  const expected = { en: "Shared practice code", hi: "अभ्यास का कोड साझा किया",
    ta: "பயிற்சிக் குறியீட்டைப் பகிர்ந்தீர்கள்", te: "సాధన కోడ్‌ను పంచుకున్నారు" };
  for (const locale of locales) {
    const decoded = decodeShare(encodeConversationShare(disclosed(locale)))!;
    assert.equal(outcomeLabel(decoded), expected[locale]);
    assert.equal(shareStats(decoded).criteria[0].name, copy[locale].protect_secrets);
    assert.equal(shareStats(decoded).criteria[0].grade, copy[locale].FAIL);
    assert.equal(shareStats(decoded).criteria[1].grade, copy[locale].NOT_TESTED);
    assert.ok(copy[locale].ribbon.length > 0);
    assert.ok(copy[locale].bank.length > 0);
  }
});

test("both V1 and V2 cards render actual compatible 1200 by 630 PNG responses", { timeout: 20_000 }, async (t) => {
  const previous = process.env.GNANI_MODE;
  process.env.GNANI_MODE = "live";
  t.after(() => { if (previous === undefined) delete process.env.GNANI_MODE; else process.env.GNANI_MODE = previous; });
  const values = [token({ v: 1, s: SCENARIO, l: "en", o: "END_SAFE", c: ["NOT_TESTED", "NOT_TESTED", "PASS"] }),
    encodeConversationShare(disclosed())];
  for (const value of values) {
    const response = card(new Request(`https://preview.invalid/api/card?t=${value}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1200, 630]);
    assert.ok(bytes.byteLength > 1024);
  }
});
