import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../src/domain/scenario";
import type { Reply, TurnOperation } from "../src/domain/v2/contracts";
import { V3_LIMITS } from "../src/domain/v3/contracts";
import { startSession, advanceSession, endSession, verifySession, attachCaller, buildDebrief } from "../src/server/v3/controller";
import { projectPublicSession, type StoredSession } from "../src/server/v3/public-session";
import { getScenario } from "../src/server/v3/scenarios";

const NOW = 1_800_000_000_000;
function start(index = 0, locale: typeof locales[number] = "en") {
  return startSession({ sessionId: crypto.randomUUID(), locale, now: NOW, selectIndex: () => index });
}
function operation(s: StoredSession, reply: Reply = { origin: "typed", text: "Who are you?" }): TurnOperation {
  return { sessionId: s.sessionId, expectedTurn: s.turn, operationId: crypto.randomUUID(), reply };
}
const evidence = (kind: string, text: string) => ({ kind, confidence: 0.99, evidence: text });

test("three controllers support free-form replies in all locales without a required secret", () => {
  for (const locale of locales) for (const index of [0, 1, 2]) {
    let s = start(index, locale);
    for (let turn = 0; turn < 3; turn++) {
      const reply = { origin: "typed" as const, text: `${locale}: a reasonable unclassified question?` };
      s = advanceSession(s, operation(s, reply), null, NOW + turn + 1);
      assert.equal(s.turn, turn + 1); assert.equal(s.ending, null);
      assert.equal(s.history.at(-1)?.origin, "typed");
      assert.equal(s.lastCaller, getScenario(s.scenarioId, locale).continuation);
      assert.equal(s.observations.at(-1)?.kind, "uncertain");
    }
    assert.ok(!JSON.stringify(projectPublicSession(s)).includes(s.scenarioId));
  }
});

test("invalid clocks, stale envelopes, different sessions and ended turns cannot advance", () => {
  const s = start(), op = operation(s);
  assert.throws(() => advanceSession(s, { ...op, expectedTurn: 1 }, null, NOW + 1), { code: "V3_STALE_TURN" });
  assert.throws(() => advanceSession(s, { ...op, sessionId: crypto.randomUUID() }, null, NOW + 1), { code: "V3_STALE_TURN" });
  assert.throws(() => advanceSession(s, { ...op, operationId: "bad" }, null, NOW + 1), { code: "V3_INVALID_OPERATION" });
  assert.throws(() => advanceSession(s, op, null, NOW - 1), { code: "V3_INVALID_STATE" });
  assert.throws(() => advanceSession(endSession(s, NOW + 1), op, null, NOW + 2), { code: "V3_SESSION_ENDED" });
  assert.throws(() => startSession({ sessionId: "bad", locale: "en", now: NOW }), { code: "V3_INVALID_STATE" });
});

test("expiry does not evaluate the late reply or fabricate a safe participant exit", () => {
  const s = start(), next = advanceSession(s, operation(s, { origin: "button", id: "end" }), null, s.expiresAt);
  assert.equal(next.ending, "expired"); assert.equal(next.turn, 0); assert.equal(next.observations.length, 0);
  assert.equal(next.lastCaller, s.lastCaller);
  assert.equal(buildDebrief(next).decisions.find((d) => d.id === "exit_safely")?.status, "not_tested");
  assert.equal(endSession(s, s.expiresAt).ending, "expired");
});

test("bounded turns retain at most six masked history entries without awarding limit-based exit credit", () => {
  let s = start(1);
  for (let n = 0; n < V3_LIMITS.turns; n++) {
    s = advanceSession(s, operation(s, { origin: "typed", text: "You mentioned 482197?" }), null, NOW + n + 1);
  }
  assert.equal(s.ending, "limit"); assert.equal(s.history.length, 6);
  assert.deepEqual(s.history.map((h) => h.turn), [5, 6, 7, 8, 9, 10]);
  assert.ok(!JSON.stringify(s).includes("482197"));
  assert.equal(buildDebrief(s).decisions.find((d) => d.id === "exit_safely")?.status, "not_tested");
});

test("generic refusals stop every category without claiming tested secret protection", () => {
  for (const index of [0, 1, 2]) for (const reply of [
    { origin: "button" as const, id: "refuse" as const }, { origin: "typed" as const, text: "No thanks." },
    { origin: "typed" as const, text: "வேண்டாம்" }, { origin: "typed" as const, text: "వద్దు" },
  ]) {
    const s = start(index), next = advanceSession(s, operation(s, reply), null, NOW + 1);
    assert.equal(next.ending, "refused"); assert.equal(next.lastCaller, s.lastCaller);
    assert.equal(buildDebrief(next).decisions.find((d) => d.id === "protect_secrets")?.status, "not_tested");
  }
});

test("explicit secret refusal is respected and shares the same evidence grade across categories", () => {
  const text = "I will not share my OTP.";
  const grades = [0, 1, 2].map((index) => {
    const s = start(index), next = advanceSession(s, operation(s, { origin: "typed", text }), evidence("secret_refusal", text), NOW + 1);
    assert.equal(next.ending, "refused");
    return buildDebrief(next).decisions;
  });
  assert.deepEqual(grades[0], grades[1]); assert.deepEqual(grades[1], grades[2]);
  assert.equal(grades[0].find((d) => d.id === "protect_secrets")?.status, "observed_safe");
});

test("speaking about verification never completes the independent server action", () => {
  const s = start(), text = "I will check the official app.";
  const next = advanceSession(s, operation(s, { origin: "typed", text }), evidence("independent_plan", text), NOW + 1);
  assert.equal(next.verificationState, "unchecked");
  assert.deepEqual(projectPublicSession(next).verification, { checked: false });
  const ended = endSession(next, NOW + 2), checked = verifySession(ended, NOW + 3);
  assert.equal(checked.ending, "participant"); assert.equal(checked.verificationState, "checked");
  assert.equal(buildDebrief(checked).decisions.find((d) => d.id === "verify_independently")?.reason, "trusted_panel_checked");
  assert.deepEqual(verifySession(checked, NOW + 4), checked);
});

test("participant End is immediate and idempotent; checking later does not rewrite expiry or limit", () => {
  const s = start(), ended = endSession(s, NOW + 1);
  assert.equal(ended.turn, 0); assert.equal(ended.ending, "participant");
  assert.deepEqual(endSession(ended, NOW + 2), ended);
  assert.equal(buildDebrief(ended).decisions.find((d) => d.id === "exit_safely")?.reason, "participant_ended");
  const expiredChecked = verifySession(s, s.expiresAt);
  assert.equal(expiredChecked.ending, "expired");
  assert.equal(buildDebrief(expiredChecked).decisions.find((d) => d.id === "exit_safely")?.status, "not_tested");
});

test("button End and validated whole-reply exit preserve participant intent without invoking a model", () => {
  for (const reply of [{ origin: "button" as const, id: "end" as const }, { origin: "typed" as const, text: "I will hang up." }]) {
    const s = start(2), next = advanceSession(s, operation(s, reply), reply.origin === "typed" ? evidence("safe_exit", reply.text) : null, NOW + 1);
    assert.equal(next.ending, "participant");
  }
});

test("voice origin is preserved while raw numeric participant text and evidence are masked", () => {
  const s = start(), reply: Reply = { origin: "voice", text: "I will not share my OTP 482197.", transcription: {
    provider: "gnani", model: "prisma-v3.0", requestId: "explicit-proof-checked-fixture", confirmed: true } };
  const next = advanceSession(s, operation(s, reply), evidence("secret_refusal", reply.text), NOW + 1);
  assert.equal(next.history[0].origin, "voice"); assert.equal(next.observations[0].origin, "voice");
  assert.ok(!JSON.stringify(next).includes("482197"));
});

test("generated dialogue checks previous presented caption, rejects unsafe text and reports actual source", () => {
  const s = start(), prepared = advanceSession(s, operation(s), null, NOW + 1);
  const repeated = attachCaller(prepared, { locale: "en", text: s.lastCaller, action: "continue" }, "hosted");
  assert.equal(repeated.source, "authored_fallback"); assert.equal(repeated.reason, "repetition");
  assert.equal(repeated.session.lastCaller, prepared.lastCaller);
  const unsafe = attachCaller(prepared, { locale: "en", text: "Please share your password.", action: "continue" }, "hosted");
  assert.equal(unsafe.source, "authored_fallback");
  const text = "I'm Arun from fictional Kalpanik Bank. What concerns you about this service message?";
  const live = attachCaller(prepared, { locale: "en", text, action: "continue" }, "hosted");
  assert.equal(live.source, "hosted"); assert.equal(live.session.lastCaller, text);
  assert.equal(attachCaller(prepared, { locale: "en", text, action: "continue" }, "fixture").source, "fixture");
});

test("debrief is unavailable until ended and separates scenario explanation from recorded evidence", () => {
  const s = start(1);
  assert.throws(() => buildDebrief(s), { code: "V3_DEBRIEF_UNAVAILABLE" });
  const debrief = buildDebrief(endSession(s, NOW + 1));
  assert.equal(debrief.category, "fraudulent");
  assert.deepEqual(debrief.recordedCaptions, [s.lastCaller]);
  assert.ok(!debrief.recordedCaptions.includes(getScenario(s.scenarioId, "en").continuation));
  assert.ok(debrief.decisions.filter((d) => d.id !== "exit_safely").every((d) => d.status === "not_tested"));
  assert.ok(!JSON.stringify(debrief).includes('"scenarioId"'));
});

test("generated explicit category labels and internal answer identifiers never become caller captions", () => {
  for (const [locale, text] of [
    ["en", "I am the legitimate caller in this exercise."], ["en", "The scenario is routine_update."],
    ["hi", "यह धोखाधड़ी वाली कॉल है।"], ["ta", "இது ஒரு மோசடி அழைப்பு."], ["te", "ఇది ఒక మోసపూరిత కాల్."],
  ] as const) {
    const s = start(0, locale), prepared = advanceSession(s, operation(s), null, NOW + 1);
    const attached = attachCaller(prepared, { locale, text, action: "continue" }, "hosted");
    assert.equal(attached.source, "authored_fallback");
    assert.equal(attached.reason, "private_context_disclosure");
    assert.equal(attached.session.lastCaller, prepared.lastCaller);
  }
});

test("routine and unresolved scenarios reject generated pressure and unsupported service restrictions", () => {
  const captions = [
    ["en", "Your service will stop unless you agree immediately."],
    ["hi", "आपको अभी सहमत होना होगा।"],
    ["hi", "आपकी सेवा बंद कर दी जाएगी।"],
    ["hi", "यह update abhi maan lo, warna service band ho jayegi."],
    ["ta", "இந்தச் சேவைக்கு இப்போதே ஒப்புதல் கொடுக்க வேண்டும்."],
    ["ta", "உங்கள் சேவை நிறுத்தப்படும்."],
    ["te", "మీరు ఇప్పుడే అంగీకరించాలి."],
    ["te", "మీ సేవ నిలిపివేయబడుతుంది."],
  ] as const;
  for (const index of [0, 2]) for (const [locale, text] of captions) {
    const s = start(index, locale), prepared = advanceSession(s, operation(s), null, NOW + 1);
    const attached = attachCaller(prepared, { locale, text, action: "continue" }, "hosted");
    assert.equal(attached.source, "authored_fallback", `${s.scenarioId}: ${text}`);
    assert.equal(attached.reason, "scenario_boundary", text);
    assert.equal(attached.session.lastCaller, prepared.lastCaller);
  }
});

test("unresolved scenarios cannot generate conclusive verification in four locales or Hinglish", () => {
  for (const [locale, text] of [
    ["en", "This notice has definitely been confirmed."],
    ["hi", "इस सूचना की पुष्टि हो चुकी है।"],
    ["hi", "यह update pakka confirmed hai."],
    ["ta", "இந்தச் செய்தி உறுதிப்படுத்தப்பட்டது."],
    ["te", "ఈ సందేశం ఖచ్చితంగా నిర్ధారించబడింది."],
  ] as const) {
    const s = start(2, locale), prepared = advanceSession(s, operation(s), null, NOW + 1);
    const attached = attachCaller(prepared, { locale, text, action: "continue" }, "hosted");
    assert.equal(attached.source, "authored_fallback", text);
    assert.equal(attached.reason, "scenario_boundary", text);
  }
});

test("severe threats are rejected for every hidden assignment", () => {
  for (const index of [0, 1, 2]) for (const [locale, text] of [
    ["en", "You will go to jail for refusing this notice."],
    ["hi", "आपको जेल जाना होगा।"],
    ["ta", "உங்களுக்கு சிறைத் தண்டனை வரும்."],
    ["te", "మీకు జైలు శిక్ష వస్తుంది."],
  ] as const) {
    const s = start(index, locale), prepared = advanceSession(s, operation(s), null, NOW + 1);
    assert.equal(attachCaller(prepared, { locale, text, action: "continue" }, "hosted").reason, "scenario_boundary", text);
  }
});

test("bounded KYC pressure remains permitted only in its reviewed scenario", () => {
  const text = "I claim an urgent service restriction. You may ask me to explain this claim.";
  for (const index of [0, 1, 2]) {
    const s = start(index), prepared = advanceSession(s, operation(s), null, NOW + 1);
    const attached = attachCaller(prepared, { locale: "en", text, action: "continue" }, "fixture");
    assert.equal(attached.source, index === 1 ? "fixture" : "authored_fallback");
  }
});

test("neutral generated clarification remains available to every scenario in all locales", () => {
  for (const index of [0, 1, 2]) for (const [locale, text] of [
    ["en", "What would you like me to explain about this service message?"],
    ["hi", "इस सेवा संदेश के बारे में आप क्या समझना चाहेंगे?"],
    ["ta", "இந்தச் செய்தியைப் பற்றி என்ன விளக்கம் வேண்டும்?"],
    ["te", "ఈ సేవా సందేశం గురించి మీకు ఏ వివరణ కావాలి?"],
  ] as const) {
    const s = start(index, locale), prepared = advanceSession(s, operation(s), null, NOW + 1);
    assert.equal(attachCaller(prepared, { locale, text, action: "continue" }, "hosted").source, "hosted", text);
  }
});

test('no scenario can claim that inbound voice or the content panel authenticates identity',()=>{
 for(const index of [0,1,2])for(const [locale,text] of [
  ['en','This call proves who I am.'],['en','Your identity has been checked through this call.'],
  ['en','The panel proves the identity of the caller.'],
  ['hi','इस कॉल से मेरी पहचान साबित होती है।'],
  ['ta','இந்த அழைப்பு என் அடையாளத்தை நிரூபிக்கிறது.'],
  ['te','ఈ కాల్ నా గుర్తింపును నిరూపిస్తుంది.'],
 ] as const){
  const s=start(index,locale),n=advanceSession(s,operation(s),null,NOW+1);
  const attached=attachCaller(n,{locale,text,action:'continue'},'fixture');
  assert.equal(attached.source,'authored_fallback',text);assert.equal(attached.reason,'scenario_boundary',text);
 }
});
test('identity boundaries do not ban independent checking or negate legitimate content corroboration',()=>{
 for(const index of [0,1,2])for(const [locale,text] of [
  ['en','This call does not prove who I am.'],
  ['hi','इस कॉल से मेरी पहचान साबित नहीं होती।'],
  ['ta','இந்த அழைப்பு என் அடையாளத்தை நிரூபிக்காது.'],
  ['te','ఈ కాల్ నా గుర్తింపును నిరూపించదు.'],
 ] as const){
  const s=start(index,locale),n=advanceSession(s,operation(s),null,NOW+1);
  assert.equal(attachCaller(n,{locale,text,action:'continue'},'fixture').source,'fixture',text);
 }
 const s=start(0),n=advanceSession(s,operation(s),null,NOW+1);
 // Content corroboration belongs to the actual server verification panel, not an invented caller assertion.
 assert.equal(attachCaller(n,{locale:'en',text:'The panel confirms this public notice. Please check it independently.',action:'continue'},'fixture').source,'authored_fallback');
});
