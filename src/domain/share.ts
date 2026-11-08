import { z } from "zod";
import { criteriaIds, grades, type Grade, type Session, score } from "./engine";
import { locales, SCENARIO, terminals } from "./scenario";
import { copy } from "./copy";
import { SCENARIO_V2, SessionSchema, type ConversationSession } from "./v2/contracts";
import { conversationScore } from "./v2/controller";

export const outcomeNames = {
  END_SAFE: "Ended safely", END_VERIFIED: "Verified independently",
  END_SCAMMED: "Fell for the simulation", END_INCOMPLETE: "No clear decision",
};

export const criterionNames = {
  protect_secrets: "Protect your code", verify_independently: "Verify independently", exit_safely: "End the call safely",
};

export const gradeNames: Record<Grade, string> = {
  PASS: "Passed", PARTIAL: "Partial", FAIL: "Failed", MISSED: "Missed", NOT_TESTED: "Not tested",
};

const v1Payload = z.object({
  v: z.literal(1), s: z.literal(SCENARIO), l: z.enum(locales), o: z.enum(terminals),
  c: z.tuple([z.enum(grades), z.enum(grades), z.enum(grades)]),
}).strict();
const v2Payload = z.object({
  v: z.literal(2), s: z.literal(SCENARIO_V2), l: z.enum(locales), o: z.enum(terminals),
  c: z.tuple([z.enum(["PASS", "PARTIAL", "FAIL", "NOT_TESTED"]),
    z.enum(["PASS", "PARTIAL", "FAIL", "NOT_TESTED"]), z.enum(["PASS", "PARTIAL", "FAIL", "NOT_TESTED"])]),
}).strict();
const payload = z.discriminatedUnion("v", [v1Payload, v2Payload]);
export type SharePayload = z.infer<typeof payload>;

export function encodeShare(session: Session) {
  return Buffer.from(JSON.stringify({ v: 1, s: SCENARIO, l: session.locale, o: session.terminal,
    c: score(session).criteria.map(({ grade }) => grade) })).toString("base64url");
}

/** A share contains enum-only training feedback, never evidence or session provenance. */
export function encodeConversationShare(session: ConversationSession) {
  const checked = SessionSchema.safeParse(session);
  if (!checked.success || !checked.data.ending) throw new Error("V2_SHARE_NOT_READY");
  const current = checked.data;
  const outcomes = { participant: "END_SAFE", refused: "END_SAFE", verified: "END_VERIFIED",
    practice_disclosed: "END_SCAMMED", limit: "END_INCOMPLETE", uncertain: "END_INCOMPLETE", expired: "END_INCOMPLETE" } as const;
  const shared = v2Payload.parse({ v: 2, s: SCENARIO_V2, l: current.locale, o: outcomes[current.ending!],
    c: conversationScore(current).criteria.map(({ status }) => status) });
  return Buffer.from(JSON.stringify(shared)).toString("base64url");
}

const conversationOutcomes = {
  en: { END_SAFE: "Ended safely", END_VERIFIED: "Verified independently", END_SCAMMED: "Shared practice code", END_INCOMPLETE: "No clear decision" },
  hi: { END_SAFE: "कॉल सुरक्षित रूप से समाप्त की", END_VERIFIED: "स्वतंत्र रूप से सत्यापन किया", END_SCAMMED: "अभ्यास का कोड साझा किया", END_INCOMPLETE: "कोई स्पष्ट निर्णय नहीं" },
  ta: { END_SAFE: "அழைப்பைப் பாதுகாப்பாக முடித்தீர்கள்", END_VERIFIED: "நீங்களே சரிபார்த்தீர்கள்", END_SCAMMED: "பயிற்சிக் குறியீட்டைப் பகிர்ந்தீர்கள்", END_INCOMPLETE: "தெளிவான முடிவு இல்லை" },
  te: { END_SAFE: "కాల్‌ను సురక్షితంగా ముగించారు", END_VERIFIED: "స్వయంగా తనిఖీ చేశారు", END_SCAMMED: "సాధన కోడ్‌ను పంచుకున్నారు", END_INCOMPLETE: "స్పష్టమైన నిర్ణయం లేదు" },
} as const;

/** V1 shared-page wording stays unchanged; V2 describes only the fictional exercise. */
export function outcomeLabel(data: SharePayload) {
  return data.v === 2 ? conversationOutcomes[data.l][data.o] : data.l === "en" ? outcomeNames[data.o] : copy[data.l][data.o];
}

export function decodeShare(token?: string | null): SharePayload | null {
  if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(token)) return null;
  try {
    const result = payload.safeParse(JSON.parse(Buffer.from(token, "base64url").toString("utf8")));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function shareStats(data: SharePayload) {
  const maxima = [40, 25, 15];
  const partials = [0, 10, 8];
  const earned = data.c.reduce((sum, grade, i) => sum + (grade === "PASS" ? maxima[i] : grade === "PARTIAL" ? partials[i] : 0), 0);
  const possible = data.c.reduce((sum, grade, i) => sum + (grade === "NOT_TESTED" ? 0 : maxima[i]), 0);
  return { earned, possible, criteria: criteriaIds.map((id, i) => ({
    name: data.v === 2 ? copy[data.l][id] : criterionNames[id],
    grade: data.v === 2 ? copy[data.l][data.c[i]] : gradeNames[data.c[i]],
  })) };
}
