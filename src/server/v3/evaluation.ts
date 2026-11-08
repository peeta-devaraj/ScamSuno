import { z } from "zod";
import { maskNumbers, normalize } from "../../domain/numbers";
import { ReplySchema, type Reply } from "../../domain/v2/contracts";
import { validateEvaluation } from "../../domain/v2/safety";
import type { Observation } from "./public-session";

export type DecisionObservation = Observation;
export type DecisionStatus = "observed_safe" | "observed_risk" | "uncertain" | "not_tested";
export type DecisionDimension = {
  id: "protect_secrets" | "verify_independently" | "calibrated_response" | "exit_safely";
  status: DecisionStatus; reason: string; evidenceTurns: number[];
};
const CandidateSchema = z.object({
  kind: z.enum(["secret_refusal", "independent_plan", "caller_channel_trust", "uncertainty_recognized",
    "harmless_information", "safe_exit", "sensitive_disclosure_intent", "clarification_question"]),
  confidence: z.number().min(0).max(1), evidence: z.string().min(1).max(500),
}).strict();
// Conservative lexical tripwires supplement the model; this is not a complete
// multilingual semantic classifier. Unsupported phrasings abstain.
const hypothetical = /\b(?:if|unless|until|before|after|maybe|perhaps|suppose|hypothetical|example|you said|you asked|agar|yadi|jab|pehle|baad)\b|अगर|यदि|पहले|आपने|என்றால்|ஒருவேளை|சொன்னீர்கள்|முன்|பிறகு|ఒకవేళ|అయితే|ముందు|తర్వాత|చెప్పారు/iu;
const quotedOrQuestioned = /["“”„«»`?？]|(?:^|\s)['‘]|['’](?:\s|$)/u;
const quotedText = /["“”„«»`]|(?:^|\s)['‘]|['’](?:\s|$)/u;
const injection = /\b(?:ignore|override|reveal|system prompt|hidden label|answer key|developer message)\b|निर्देश.*(?:भूल|अनदेखा)|மறை.*வகை|రహస్య.*సూచన/iu;
const secretReference = /\b(?:otp|pin|cvv|password|passcode|credentials?|code)\b|ओटीपी|पिन|पासवर्ड|कोड|குறியீ|கோட்|கடவுச்சொல்|ఓటీపీ|కోడ్|పిన్|పాస్వర్డ్/iu;
const refusal = /\b(?:(?:i\s+)?(?:will not|won['’]t|never|do not|don['’]t)\s+(?:share|give|provide|tell|disclose)|i refuse to (?:share|give|provide|tell|disclose))\b|नहीं\s+(?:बताऊँ|बताऊं|दूँ|दूं|दूंगा|दूंगी)|(?:बताऊँगा|बताऊंगा|बताऊँगी|बताऊंगी|दूँगा|दूंगा|दूँगी|दूंगी)\s+नहीं|சொல்ல\s*மாட்டே|பகிர\s*மாட்டே|தர\s*மாட்டே|చెప్పను|ఇవ్వను|పంచుకోను|\b(?:nahi|nahin)\s+(?:dunga|dungi|bataunga|bataungi)\b/iu;
const positiveSharing = /\bi\s+(?:will|shall|am going to)\s+(?:share|give|provide|tell|disclose)\b|\bi['’]ll\s+(?:share|give|provide|tell|disclose)\b/iu;
const opposingClause = /\bbut\b|लेकिन|परंतु|ஆனால்|కానీ/iu;
const refusesRefusal = /\b(?:not|never|won['’]t|don['’]t)\s+(?:refuse|decline|withhold)|\b(?:won['’]t|will not|do not|don['’]t)\s+(?:say|tell).*\b(?:not|never)\b/iu;
const firstPersonPlan = /\bi\s+(?:will|shall|am going to)\b|\bi['’]ll\b|\bmain\b|मैं|நான்|என்|నేను|నా/iu;
const negation = /\b(?:not|never|cannot|can['’]t|won['’]t|don['’]t|refuse|avoid|nahi|nahin)\b|नहीं|नही|மாட்டே|முடியாது|இல்லை|வில்லை|చేయను|చెయ్యను|చూడను|కాదు|లేదు|వద్దు/iu;
const exitAction = /\b(?:hang(?:ing)? up|end (?:this|the) call|disconnect(?:ing)?|leave (?:this|the) call)\b|कॉल.*(?:बंद|काट)|फोन.*(?:रख|बंद)|அழைப்பை.*(?:முடிக்|துண்டிக்)|కాల్.*(?:ముగి|కట్|పెట్టే)/iu;
const trustCallerChannel = /\b(?:call|use|trust)\b.{0,60}\b(?:number|link|website)\b.{0,40}\byou\s+(?:gave|sent|provided)\b|\btrust your (?:number|link|website)\b/iu;
const unsure = /\bi\s+(?:am not sure|don['’]t know|cannot verify|can['’]t verify)\b|मुझे.*(?:पता नहीं|यकीन नहीं)|எனக்கு.*(?:தெரியவில்லை|உறுதியாகத் தெரிய)|నాకు.*(?:తెలియదు|నమ్మకం లేదు)|\bmujhe.*(?:pata nahi|yakeen nahi)\b/iu;
const harmlessAcknowledgement = /^(?:thanks for (?:the |this )?(?:public |service )?(?:information|notice|update)|i (?:will listen|understand (?:the |this )?(?:public |service )?(?:notice|update))|जानकारी के लिए धन्यवाद|தகவலுக்கு நன்றி|సమాచారానికి ధన్యవాదాలు)[.!।\s]*$/iu;
// Limited call-relevant clarification, not arbitrary questions or proof of trust.
// Whole-reply evidence and confidence gates still apply; unsupported forms abstain.
function clarificationQuestion(text: string) {
  if (secretReference.test(text) || /\p{N}/u.test(text) || /\bi\s+(?:trust|already\s+verified|will\s+(?:share|give))\b/iu.test(text)) return false;
  const english = /^(?:who\s+(?:are\s+you|is\s+calling)|how\s+(?:can|do)\s+i\s+(?:know|check|verify))\b/iu.test(text) ||
    ((/^(?:why|what|which|how)\b/iu.test(text) || (/^(?:can you|could you|please)\b/iu.test(text) && /\b(?:explain|clarify|tell|describe)\b/iu.test(text))) && /\b(?:call|calling|service|notice|update|message|reason|purpose|identity|evidence|proof|bank)\b/iu.test(text));
  const hindi = /आप\s+कौन|कौन\s+(?:बोल|कॉल)|किस\s+(?:बारे|लिए)|(?:क्यों|क्या|कैसे|कौन|किस).{0,60}(?:कॉल|फोन|संदेश|सूचना|सेवा|कारण|सबूत|पहचान|बैंक)|(?:कॉल|संदेश|सूचना|सेवा).{0,60}(?:क्यों|क्या|कैसे|किस)/u.test(text);
  const hinglish = /\baap\s+kaun\b|\b(?:kyun|kyon|kya|kaise|kisliye)\b.{0,60}\b(?:call|phone|message|service|notice|bank|saboot)\b|\b(?:call|phone|message|service)\b.{0,60}\b(?:kyun|kyon|kya|kisliye)\b/iu.test(text);
  const tamil = /நீங்கள்\s+யார்|(?:யார்|ஏன்|எதற்காக|எதற்கு|என்ன|எப்படி|எதை).{0,60}(?:அழை|செய்தி|சேவை|காரணம்|ஆதாரம்|வங்கி)|(?:அழை|செய்தி|சேவை|காரணம்|ஆதாரம்|வங்கி).{0,60}(?:யார்|ஏன்|எதற்காக|என்ன|எப்படி|எதை)/u.test(text);
  const telugu = /మీరు\s+ఎవరు|(?:ఎవరు|ఎందుకు|ఏమి|ఏమిటి|ఏంటి|ఎలా|దేని).{0,60}(?:కాల్|ఫోన్|సమాచార|సేవ|సందేశ|కారణం|ఆధారం|బ్యాంకు)|(?:కాల్|సమాచార|సేవ|సందేశ).{0,60}(?:ఎవరు|ఎందుకు|ఏమిటి|దేని|ఏంటి)/u.test(text);
  return english || hindi || hinglish || tamil || telugu;
}

/** Produces only bounded masked observations; candidate text is never authority. */
export function validateDecisionEvidence(reply: Reply, candidate: unknown, turn: number): DecisionObservation[] {
  if (!Number.isInteger(turn) || turn < 1 || turn > 10) return [];
  const parsedReply = ReplySchema.safeParse(reply);
  if (!parsedReply.success) return [];
  const input = parsedReply.data;
  const observation = (kind: DecisionObservation["kind"], evidence = ""): DecisionObservation[] =>
    [{ turn, origin: input.origin, kind, evidence: maskNumbers(evidence) }];
  if (input.origin === "button") {
    // A generic decline protects a boundary but does not establish that a
    // sensitive-information opportunity was tested in this mixed-caller mode.
    return observation(({ refuse: "uncertain", verify: "verification_intent", end: "exit", continue: "uncertain" } as const)[input.id]);
  }
  const output = CandidateSchema.safeParse(candidate), text = normalize(input.text);
  if (!output.success || output.data.confidence < 0.9 || normalize(output.data.evidence) !== text || injection.test(text)) return observation("uncertain");
  const kind = output.data.kind;
  // आपने means "you did" as well as beginning reported speech. It is not
  // hypothetical in an ordinary "why did you call?" clarification.
  const conditional = kind === "clarification_question" ?
    hypothetical.test(text.replace(/आपने/gu, '')) || /आपने.{0,40}(?:कहा|पूछा|बताया)/u.test(text) : hypothetical.test(text);
  if (conditional || (kind === "clarification_question" ? quotedText.test(text) : quotedOrQuestioned.test(text))) return observation("uncertain");
  if (kind === "clarification_question") {
    if (clarificationQuestion(text)) return observation("question", text);
  } else if (kind === "secret_refusal") {
    if (secretReference.test(text) && refusal.test(text) && !positiveSharing.test(text) && !refusesRefusal.test(text) && !opposingClause.test(text)) return observation("boundary", text);
  } else if (kind === "independent_plan") {
    const assessment = validateEvaluation({ intent: "QUESTION", verify: true, confidence: output.data.confidence, evidence: text }, input, false);
    if (assessment.verify && firstPersonPlan.test(text)) return observation("verification_intent", text);
  } else if (kind === "caller_channel_trust") {
    if (firstPersonPlan.test(text) && trustCallerChannel.test(text) && !negation.test(text)) return observation("unsafe_commitment", text);
  } else if (kind === "uncertainty_recognized") {
    if (unsure.test(text)) return observation("question", text);
  } else if (kind === "harmless_information") {
    if (harmlessAcknowledgement.test(text)) return observation("harmless_acknowledgement", text);
  } else if (kind === "safe_exit") {
    if (firstPersonPlan.test(text) && exitAction.test(text) && !negation.test(text)) return observation("exit", text);
  }
  // In particular, numeric text or a model's disclosure assertion cannot create
  // a risk grade. V3 never requires a real or practice secret for progression.
  return observation("uncertain");
}

/** Hidden assignment is absent. `ended` means an authenticated participant End,
 * never expiry, a model decision, a network error or the turn limit. */
export function summarizeDecisions(observations: readonly DecisionObservation[], trustedPanelCompleted: boolean, ended: boolean): DecisionDimension[] {
  const turns = (kinds: DecisionObservation["kind"][]) => [...new Set(observations.filter((o) => kinds.includes(o.kind) && Number.isInteger(o.turn) && o.turn > 0 && o.turn <= 10).map((o) => o.turn))].sort((a, b) => a - b);
  const dimension = (id: DecisionDimension["id"], kinds: DecisionObservation["kind"][], reason: string): DecisionDimension => {
    const evidenceTurns = turns(kinds);
    return { id, status: evidenceTurns.length ? "observed_safe" : "not_tested", reason: evidenceTurns.length ? reason : "no_supported_observation", evidenceTurns };
  };
  const boundary = dimension("protect_secrets", ["boundary"], "boundary_kept");
  const verification = dimension("verify_independently", ["verification_intent"], "independent_check_planned");
  if (trustedPanelCompleted) { verification.status = "observed_safe"; verification.reason = "trusted_panel_checked"; }
  const channelRisk = turns(["unsafe_commitment"]);
  if (channelRisk.length) { verification.status = "observed_risk"; verification.reason = "caller_supplied_channel_trusted"; verification.evidenceTurns = [...new Set([...verification.evidenceTurns, ...channelRisk])].sort((a, b) => a - b); }
  const calibrated = dimension("calibrated_response", ["question", "harmless_acknowledgement"], "bounded_response_observed");
  if (calibrated.status === "not_tested" && turns(["uncertain"]).length) {
    calibrated.status = "uncertain"; calibrated.reason = "reply_interpretation_unresolved";
    calibrated.evidenceTurns = turns(["uncertain"]);
  }
  const exit = dimension("exit_safely", ["exit"], "exit_stated");
  if (ended) { exit.status = "observed_safe"; exit.reason = "participant_ended"; }
  return [boundary, verification, calibrated, exit];
}
