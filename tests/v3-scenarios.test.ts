import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../src/domain/scenario";
import { PublicSessionSchema, V3_LIMITS, type ScenarioId } from "../src/domain/v3/contracts";
import { getScenario, scenarioIds, selectScenario } from "../src/server/v3/scenarios";
import { InternalSessionSchema, projectPublicSession, type StoredSession } from "../src/server/v3/public-session";

// Explicit fixtures only: no providers, database, browser or randomisation benchmark.
function session(scenarioId: ScenarioId = "routine_update"): StoredSession {
  return { v: 3, mode: "trust-or-trap", scenarioId, sessionId: "2374ab2c-e963-49db-bba8-4a7617154371", locale: "en",
    createdAt: 1000, updatedAt: 1000, expiresAt: 1000 + V3_LIMITS.sessionMs, turn: 0, ending: null,
    lastCaller: getScenario(scenarioId, "en").opening, history: [], observations: [], verificationState: "unchecked" };
}

test("three server-owned scenarios distinguish actual status from initially unverified evidence", () => {
  assert.deepEqual(scenarioIds.map((id) => getScenario(id, "en").groundTruth), ["legitimate", "fraudulent", "unverified"]);
  assert.deepEqual(scenarioIds.map((id) => getScenario(id, "en").verification.finding), ["corroborated", "contradicted", "inconclusive"]);
  assert.match(getScenario("routine_update", "en").verification.message, /not the identity/);
  assert.match(getScenario("unverified_notice", "en").verification.message, /does not establish legitimacy or fraud/);
});

test("all categories share fictional persona and opening in all four locales", () => {
  for (const locale of locales) {
    const first = getScenario("routine_update", locale);
    for (const id of scenarioIds) {
      const s = getScenario(id, locale);
      assert.deepEqual(s.persona, first.persona);
      assert.equal(s.persona.fictional, true);
      assert.equal(s.opening, first.opening, "starting caption cannot encode the assignment");
      for (const caption of [s.opening, s.continuation]) assert.ok(caption.length > 20 && caption.length <= V3_LIMITS.callerChars);
      assert.ok(s.verification.message.length > 20 && s.verification.message.length <= 1200);
      assert.ok(s.debrief.length > 20);
      assert.ok(s.allowedFacts.length > 0 && s.forbiddenBehaviours.length > 0);
      assert.ok(!/https?:|www\.|\p{N}/u.test(s.continuation), "no operational destinations or codes");
    }
  }
});

test("assignment supports reproducible injected index sources without performance input", () => {
  const sequence = [2, 0, 1]; let calls = 0;
  assert.deepEqual(sequence.map(() => selectScenario(() => sequence[calls++])), ["unverified_notice", "routine_update", "kyc_pressure"]);
  assert.equal(calls, 3);
  assert.ok(scenarioIds.includes(selectScenario()));
  for (const value of [-1, 3, 0.5, Number.NaN, Infinity]) assert.throws(() => selectScenario(() => value), /V3_INVALID_ASSIGNMENT/);
});

test("scenario lookup rejects unknown/prototype identifiers and cannot mutate the private registry", () => {
  for (const id of ["bad", "__proto__", "constructor"]) assert.throws(() => getScenario(id as ScenarioId, "en"), /V3_INVALID_SCENARIO/);
  assert.throws(() => getScenario("routine_update", "bad" as "en"), /V3_INVALID_SCENARIO/);
  const copy = getScenario("routine_update", "en");
  copy.allowedFacts[0] = "tampered"; copy.persona.name = "changed"; copy.verification.message = "changed";
  assert.notEqual(getScenario("routine_update", "en").allowedFacts[0], "tampered");
  assert.equal(getScenario("routine_update", "en").persona.name, "Arun");
  assert.notEqual(getScenario("routine_update", "en").verification.message, "changed");
});

test("public projection is identical before evidence for every hidden assignment", () => {
  const projected = scenarioIds.map((id) => projectPublicSession(session(id)));
  assert.deepEqual(projected[0], projected[1]); assert.deepEqual(projected[1], projected[2]);
  for (const publicState of projected) {
    assert.deepEqual(publicState.verification, { checked: false });
    const json = JSON.stringify(publicState);
    for (const forbidden of ["scenarioId", "groundTruth", "allowedFacts", "forbiddenBehaviours", "observations", "history", "rubric", ...scenarioIds]) {
      assert.ok(!json.includes(forbidden), forbidden);
    }
  }
});

test("history and evaluator evidence stay private even when a session has ended", () => {
  const stored = session("kyc_pressure"); stored.turn = 1; stored.ending = "participant";
  stored.history = [{ turn: 1, origin: "typed", caller: "Private prior caption", participant: "Private participant reply" }];
  stored.observations = [{ turn: 1, origin: "typed", kind: "exit", evidence: "Private participant reply" }];
  const publicState = projectPublicSession(stored), json = JSON.stringify(publicState);
  assert.equal(publicState.ending, "participant");
  assert.ok(!json.includes("Private")); assert.ok(!json.includes("kyc_pressure"));
  assert.deepEqual(publicState.verification, { checked: false });
});

test("trusted verification panel is selected only from saved assignment after a completed check", () => {
  for (const locale of locales) for (const id of scenarioIds) {
    const stored = { ...session(id), locale, verificationState: "checked" as const };
    const panel = projectPublicSession(stored).verification;
    assert.deepEqual(panel, { checked: true, ...getScenario(id, locale).verification });
    assert.ok(!JSON.stringify(panel).includes('"groundTruth"'));
  }
});

test("strict public and internal schemas reject answer keys, hidden extras and inconsistent clocks/history", () => {
  const publicState = projectPublicSession(session());
  assert.equal(PublicSessionSchema.safeParse({ ...publicState, scenarioId: "routine_update" }).success, false);
  assert.equal(PublicSessionSchema.safeParse({ ...publicState, verification: { checked: false, finding: "corroborated" } }).success, false);
  assert.equal(InternalSessionSchema.safeParse({ ...session(), answerKey: "legitimate" }).success, false);
  assert.equal(InternalSessionSchema.safeParse({ ...session(), expiresAt: 100 }).success, false);
  assert.equal(InternalSessionSchema.safeParse({ ...session(), turn: 1 }).success, false);
  assert.equal(InternalSessionSchema.safeParse({ ...session(), observations: [{ turn: 1, origin: "typed", kind: "boundary", evidence: "no" }] }).success, false);
});
