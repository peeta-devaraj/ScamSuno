import { z } from "zod";
import { criteriaIds, grades, type Grade, type Session, score } from "./engine";
import { locales, SCENARIO, terminals } from "./scenario";

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

const payload = z.object({
  v: z.literal(1), s: z.literal(SCENARIO), l: z.enum(locales), o: z.enum(terminals),
  c: z.tuple([z.enum(grades), z.enum(grades), z.enum(grades)]),
}).strict();
export type SharePayload = z.infer<typeof payload>;

export function encodeShare(session: Session) {
  return Buffer.from(JSON.stringify({ v: 1, s: SCENARIO, l: session.locale, o: session.terminal,
    c: score(session).criteria.map(({ grade }) => grade) })).toString("base64url");
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
  return { earned, possible, criteria: criteriaIds.map((id, i) => ({ name: criterionNames[id], grade: gradeNames[data.c[i]] })) };
}
