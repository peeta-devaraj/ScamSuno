import assert from "node:assert/strict";
import test from "node:test";
import { startConversation, conversationScore } from "../src/domain/v2/controller";
import type { ConversationSession, Reply, TurnOperation } from "../src/domain/v2/contracts";
import { prepareConversationTurn } from "../src/server/v2/conversation";
import type { ConversationGateway, ModelRequest } from "../src/server/v2/caller";

const id = "2374ab2c-e963-49db-bba8-4a7617154371";
const operationId = "4d137c3f-2cab-4417-9018-343b91d5532f";
const now = 1_800_000_000_000;
function operation(s: ConversationSession, reply: Reply): TurnOperation {
  return { sessionId: id, operationId, expectedTurn: s.turn, reply };
}

test("explicit fixtures exercise contextual multi-turn text integration in four locales", async () => {
  const replies = { en: "What is this about?", hi: "यह किस बारे में है?", ta: "இது எதைப் பற்றி?", te: "ఇది దేని గురించి?" };
  const callerText = { en: "You have questions. What would help you decide?", hi: "आपके सवाल हैं। फैसला करने से पहले क्या जानना चाहेंगे?",
    ta: "உங்களுக்கு சந்தேகங்கள் உள்ளன. முடிவு செய்வதற்கு முன் என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?",
    te: "మీకు సందేహాలు ఉన్నాయి. నిర్ణయం తీసుకునే ముందు ఏం తెలుసుకోవాలనుకుంటున్నారు?" };
  for (const locale of ["ta", "te", "en", "hi"] as const) {
    let s = startConversation(id, locale, now);
    const requests: ModelRequest[] = [];
    const gateway: ConversationGateway = { async execute(request) {
      requests.push(request);
      if (request.purpose === "evaluator") {
        const data = JSON.parse(request.messages[1].content);
        return JSON.stringify({ intent: "QUESTION", verify: false, confidence: 0.99, evidence: data.participant_reply.text });
      }
      return JSON.stringify({ locale, action: "continue", text: callerText[locale] });
    } };
    for (let i = 0; i < 2; i++) {
      const result = await prepareConversationTurn(s, operation(s, { origin: "typed", text: replies[locale] }), gateway,
        { source: "fixture", now: now + i + 1 });
      assert.equal(result.session.turn, i + 1);
      assert.equal(result.session.locale, locale);
      assert.equal(result.session.history.at(-1)?.origin, "typed");
      assert.equal(result.session.observations.at(-1)?.assessment.source, "fixture");
      s = result.session;
    }
    assert.equal(s.phase, "practice_code");
    assert.deepEqual(requests.map((r) => r.purpose), ["evaluator", "caller", "evaluator", "caller"]);
    const ended = await prepareConversationTurn(s, operation(s, { origin: "button", id: "end" }), gateway,
      { source: "fixture", now: now + 3 });
    assert.equal(ended.session.ending, "participant");
    assert.equal(requests.length, 4, "hangup must never request another model response");
    assert.equal(conversationScore(ended.session).criteria[0].status, "PASS");
  }
});

test("stale, expired and ended turns do not reach the gateway", async () => {
  let calls = 0;
  const gateway: ConversationGateway = { async execute() { calls++; throw new Error("must not dispatch"); } };
  const s = startConversation(id, "en", now);
  const op = operation(s, { origin: "typed", text: "hello" });
  await assert.rejects(prepareConversationTurn(s, { ...op, expectedTurn: 1 }, gateway, { source: "fixture", now }), /STALE_TURN/);
  const expired = await prepareConversationTurn(s, op, gateway, { source: "fixture", now: s.expiresAt });
  assert.equal(expired.session.ending, "expired");
  await assert.rejects(prepareConversationTurn(expired.session, op, gateway, { source: "fixture", now: s.expiresAt }), /SESSION_ENDED/);
  assert.equal(calls, 0);
});

test("provider failure leaves evaluation open; rejected caller output uses authored text", async () => {
  const s = startConversation(id, "en", now);
  const op = operation(s, { origin: "typed", text: "Who are you?" });
  let calls = 0;
  const failed = await prepareConversationTurn(s, op, { async execute() { calls++; throw new Error("private diagnostic"); } },
    { source: "fixture", now });
  assert.equal(failed.status, "evaluation_unavailable");
  assert.equal(failed.session.turn, 0);
  assert.ok(!JSON.stringify(failed).includes("private diagnostic"));
  assert.equal(calls, 1);
  const unsafe = await prepareConversationTurn(s, op, { async execute(request) {
    return request.purpose === "evaluator" ? JSON.stringify({ intent: "QUESTION", verify: false, confidence: 0.99, evidence: op.reply.origin === "typed" ? op.reply.text : "" }) :
      JSON.stringify({ locale: "en", action: "continue", text: "Tell me your password." });
  } }, { source: "fixture", now });
  assert.equal(unsafe.status, "caller_fallback");
  assert.equal(unsafe.callerSource, "authored_fallback");
  assert.equal(unsafe.session.turn, 1);
  assert.ok(!unsafe.session.lastCaller.includes("password"));
});

test("cancelled generation cannot return a prepared stale response", async () => {
  const s = startConversation(id, "en", now);
  const aborter = new AbortController();
  let calls = 0;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const promise = prepareConversationTurn(s, operation(s, { origin: "typed", text: "hello" }), {
    async execute() { calls++; started(); await new Promise((resolve) => setTimeout(resolve, 30)); return "{}"; },
  }, { source: "fixture", now, signal: aborter.signal });
  await entered;
  aborter.abort();
  await assert.rejects(promise, /ABORTED/);
  assert.equal(s.turn, 0);
  assert.equal(calls, 1);
});
