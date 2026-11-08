import { z } from "zod";
import { locales, type Locale } from "../../domain/scenario";
import { maskNumbers, normalize } from "../../domain/numbers";
import { OperationSchema, type TurnOperation } from "../../domain/v2/contracts";
import { validateDialogue } from "../../domain/v2/safety";
import { V3_LIMITS } from "../../domain/v3/contracts";
import { validateDecisionEvidence, summarizeDecisions } from "./evaluation";
import { InternalSessionSchema, type StoredSession } from "./public-session";
import { getScenario, selectScenario, scenarioIds } from "./scenarios";

export class V3ControllerError extends Error {
  constructor(readonly code: "V3_INVALID_STATE" | "V3_INVALID_OPERATION" | "V3_STALE_TURN" | "V3_SESSION_ENDED" | "V3_DEBRIEF_UNAVAILABLE") {
    super(code); this.name = "V3ControllerError";
  }
}
function checkedState(input: StoredSession, now: number) {
  const parsed = InternalSessionSchema.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(now) || now < 0 || now < parsed.data.updatedAt) throw new V3ControllerError("V3_INVALID_STATE");
  return parsed.data;
}
function retained(input: StoredSession) {
  return InternalSessionSchema.parse({ ...input, lastCaller: maskNumbers(input.lastCaller),
    history: input.history.map((h) => ({ ...h, caller: maskNumbers(h.caller), participant: maskNumbers(h.participant) })),
    observations: input.observations.map((o) => ({ ...o, evidence: maskNumbers(o.evidence) })),
  });
}

/** Only trusted server session creation supplies the UUID, clock and optional test index. */
export function startSession(input: { sessionId: string; locale: Locale; now: number; selectIndex?: () => number }): StoredSession {
  const params = z.object({ sessionId: z.uuid(), locale: z.enum(locales), now: z.number().int().nonnegative()
    .max(Number.MAX_SAFE_INTEGER - V3_LIMITS.sessionMs) }).strict().safeParse({ sessionId: input.sessionId, locale: input.locale, now: input.now });
  if (!params.success) throw new V3ControllerError("V3_INVALID_STATE");
  const { sessionId, locale, now } = params.data, scenarioId = selectScenario(input.selectIndex);
  return retained({ v: 3, mode: "trust-or-trap", sessionId, locale, scenarioId, createdAt: now, updatedAt: now,
    expiresAt: now + V3_LIMITS.sessionMs, turn: 0, ending: null, lastCaller: getScenario(scenarioId, locale).opening,
    history: [], observations: [], verificationState: "unchecked" });
}

// Explicit requests to stop close the call without inventing secret-protection evidence.
const stopRequest = /^(?:no(?:\s+thanks?|\s+thank\s+you)?|please\s+stop|stop(?:\s+(?:this|the)\s+call)?|not\s+interested|नहीं(?:\s+धन्यवाद)?|नहीं\s+चाहिए|बंद\s+करो|வேண்டாம்|நிறுத்துங்கள்|వద్దు|ఆపండి)[.!।\s]*$/iu;

/** Pure preparation only. Routes must own authentication, voice proof and turn lease. */
export function advanceSession(state: StoredSession, candidate: TurnOperation, evaluation: unknown, now: number): StoredSession {
  const s = checkedState(state, now), parsed = OperationSchema.safeParse(candidate);
  if (!parsed.success) throw new V3ControllerError("V3_INVALID_OPERATION");
  const op = parsed.data;
  if (s.sessionId !== op.sessionId || s.turn !== op.expectedTurn) throw new V3ControllerError("V3_STALE_TURN");
  if (s.ending) throw new V3ControllerError("V3_SESSION_ENDED");
  if (now >= s.expiresAt) return retained({ ...s, ending: "expired", updatedAt: now });
  const turn = s.turn + 1, observations = validateDecisionEvidence(op.reply, evaluation, turn);
  const kinds = new Set(observations.map((o) => o.kind));
  const button = op.reply.origin === "button" ? op.reply.id : null;
  const stopped = op.reply.origin !== "button" && stopRequest.test(normalize(op.reply.text));
  const ending: StoredSession["ending"] = button === "end" || kinds.has("exit") ? "participant" :
    button === "refuse" || stopped || kinds.has("boundary") ? "refused" : turn >= V3_LIMITS.turns ? "limit" : null;
  return retained({ ...s, turn, updatedAt: now, ending,
    history: [...s.history, { turn, caller: s.lastCaller,
      participant: op.reply.origin === "button" ? `[button:${op.reply.id}]` : op.reply.text, origin: op.reply.origin }].slice(-V3_LIMITS.history),
    observations: [...s.observations, ...observations],
    // End keeps the last presented caption; it must not invent a delivered warning.
    lastCaller: ending ? s.lastCaller : getScenario(s.scenarioId, s.locale).continuation,
  });
}

/** Explicit authenticated End; repeated End never changes its original cause. */
export function endSession(state: StoredSession, now: number): StoredSession {
  const s = checkedState(state, now);
  if (s.ending) return retained(s);
  return retained({ ...s, ending: now >= s.expiresAt ? "expired" : "participant", updatedAt: now });
}

/** Simulator-controlled action, never inferred from a spoken claim or model output.
 * Checking after an ended call is permitted without changing the ending cause.
 */
export function verifySession(state: StoredSession, now: number): StoredSession {
  const s = checkedState(state, now);
  if (s.verificationState === "checked") return retained(s);
  return retained({ ...s, verificationState: "checked", updatedAt: now,
    ending: s.ending ?? (now >= s.expiresAt ? "expired" : null) });
}

// Additional V3 lexical tripwire. It blocks explicit labels/instruction disclosures,
// not every possible multilingual paraphrase or semantic scenario inconsistency.
const categoryDisclosure = /\b(?:legit(?:imate)?|fraud(?:ulent)?|scam|unverified|authentic(?:ated)?|trustworthy|hidden\s+(?:label|category)|answer\s+key|system\s+prompt|rubric)\b|धोखाधड़ी|धोखा|असली\s+कॉल|मूल्यांकन|மோசடி|உண்மையான\s+அழைப்பு|மறைந்த\s+வகை|மதிப்பீட்டு|మోసపూరిత|మోసం|నిజమైన\s+కాల్|రహస్య\s+వర్గం|మూల్యాంకన/iu;

/** V2 safety validation is reused; explicit source describes actual adapter origin. */
export function attachCaller(state: StoredSession, candidate: unknown, source: "hosted" | "fixture"):
  { session: StoredSession; source: "hosted" | "fixture" | "authored_fallback"; reason?: string } {
  const s = checkedState(state, state.updatedAt);
  if (s.ending) return { session: retained(s), source: "authored_fallback", reason: "session_ended" };
  const checked = validateDialogue(candidate, { locale: s.locale, lastCaller: s.history.at(-1)?.caller ?? s.lastCaller, ending: false }, source);
  if (!checked.ok) return { session: retained(s), source: "authored_fallback", reason: checked.reason };
  if (categoryDisclosure.test(checked.dialogue.text) || scenarioIds.some((id) => checked.dialogue.text.toLowerCase().includes(id))) {
    return { session: retained(s), source: "authored_fallback", reason: "private_context_disclosure" };
  }
  return { session: retained({ ...s, lastCaller: checked.dialogue.text }), source: checked.dialogue.source };
}

/** Scenario explanation is not evidence the participant necessarily encountered.
 * Recorded captions are not proof that audio was played, heard or understood.
 */
export function buildDebrief(state: StoredSession) {
  const s = checkedState(state, state.updatedAt);
  if (!s.ending) throw new V3ControllerError("V3_DEBRIEF_UNAVAILABLE");
  const scenario = getScenario(s.scenarioId, s.locale);
  return { educationalSimulation: true as const, category: scenario.groundTruth, explanation: scenario.debrief,
    recordedCaptions: [...new Set([...s.history.map((h) => h.caller), s.lastCaller])],
    verification: s.verificationState === "checked" ? { checked: true as const, ...scenario.verification } : { checked: false as const },
    decisions: summarizeDecisions(s.observations, s.verificationState === "checked", s.ending === "participant"),
    ending: s.ending,
  };
}
