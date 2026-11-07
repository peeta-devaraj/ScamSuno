import { maskNumbers } from "../numbers";
import type { Locale } from "../scenario";
import {
  LIMITS, OperationSchema, SCENARIO_V2, SessionSchema,
  type ConversationSession, type TurnOperation,
} from "./contracts";
import { validateDialogue, validateEvaluation } from "./safety";

const authored = {
  en: {
    opening: "Hello, this is Arun from fictional Kalpanik Bank. I'm calling about an urgent account update. Is this a good time?",
    pressure: "In this fictional call, I'm claiming your account needs an urgent update. What would you like to check before continuing?",
    practice_code: "For this fictional exercise, would you share the made-up practice code shown on screen? Never use a real code or personal information.",
    ended: "The practice call has ended. Let's review the decisions you made.",
    uncertain: "I didn't understand that clearly. Could you say what you would do in this fictional call?",
  },
  hi: {
    opening: "नमस्ते, मैं काल्पनिक कल्पनिक बैंक से अरुण बोल रहा हूँ। खाते में एक ज़रूरी बदलाव के बारे में बात करनी है। क्या अभी बात हो सकती है?",
    pressure: "इस काल्पनिक कॉल में मैं खाते में तुरंत बदलाव का दावा कर रहा हूँ। आगे बढ़ने से पहले आप क्या जाँचना चाहेंगे?",
    practice_code: "इस काल्पनिक अभ्यास में, क्या आप स्क्रीन पर दिखाया गया बनाया हुआ अभ्यास कोड बताएँगे? असली कोड या निजी जानकारी कभी इस्तेमाल न करें।",
    ended: "अभ्यास कॉल समाप्त हो गई है। अब आपके फैसलों पर नज़र डालते हैं।",
    uncertain: "मैं ठीक से समझ नहीं पाया। इस काल्पनिक कॉल में आप क्या करेंगे, दोबारा बताएँगे?",
  },
  ta: {
    opening: "வணக்கம், கற்பனையான கற்பனிக் வங்கியிலிருந்து அருண் பேசுகிறேன். கணக்கில் அவசரமாக ஒரு மாற்றம் செய்வது பற்றிப் பேச வேண்டும். இப்போது பேசலாமா?",
    pressure: "இந்தக் கற்பனை அழைப்பில், உங்கள் கணக்கை உடனே புதுப்பிக்க வேண்டும் என்று கூறுகிறேன். தொடர்வதற்கு முன் என்ன சரிபார்க்க விரும்புகிறீர்கள்?",
    practice_code: "இந்தக் கற்பனைப் பயிற்சியில், திரையில் காட்டப்படும் போலிப் பயிற்சிக் குறியீட்டைச் சொல்வீர்களா? உண்மையான குறியீட்டையோ தனிப்பட்ட தகவலையோ பயன்படுத்த வேண்டாம்.",
    ended: "பயிற்சி அழைப்பு முடிந்தது. நீங்கள் எடுத்த முடிவுகளை இப்போது பார்ப்போம்.",
    uncertain: "நீங்கள் சொன்னது தெளிவாகப் புரியவில்லை. இந்தக் கற்பனை அழைப்பில் என்ன செய்வீர்கள் என்று மீண்டும் சொல்வீர்களா?",
  },
  te: {
    opening: "నమస్కారం, కల్పిత కల్పనిక్ బ్యాంకు నుంచి అరుణ్ మాట్లాడుతున్నాను. ఖాతాలో అత్యవసర మార్పు గురించి మాట్లాడాలి. ఇప్పుడు మాట్లాడవచ్చా?",
    pressure: "ఈ కల్పిత కాల్‌లో మీ ఖాతాను వెంటనే అప్‌డేట్ చేయాలని చెబుతున్నాను. ముందుకు వెళ్లే ముందు మీరు ఏం తనిఖీ చేయాలనుకుంటున్నారు?",
    practice_code: "ఈ కల్పిత సాధనలో, తెరపై కనిపించే తయారు చేసిన సాధన కోడ్ చెబుతారా? నిజమైన కోడ్ లేదా వ్యక్తిగత సమాచారాన్ని ఎప్పుడూ ఉపయోగించవద్దు.",
    ended: "సాధన కాల్ ముగిసింది. ఇప్పుడు మీరు తీసుకున్న నిర్ణయాలను పరిశీలిద్దాం.",
    uncertain: "మీరు చెప్పింది స్పష్టంగా అర్థం కాలేదు. ఈ కల్పిత కాల్‌లో మీరు ఏం చేస్తారో మళ్లీ చెబుతారా?",
  },
} satisfies Record<Locale, Record<"opening" | "pressure" | "practice_code" | "ended" | "uncertain", string>>;

export class ConversationConflict extends Error {
  constructor(readonly code: "INVALID_SESSION" | "STALE_TURN" | "SESSION_ENDED" | "INVALID_OPERATION") {
    super(code); this.name = "ConversationConflict";
  }
}

/** Server persistence must supply the session; never trust an envelope posted by a browser. */
export function startConversation(sessionId: string, locale: Locale, now: number): ConversationSession {
  return SessionSchema.parse({
    v: 2, scenarioId: SCENARIO_V2, sessionId, locale, createdAt: now, updatedAt: now,
    expiresAt: now + LIMITS.sessionMs, turn: 0, phase: "opening", ending: null,
    refusals: 0, unclear: 0, history: [], observations: [], lastCaller: authored[locale].opening,
  });
}

export function advanceConversation(
  storedSession: ConversationSession, input: TurnOperation, evaluationCandidate: unknown,
  source: "hosted" | "fixture", now: number,
): ConversationSession {
  const parsedSession = SessionSchema.safeParse(storedSession);
  if (!parsedSession.success || !Number.isSafeInteger(now) || now < storedSession.updatedAt) {
    throw new ConversationConflict("INVALID_SESSION");
  }
  const parsedInput = OperationSchema.safeParse(input);
  if (!parsedInput.success) throw new ConversationConflict("INVALID_OPERATION");
  const s = parsedSession.data, operation = parsedInput.data;
  if (s.ending) throw new ConversationConflict("SESSION_ENDED");
  if (s.sessionId !== operation.sessionId || s.turn !== operation.expectedTurn) {
    throw new ConversationConflict("STALE_TURN");
  }
  if (now >= s.expiresAt) {
    return { ...s, phase: "ended", ending: "expired", updatedAt: now, lastCaller: authored[s.locale].ended };
  }
  const reply = operation.reply, demandActive = s.phase === "practice_code";
  const assessment = validateEvaluation(evaluationCandidate, reply, demandActive, source);
  // Sensitive evidence is only used transiently. History and assessment retention are masked.
  const retainedAssessment = { ...assessment, evidence: maskNumbers(assessment.evidence) };
  const participant = reply.origin === "button" ? `[button:${reply.id}]` : maskNumbers(reply.text);
  const turn = s.turn + 1;
  let ending: ConversationSession["ending"] = null;
  const refusals = Math.min(2, s.refusals + Number(assessment.intent === "REFUSE"));
  const unclear = assessment.intent === "UNCLEAR" ? s.unclear + 1 : 0;
  if (assessment.verify) ending = "verified";
  else if (assessment.intent === "HANG_UP") ending = "participant";
  else if (assessment.intent === "COMPLY" && demandActive) ending = "practice_disclosed";
  else if (refusals >= 2) ending = "refused";
  else if (unclear >= 3) ending = "uncertain";
  else if (turn >= LIMITS.turns) ending = "limit";
  const phase = ending ? "ended" : assessment.intent === "UNCLEAR" ? s.phase :
    s.phase === "opening" ? "pressure" : "practice_code";
  const next: ConversationSession = {
    ...s, phase, ending, turn, refusals, unclear, updatedAt: now,
    history: [...s.history, { turn, phase: s.phase as Exclude<typeof s.phase, "ended">,
      caller: maskNumbers(s.lastCaller), participant, origin: reply.origin }].slice(-LIMITS.history),
    observations: [...s.observations, { turn, demandActive, origin: reply.origin, assessment: retainedAssessment }],
    lastCaller: ending ? authored[s.locale].ended : assessment.intent === "UNCLEAR" ?
      authored[s.locale].uncertain : authored[s.locale][phase],
  };
  return SessionSchema.parse(next);
}

/** A generated response can vary wording, never the phase, ending, score or trusted challenge. */
export function attachCaller(
  session: ConversationSession, candidate: unknown, source: "hosted" | "fixture",
): { session: ConversationSession; source: "hosted" | "fixture" | "authored_fallback"; reason?: string } {
  const s = SessionSchema.parse(session);
  if (s.ending) return { session: s, source: "authored_fallback" };
  const checked = validateDialogue(candidate, {
    locale: s.locale, lastCaller: s.history.at(-1)?.caller ?? s.lastCaller, ending: false,
  }, source);
  if (!checked.ok) return { session: s, source: "authored_fallback", reason: checked.reason };
  const text = checked.dialogue.text + (s.phase === "practice_code" ? ` ${authored[s.locale].practice_code}` : "");
  if (text.length > LIMITS.callerChars) return { session: s, source: "authored_fallback", reason: "combined_length" };
  return { session: SessionSchema.parse({ ...s, lastCaller: text }), source: checked.dialogue.source };
}

export function conversationScore(session: ConversationSession) {
  const s = SessionSchema.parse(session);
  const resolved = s.observations.filter((o) => o.assessment.intent !== "UNCLEAR");
  const demand = resolved.filter((o) => o.demandActive);
  const disclosed = demand.some((o) => o.assessment.intent === "COMPLY");
  const refusedDemand = demand.some((o) => o.assessment.intent === "REFUSE" || o.assessment.intent === "HANG_UP");
  const verified = resolved.some((o) => o.assessment.verify);
  const questioned = resolved.some((o) => o.assessment.intent === "QUESTION");
  const endedSafely = s.ending === "participant" || s.ending === "verified";
  type Result = { id: typeof criteriaIds[number]; status: "PASS" | "PARTIAL" | "FAIL" | "NOT_TESTED"; points: number; max: number; evidenceTurns: number[] };
  const criteriaIds = ["protect_secrets", "verify_independently", "exit_safely"] as const;
  const results: Result[] = [
    { id: "protect_secrets", status: disclosed ? "FAIL" : refusedDemand ? "PASS" : "NOT_TESTED",
      points: !disclosed && refusedDemand ? 40 : 0, max: 40, evidenceTurns: demand.filter((o) =>
        ["COMPLY", "REFUSE", "HANG_UP"].includes(o.assessment.intent)).map((o) => o.turn) },
    { id: "verify_independently", status: verified ? "PASS" : questioned ? "PARTIAL" : "NOT_TESTED",
      points: verified ? 25 : questioned ? 10 : 0, max: 25, evidenceTurns: resolved.filter((o) =>
        o.assessment.verify || o.assessment.intent === "QUESTION").map((o) => o.turn) },
    { id: "exit_safely", status: endedSafely ? "PASS" : s.ending === "practice_disclosed" ? "FAIL" :
      s.ending === "refused" ? "PARTIAL" : "NOT_TESTED", points: endedSafely ? 15 : s.ending === "refused" ? 8 : 0,
      max: 15, evidenceTurns: resolved.filter((o) => o.assessment.intent === "HANG_UP" ||
        o.assessment.verify || o.assessment.intent === "COMPLY" || (s.ending === "refused" && o.assessment.intent === "REFUSE")).map((o) => o.turn) },
  ];
  const tested = results.filter((r) => r.status !== "NOT_TESTED");
  return { criteria: results, tested: tested.length, possible: tested.reduce((n, r) => n + r.max, 0),
    earned: tested.reduce((n, r) => n + r.points, 0), educationalOnly: true as const };
}
