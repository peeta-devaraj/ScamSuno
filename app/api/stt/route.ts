import { z } from "zod";
import { locales, SCENARIO, states, type Locale } from "@/domain/scenario";
import { readWav, RECORD_SECONDS, WAV_LIMIT } from "@/domain/wav";
import { GnaniError, mockMode, speechKey, transcribe } from "@/server/gnani/client";
import { boundedBody, failure, reply, withinLimit } from "@/server/http";
import { mintProof } from "@/server/proof";

export const runtime = "nodejs";
export const maxDuration = 30;

const fields = z.tuple([z.enum(locales), z.literal(SCENARIO), z.enum(states)]);

export async function POST(request: Request) {
  const mock = mockMode();
  // The isolated V2 release admits paid traffic only through its durable routes.
  // The preserved V1 deployment/tag retain their original live endpoint.
  if (process.env.VERCEL) return failure("VOICE_REQUIRES_V2", "Open the conversational practice call to use voice.", 503);
  if (process.env.STT_ENABLED === "false") return failure("STT_DISABLED", "Voice is paused. You can still type or pick a reply.", 503);
  if (!mock && !speechKey()) return failure("STT_UNAVAILABLE", "Voice is unavailable. You can still type or pick a reply.", 503);
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) return failure("AUDIO_INVALID", "Could not read that recording.", 400);
    const body = await boundedBody(request, WAV_LIMIT + 4096);
    if (!body) return failure("AUDIO_TOO_LONG", "Keep the recording under fifteen seconds.", 400);
    const form = await new Response(body, { headers: { "Content-Type": contentType } }).formData();
    const context = fields.safeParse([form.get("locale"), form.get("scenarioId"), form.get("stateId")]);
    const audio = form.get("audio");
    if (!context.success || !(audio instanceof File) || audio.type !== "audio/wav") {
      return failure("AUDIO_INVALID", "Could not read that recording.", 400);
    }
    const [locale] = context.data;
    if (audio.size > WAV_LIMIT) return failure("AUDIO_TOO_LONG", "Keep the recording under fifteen seconds.", 400);
    const wav = new Uint8Array(await audio.arrayBuffer());
    const shape = readWav(wav);
    if (!shape || shape.seconds < 0.5) return failure("AUDIO_INVALID", "Could not read that recording.", 400);
    if (shape.seconds > RECORD_SECONDS + 0.5) return failure("AUDIO_TOO_LONG", "Keep the recording under fifteen seconds.", 400);
    const configuredLimit = Number(process.env.STT_RATE_LIMIT_PER_10MIN);
    const limit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 && configuredLimit <= 100 ? configuredLimit : 20;
    if (!withinLimit(request, "stt", limit)) return failure("RATE_LIMITED", "Too many recordings. Wait or pick a reply.", 429, true);
    const fixture: Record<Locale, string> = {
      en: "I'll call my bank myself.", hi: "मैं खुद बैंक को फ़ोन करूँगी।",
      ta: "நானே என் வங்கிக்கு அழைப்பேன்.", te: "నేనే నా బ్యాంకుకు కాల్ చేస్తాను.",
    };
    const result = mock
      ? { transcript: request.headers.get("x-mock-transcript") ?? fixture[locale],
        model: "mock", request_id: `mock-${crypto.randomUUID()}`, detected_language_code: undefined, usedFallback: false, truncated: false }
      : await transcribe(wav, locale);
    const transcript = result.transcript.trim();
    if (result.truncated || transcript.length > 300) {
      return failure("TRANSCRIPT_TOO_LONG", "Try a shorter reply, or type it.", 400);
    }
    const stt = { model: result.model, gnaniRequestId: result.request_id, detectedLanguage: result.detected_language_code, usedFallback: result.usedFallback };
    return reply({ ok: true, transcript, empty: !transcript, stt, proof: transcript ? mintProof(locale, transcript, stt) : null });
  } catch (error) {
    if (!(error instanceof GnaniError)) return failure("AUDIO_INVALID", "Could not read that recording.", 400);
    if (error.status === 429) return failure("STT_BUSY", "Voice is busy. Retry or pick a reply.", 503, true);
    if (error.code === "MAX_AUDIO_DURATION_EXCEEDED") return failure("AUDIO_TOO_LONG", "Keep the recording under fifteen seconds.", 400);
    if (["EMPTY_AUDIO", "AUDIO_CONVERSION_ERROR", "UNSUPPORTED_AUDIO_FORMAT"].includes(error.code)) {
      return failure("AUDIO_INVALID", "Could not read that recording.", 400);
    }
    return failure("STT_UNAVAILABLE", "Voice is unavailable. You can still type or pick a reply.", 503, error.status >= 500);
  }
}
