import { z } from "zod";
import { locales, type Locale } from "../../domain/scenario";
import { normalize } from "../../domain/numbers";
import { OperationSchema, type TurnOperation } from "../../domain/v2/contracts";
import { validateDialogue } from "../../domain/v2/safety";
import { V3_LIMITS } from "../../domain/v3/contracts";
import { validateDecisionEvidence, summarizeDecisions } from "./evaluation";
import { InternalSessionSchema, type StoredSession } from "./public-session";
import { getScenario, selectScenario, scenarioIds } from "./scenarios";
import { categoryLabel, presentDecisions } from './debrief-copy';
import { withoutParticipantText as retained } from './privacy';
import { isApprovedResponse } from './approved-dialogue';

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
    history: [...s.history, { turn, caller: s.lastCaller, participant: "", origin: op.reply.origin }].slice(-V3_LIMITS.history),
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

// Scenario-specific lexical tripwires supplement the prompt's allowed facts.
// They deliberately prefer a reviewed fallback, including some benign negations.
// They are not a universal fact checker or proof of multilingual semantic safety.
const pressureCue = /\b(?:urgent|urgency|immediately|right now|at once|must|compulsory|mandatory|unless|otherwise|agree now|turant|abhi|jaldi|fauran|foran|zaroori|lazmi|varna|warna|maan lo)\b|तुरंत|तुरन्त|अभी|फ़ौरन|फौरन|जल्द|ज़रूर|जरूर|अनिवार्य|सहमत|नहीं तो|वरना|உடனே|உடனடி|இப்போதே|அவசர|கட்டாய|ஒப்புக்|ஒப்புத|இல்லாவிட்டால்|వెంటనే|తక్షణ|అత్యవసర|ఇప్పుడే|తప్పనిసరి|అంగీకరించ|లేకపోతే/iu;
const restrictionCue = /\b(?:freeze|frozen|block|blocked|stop|stopped|suspend|suspended|close|closed|disable|disabled|disconnect|deactivate|restriction|restricted|cut off|band ho)\b|बंद|ब्लॉक|फ्रीज|पाबंदी|रोक|निलंब|निष्क्रिय|முடக்|நிறுத்த|தடை|செயலிழ|மூட|துண்டி|ఆపివే|నిలిపివే|స్తంభి|పరిమితి|మూసివే|నిష్క్రియ|బ్లాక్/iu;
const conclusiveClaim = /\b(?:verified|confirmed|proved|proven|definitely|certainly|guaranteed|guarantee|absolutely|pakka)\b|\b(?:identity|source|provenance)\b.{0,50}\b(?:certain|sure|established)\b|पुष्ट|प्रमाणित|सत्यापित|पहचान.*साबित|निश्चित|पक्का|உறுதிப்படுத்த|உறுதியான|நிச்சயமாக|சரிபார்க்கப்பட்ட|நம்பகமான|నిర్ధారించబడ|ధృవీకరించబడ|నిర్ధారిత|ఖచ్చితంగా|నమ్మదగిన/iu;
const severeThreat = /\b(?:arrest|jail|prison|punish|penalty|fine|legal action|sue|harm|hurt|kill|threaten)\b|गिरफ्तार|गिरफ़्तार|जेल|सज़ा|सजा|जुर्माना|கைது|சிறை|தண்டனை|அபராதம்|அச்சுறுத்|అరెస్ట్|జైలు|శిక్ష|జరిమానా|బెదిరి/iu;
const identityClauses = (text: string) => text.split(/[.!?;,।]|\bbut\b|लेकिन|ஆனால்|కానీ/iu);
function negatesIdentityAssertion(clause: string) {
  return /\b(?:not|never|cannot|can['’]t|doesn['’]t|won['’]t)\b.{0,30}\b(?:prove\w*|confirm\w*|verif\w*|validat\w*|establish\w*|authenticat\w*)\b/iu.test(clause) ||
    /पहचान.{0,30}(?:नहीं|नही)/u.test(clause) ||
    /நிரூபிக்காது|உறுதிப்படுத்தாது|சரிபார்க்காது/u.test(clause) ||
    /నిరూపించదు|నిర్ధారించదు|ధృవీకరించదు/u.test(clause);
}
// No caller category may turn an incoming voice or content-check panel into
// identity authentication. These lexical tripwires are not a semantic proof.
function claimsInboundAuthentication(text: string) {
  const clauses = identityClauses(text);
  return clauses.some(clause => {
    const english = /\b(?:call|voice|panel|app)\b.{0,60}\b(?:proves?|confirms?|verif\w*|validat\w*|establish\w*|authenticat\w*)\b.{0,70}(?:who\s+i\s+am|\bidentity\b|\bcaller\b|\bme\b)|\b(?:identity|caller)\b.{0,40}\b(?:checked|confirmed|verified|authenticated)\b.{0,50}\b(?:call|voice|panel|app)\b/iu.test(clause);
    const englishNegated = /\b(?:not|never|cannot|can['’]t|doesn['’]t|won['’]t)\b.{0,30}\b(?:prove\w*|confirm\w*|verif\w*|validat\w*|establish\w*|authenticat\w*)\b/iu.test(clause);
    const hindi = /(?:कॉल|आवाज़|पैनल|ऐप).{0,50}(?:पहचान|कॉलर).{0,30}(?:साबित|पुष्ट|सत्यापित)/u.test(clause) && !/नहीं|नही/u.test(clause);
    const tamil = /(?:அழைப்பு|குரல்|பலகை|செயலி).{0,50}(?:அடையாள|அழைத்தவர்).{0,30}(?:நிரூபி|உறுதிப்|சரிபார்)/u.test(clause) && !/நிரூபிக்காது|உறுதிப்படுத்தாது|சரிபார்க்காது|முடியாது|அல்ல/u.test(clause);
    const telugu = /(?:కాల్|గొంతు|ప్యానెల్|యాప్).{0,50}(?:గుర్తిం|కాలర్|వ్యక్తి).{0,30}(?:నిరూపి|నిర్ధారి|ధృవీకరి)/u.test(clause) && !/నిరూపించదు|నిర్ధారించదు|ధృవీకరించదు|కాదు|లేదు/u.test(clause);
    return (english && !englishNegated) || hindi || tamil || telugu;
  });
}
function contradictsScenario(s: StoredSession, text: string) {
  if (claimsInboundAuthentication(text)) return true;
  if (severeThreat.test(text)) return true;
  if (s.scenarioId !== "kyc_pressure" && (pressureCue.test(text) || restrictionCue.test(text))) return true;
  return s.scenarioId === "unverified_notice" && identityClauses(text).some(clause => conclusiveClaim.test(clause) && !negatesIdentityAssertion(clause));
}

/** V2 safety validation is reused; explicit source describes actual adapter origin. */
export function attachCaller(state: StoredSession, candidate: unknown, source: "hosted" | "fixture"):
  { session: StoredSession; source: "hosted" | "fixture" | "authored_fallback"; reason?: string } {
  const s = checkedState(state, state.updatedAt);
  if (s.ending) return { session: retained(s), source: "authored_fallback", reason: "session_ended" };
  // Only exact server-reviewed responses may carry scenario facts into captions/TTS.
  // Validate the complete envelope first; no fixture/hosted bypass or extra suffix.
  const approved = z.object({ locale: z.literal(s.locale), text: z.string(), action: z.literal('continue') }).strict().safeParse(candidate);
  if (approved.success && isApprovedResponse(s.scenarioId, s.locale, approved.data.text)) {
    return { session: retained({ ...s, lastCaller: approved.data.text }), source };
  }
  const checked = validateDialogue(candidate, { locale: s.locale, lastCaller: s.history.at(-1)?.caller ?? s.lastCaller, ending: false }, source);
  if (!checked.ok) return { session: retained(s), source: "authored_fallback", reason: checked.reason };
  if (categoryDisclosure.test(checked.dialogue.text) || scenarioIds.some((id) => checked.dialogue.text.toLowerCase().includes(id))) {
    return { session: retained(s), source: "authored_fallback", reason: "private_context_disclosure" };
  }
  if (contradictsScenario(s, checked.dialogue.text)) {
    return { session: retained(s), source: "authored_fallback", reason: "scenario_boundary" };
  }
  return { session: retained(s), source: 'authored_fallback', reason: 'unapproved_scenario_claim' };
}

/** Scenario explanation is not evidence the participant necessarily encountered.
 * Recorded captions are not proof that audio was played, heard or understood.
 */
export function buildDebrief(state: StoredSession) {
  const s = checkedState(state, state.updatedAt);
  if (!s.ending) throw new V3ControllerError("V3_DEBRIEF_UNAVAILABLE");
  const scenario = getScenario(s.scenarioId, s.locale);
  return { educationalSimulation: true as const, category: scenario.groundTruth, categoryLabel: categoryLabel(s.locale,scenario.groundTruth), explanation: scenario.debrief,
    recordedCaptions: [...new Set([...s.history.map((h) => h.caller), s.lastCaller])],
    verification: s.verificationState === "checked" ? { checked: true as const, ...scenario.verification } : { checked: false as const },
    decisions: presentDecisions(s.locale,summarizeDecisions(s.observations, s.verificationState === "checked", s.ending === "participant")),
    ending: s.ending,
  };
}
