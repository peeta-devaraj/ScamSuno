import { z } from "zod";
import { audioFor } from "@/domain/audio";
import { score, start, step, type Session } from "@/domain/engine";
import { buttons, graph, intents, lines, locales, MAX_TURNS, SCENARIO, states, terminals, type LineId } from "@/domain/scenario";
import { encodeShare } from "@/domain/share";
import { classify, classifyButton, llmConfig } from "@/server/classifier";
import { boundedBody, failure, reply, withinLimit } from "@/server/http";
import { verifyProof } from "@/server/proof";

export const runtime = "nodejs";
export const maxDuration = 15;

const lineId = z.custom<LineId>((value) => typeof value === "string" && Object.hasOwn(lines, value));
const stt = z.object({
  model: z.string().regex(/^(?:mock|(?:gnani-)?prisma-v(?:3\.0|2\.5))$/),
  gnaniRequestId: z.string().regex(/^[\w-]{1,128}$/),
  detectedLanguage: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(), usedFallback: z.boolean(),
});
const classification = z.object({
  intent: z.enum(intents), verify: z.boolean(), confidence: z.number().min(0).max(1), evidence: z.string().max(300),
  source: z.enum(["detector", "llm", "button", "guard", "llm_error", "unavailable", "mock"]),
  reasons: z.array(z.string().max(64)).max(4), degraded: z.boolean(),
});
const counter = z.partialRecord(z.enum(states), z.number().int().min(0).max(MAX_TURNS));
const sessionShape = z.object({
  v: z.literal(1), sessionId: z.uuid(), scenarioId: z.literal(SCENARIO), locale: z.enum(locales),
  stateId: z.enum(states), refuseCount: z.number().int().min(0).max(2), unclear: counter, visits: counter,
  lastCallerLineIds: z.array(lineId).max(2),
  turns: z.array(z.object({ stateId: z.enum(states), callerLineIds: z.array(lineId).min(1).max(2),
    inputMode: z.enum(["voice", "typed", "button"]), maskedTranscript: z.string().max(300), stt: stt.optional(),
    effectiveIntent: z.enum(intents), classification })).max(MAX_TURNS),
  terminal: z.enum(terminals).nullable(),
  endedBy: z.enum(["user", "caller_gave_up", "caller_success", "limit", "unclear"]).nullable(),
});
const transcript = z.string().trim().min(1).max(300);
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), sessionId: z.uuid(), scenarioId: z.literal(SCENARIO), locale: z.enum(locales) }),
  z.object({ action: z.literal("hangup"), session: sessionShape }),
  z.object({ action: z.literal("reply"), session: sessionShape, reply: z.discriminatedUnion("inputMode", [
    z.object({ inputMode: z.literal("typed"), text: transcript }),
    z.object({ inputMode: z.literal("voice"), text: transcript, stt, proof: z.string().max(128) }),
    z.object({ inputMode: z.literal("button"), buttonId: z.enum(buttons) }),
  ]) }),
]);

function stateResponse(session: Session, showQuickReplies: boolean, stalled = false) {
  return reply({ ok: true, session, terminal: session.terminal, stalled,
    classification: stalled ? null : session.turns.at(-1)?.classification ?? null,
    play: stalled ? [] : session.lastCallerLineIds.map((lineId) => ({
      lineId, caption: lines[lineId][session.locale], audioUrl: audioFor(lineId, session.locale),
    })),
    result: session.terminal ? { ...score(session), shareToken: encodeShare(session) } : null,
    ui: { showQuickReplies, showTypingHelper: (session.unclear[session.stateId] ?? 0) >= 2 },
  });
}

export async function POST(request: Request) {
  if (!withinLimit(request, "turn", 150)) return failure("RATE_LIMITED", "Too many requests. Please wait.", 429, true);
  try {
    const body = await boundedBody(request, 65_536);
    if (!body) return failure("INVALID_TURN", "Could not read that reply.", 400);
    const decoded = input.safeParse(JSON.parse(new TextDecoder().decode(body)));
    if (!decoded.success) return failure("INVALID_TURN", "Could not read that reply.", 400);
    const data = decoded.data;
    if (data.action === "start") return stateResponse(start(data.sessionId, data.locale), !llmConfig());
    const session: Session = data.session;
    if (session.terminal) return failure("SESSION_ENDED", "This call has already ended.", 409);
    if (session.turns.length >= MAX_TURNS || !session.lastCallerLineIds.length || session.endedBy !== null) {
      return failure("INVALID_SESSION", "Start a new call to continue.", 400);
    }
    const userReply = data.action === "hangup" ? { inputMode: "button", buttonId: "hang_up" } as const : data.reply;
    const demand = graph[session.stateId].demand;
    if (userReply.inputMode === "button") {
      return stateResponse(step(session, classifyButton(userReply.buttonId, demand), { inputMode: "button", text: userReply.buttonId }), !llmConfig());
    }
    if (userReply.inputMode === "voice" && !verifyProof(userReply.proof, session.locale, userReply.text, userReply.stt)) {
      return failure("VOICE_CONFIRMATION_EXPIRED", "Record your reply again or switch to typing.", 400);
    }
    const lastLine = lines[session.lastCallerLineIds.at(-1)!].en;
    const judgement = await classify(userReply.text, { demand, lastLineEn: lastLine });
    if (judgement.degraded) return stateResponse(session, true, true);
    const next = step(session, judgement, userReply);
    return stateResponse(next, !llmConfig() || (next.unclear[next.stateId] ?? 0) >= 2);
  } catch {
    return failure("INVALID_TURN", "Could not process that reply.", 400);
  }
}
