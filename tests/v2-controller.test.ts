import assert from "node:assert/strict";
import test from "node:test";
import { LIMITS, SessionSchema, type ConversationSession, type Reply } from "../src/domain/v2/contracts";
import { advanceConversation, attachCaller, conversationScore, startConversation } from "../src/domain/v2/controller";

const now = 1_800_000_000_000;
const id = "417731f7-4d75-480b-b42c-64335678b326";
const operationId = "86b60bf5-545c-4fb8-b084-558d48bfce6b";
function apply(s: ConversationSession, reply: Reply, intent = "ACKNOWLEDGE", verify = false, evidence?: string) {
  return advanceConversation(s, { sessionId: id, operationId, expectedTurn: s.turn, reply },
    { intent, verify, confidence: 0.99, evidence: evidence ?? (reply.origin === "button" ? "" : reply.text) },
    "fixture", now + s.turn + 1);
}
function demand() {
  let s = startConversation(id, "en", now);
  s = apply(s, { origin: "typed", text: "I'm listening." });
  return apply(s, { origin: "typed", text: "What is this about?" }, "QUESTION");
}

test("V2 sessions are versioned and localized without touching V1 shapes", () => {
  for (const locale of ["ta", "te", "en", "hi"] as const) {
    const s = startConversation(id, locale, now);
    assert.equal(s.v, 2);
    assert.equal(s.locale, locale);
    assert.equal(s.phase, "opening");
    assert.equal(s.expiresAt, now + LIMITS.sessionMs);
    assert.ok(s.lastCaller.length > 30);
    assert.deepEqual(conversationScore(s), {
      criteria: [
        { id: "protect_secrets", status: "NOT_TESTED", points: 0, max: 40, evidenceTurns: [] },
        { id: "verify_independently", status: "NOT_TESTED", points: 0, max: 25, evidenceTurns: [] },
        { id: "exit_safely", status: "NOT_TESTED", points: 0, max: 15, evidenceTurns: [] },
      ], tested: 0, possible: 0, earned: 0, educationalOnly: true,
    });
  }
});

test("stale operations, inconsistent envelopes and ended sessions fail before advancing", () => {
  const s = startConversation(id, "en", now);
  const operation = { sessionId: id, operationId, expectedTurn: 1, reply: { origin: "typed", text: "hello" } } as const;
  assert.throws(() => advanceConversation(s, operation, null, "fixture", now), /STALE_TURN/);
  assert.throws(() => advanceConversation({ ...s, turn: 4 }, operation, null, "fixture", now), /INVALID_SESSION/);
  assert.throws(() => advanceConversation(s, { ...operation, expectedTurn: 0, operationId: "bad" }, null, "fixture", now), /INVALID_OPERATION/);
  const ended = apply(s, { origin: "button", id: "end" });
  assert.equal(ended.ending, "participant");
  assert.throws(() => apply(ended, { origin: "typed", text: "hello" }), /SESSION_ENDED/);
  assert.equal(s.turn, 0);
});

test("expiration does not score the reply or continue a session", () => {
  const s = startConversation(id, "ta", now);
  const expired = advanceConversation(s, { sessionId: id, operationId, expectedTurn: 0,
    reply: { origin: "button", id: "continue" } }, null, "fixture", s.expiresAt);
  assert.equal(expired.ending, "expired");
  assert.equal(expired.turn, 0);
  assert.equal(conversationScore(expired).possible, 0);
  assert.ok(SessionSchema.safeParse(expired).success);
});

test("quoted codes and refusals cannot become disclosure despite a COMPLY model result", () => {
  for (const text of ['"482197"', "I will not share 482197", "Did you ask for 482197?", "நான் 482197 சொல்ல மாட்டேன்", "నేను 482197 చెప్పను"]) {
    const s = apply(demand(), { origin: "typed", text }, "COMPLY");
    assert.equal(s.ending, null, text);
    assert.equal(s.observations.at(-1)?.assessment.intent, "UNCLEAR", text);
    assert.equal(conversationScore(s).criteria[0].status, "NOT_TESTED", text);
    assert.ok(!JSON.stringify(s).includes("482197"));
  }
  const early = apply(startConversation(id, "en", now), { origin: "typed", text: "482197" }, "COMPLY");
  assert.equal(early.ending, null);
});

test("a positive safety outcome requires observed evidence; early exit leaves secret criterion untested", () => {
  const earlyExit = apply(startConversation(id, "en", now), { origin: "button", id: "end" });
  const score = conversationScore(earlyExit);
  assert.equal(score.criteria[0].status, "NOT_TESTED");
  assert.equal(score.criteria[1].status, "NOT_TESTED");
  assert.equal(score.criteria[2].status, "PASS");
  assert.equal(score.possible, 15);
  const refusal = apply(demand(), { origin: "typed", text: "I refuse to share a code." }, "REFUSE");
  assert.equal(conversationScore(refusal).criteria[0].status, "PASS");
  const ended = apply(refusal, { origin: "button", id: "verify" });
  assert.equal(ended.ending, "verified");
  assert.equal(conversationScore(ended).earned, conversationScore(ended).possible);
});

test("uncertain evidence is unscored and stops after three unresolved replies", () => {
  let s = startConversation(id, "te", now);
  for (let i = 0; i < 3; i++) s = apply(s, { origin: "typed", text: "unrelated joke" }, "UNCLEAR");
  assert.equal(s.ending, "uncertain");
  assert.equal(conversationScore(s).possible, 0);
});

test("bounded memory masks participant and evaluator numbers and retains reply origin", () => {
  let s = startConversation(id, "ta", now);
  for (let i = 0; i < 8; i++) {
    s = apply(s, { origin: "voice", text: `I have a question about 482197.`, transcription: {
      provider: "gnani", model: "prisma-v3.0", requestId: `fixture-${i}`, confirmed: true,
    } }, "QUESTION");
  }
  assert.equal(s.history.length, LIMITS.history);
  assert.equal(s.history[0].turn, 3);
  assert.equal(s.history.at(-1)?.origin, "voice");
  assert.equal(s.observations.at(-1)?.origin, "voice");
  assert.ok(!JSON.stringify(s).includes("482197"));
  assert.ok(!JSON.stringify(s).includes("fixture-7"));
  s = apply(s, { origin: "button", id: "continue" });
  s = apply(s, { origin: "button", id: "continue" });
  assert.equal(s.turn, LIMITS.turns);
  assert.equal(s.ending, "limit");
});

test("generated dialogue cannot replace trusted challenge, change scores or bypass validation", () => {
  const s = demand();
  const invalid = attachCaller(s, { locale: "en", text: "Visit https://fraud.invalid and send a payment.", action: "continue" }, "fixture");
  assert.equal(invalid.source, "authored_fallback");
  assert.equal(invalid.session.lastCaller, s.lastCaller);
  const valid = attachCaller(s, { locale: "en", text: "You sound unsure. What concerns you about this call?", action: "continue" }, "fixture");
  assert.equal(valid.source, "fixture");
  assert.ok(valid.session.lastCaller.includes("made-up practice code"));
  assert.deepEqual(valid.session.observations, s.observations);
  assert.equal(valid.session.phase, s.phase);
  assert.equal(attachCaller(s, { locale: "hi", text: "आपको क्या चिंता है?", action: "continue" }, "fixture").source, "authored_fallback");
  const ended = apply(s, { origin: "button", id: "end" });
  assert.deepEqual(attachCaller(ended, { locale: "en", text: "Continue the call.", action: "continue" }, "fixture").session, ended);
});
