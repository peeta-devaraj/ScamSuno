import { graph, lines, MAX_TURNS, SCENARIO, terminalLine, type Intent, type LineId, type Locale, type State, type Terminal } from "./scenario";
import { maskNumbers } from "./numbers";

export type Classification = {
  intent: Intent;
  verify: boolean;
  confidence: number;
  evidence: string;
  source: "detector" | "llm" | "button" | "guard" | "llm_error" | "unavailable" | "mock";
  reasons: string[];
  degraded: boolean;
};
export type SttMetadata = { model: string; gnaniRequestId: string; detectedLanguage?: string; usedFallback: boolean };
export type InputMode = "voice" | "typed" | "button";
export type Turn = {
  stateId: State;
  callerLineIds: LineId[];
  inputMode: InputMode;
  maskedTranscript: string;
  effectiveIntent: Intent;
  classification: Classification;
  stt?: SttMetadata;
};
export type EndedBy = "user" | "caller_gave_up" | "caller_success" | "limit" | "unclear";
export type Session = {
  v: 1;
  sessionId: string;
  scenarioId: typeof SCENARIO;
  locale: Locale;
  stateId: State;
  refuseCount: number;
  unclear: Partial<Record<State, number>>;
  visits: Partial<Record<State, number>>;
  lastCallerLineIds: LineId[];
  turns: Turn[];
  terminal: Terminal | null;
  endedBy: EndedBy | null;
};

export function start(sessionId: string, locale: Locale): Session {
  return { v: 1, sessionId, scenarioId: SCENARIO, locale, stateId: "INTRO", refuseCount: 0,
    unclear: {}, visits: { INTRO: 1 }, lastCallerLineIds: ["kyc.intro"], turns: [], terminal: null, endedBy: null };
}

export function step(session: Session, classification: Classification, reply: { inputMode: InputMode; text: string; stt?: SttMetadata }): Session {
  if (session.terminal) return session;
  const state = graph[session.stateId];
  const intent = classification.intent === "COMPLY" && state.demand === "none" ? "ACKNOWLEDGE" : classification.intent;
  const verify = classification.verify && (intent === "REFUSE" || intent === "QUESTION" || intent === "HANG_UP");
  const turn: Turn = {
    stateId: session.stateId, callerLineIds: session.lastCallerLineIds, inputMode: reply.inputMode,
    maskedTranscript: maskNumbers(reply.text), effectiveIntent: intent, stt: reply.stt,
    classification: { ...classification, verify, evidence: maskNumbers(classification.evidence) },
  };
  const next = { ...session, turns: [...session.turns, turn] };
  function end(terminal: Terminal, endedBy: EndedBy): Session {
    const lastCallerLineIds = terminal === "END_SAFE" && endedBy === "user" ? [] : [terminalLine[terminal]];
    return { ...next, terminal, endedBy, lastCallerLineIds };
  }
  if (intent === "HANG_UP" || verify) return end(verify ? "END_VERIFIED" : "END_SAFE", "user");
  if (intent === "COMPLY") return end("END_SCAMMED", "caller_success");
  if (intent === "REFUSE" && ++next.refuseCount >= 2) return end("END_SAFE", "caller_gave_up");
  if (intent === "UNCLEAR") {
    const count = (session.unclear[session.stateId] ?? 0) + 1;
    next.unclear = { ...session.unclear, [session.stateId]: count };
    if (count >= 3) return end("END_INCOMPLETE", "unclear");
    if (next.turns.length >= MAX_TURNS) return end("END_INCOMPLETE", "limit");
    return { ...next, lastCallerLineIds: [state.reprompt] };
  }
  const [stateId, ...lastCallerLineIds] = state[intent];
  const visits = (session.visits[stateId] ?? 0) + 1;
  if (visits > graph[stateId].maxVisits) return end("END_INCOMPLETE", "caller_gave_up");
  if (next.turns.length >= MAX_TURNS) return end("END_INCOMPLETE", "limit");
  return { ...next, stateId, lastCallerLineIds, visits: { ...session.visits, [stateId]: visits } };
}

export const criteriaIds = ["protect_secrets", "verify_independently", "exit_safely"] as const;
export const grades = ["PASS", "PARTIAL", "FAIL", "MISSED", "NOT_TESTED"] as const;
export type Grade = typeof grades[number];

export function score(session: Session) {
  const resolved = session.turns.filter((turn) => turn.effectiveIntent !== "UNCLEAR");
  const demandTested = resolved.some((turn) => graph[turn.stateId].demand === "otp");
  const asked = resolved.some((turn) => turn.effectiveIntent === "QUESTION");
  const verified = resolved.some((turn) => turn.classification.verify);
  const compromised = session.terminal === "END_SCAMMED";
  const exit: Grade = session.endedBy === "user" ? "PASS" : compromised ? "FAIL" :
    session.terminal === "END_SAFE" ? "PARTIAL" : session.endedBy === "unclear" || session.turns.at(-1)?.effectiveIntent === "UNCLEAR" ? "NOT_TESTED" : "MISSED";
  const values: [Grade, number, number][] = [
    [demandTested ? compromised ? "FAIL" : "PASS" : "NOT_TESTED", demandTested && !compromised ? 40 : 0, 40],
    [verified ? "PASS" : asked ? "PARTIAL" : demandTested ? "MISSED" : "NOT_TESTED", verified ? 25 : asked ? 10 : 0, 25],
    [exit, exit === "PASS" ? 15 : exit === "PARTIAL" ? 8 : 0, 15],
  ];
  const criteria = criteriaIds.map((id, i) => ({ id, grade: values[i][0], points: values[i][1], max: values[i][2] }));
  const tested = criteria.filter(({ grade }) => grade !== "NOT_TESTED");
  return { criteria, tested: tested.length, earned: tested.reduce((sum, item) => sum + item.points, 0),
    possible: tested.reduce((sum, item) => sum + item.max, 0) };
}

export function flagsFor(lineIds: LineId[]) {
  return [...new Set(lineIds.flatMap((id) => lines[id].flags))];
}
