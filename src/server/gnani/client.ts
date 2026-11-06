import { z } from "zod";
import config from "../../../config/gnani.json";
import type { Locale } from "../../domain/scenario";

const baseUrl = "https://api.vachana.ai";
const retries = new Set([429, 500, 502, 503, 504]);
const fallbackCodes = new Set(["INVALID_MODEL", "MODEL_UNSUPPORTED_LANGUAGE", "SCOPE_NOT_ALLOWED"]);
const knownCodes = new Set([...fallbackCodes, "EMPTY_AUDIO", "AUDIO_CONVERSION_ERROR",
  "UNSUPPORTED_AUDIO_FORMAT", "MAX_AUDIO_DURATION_EXCEEDED", "INVALID_FORMAT", "INVALID_LANGUAGE_CODE",
  "MISSING_API_KEY", "INVALID_API_KEY", "RATE_LIMITED", "UPSTREAM_TIMEOUT", "INSUFFICIENT_CREDITS"]);

export type PrismaModel = "prisma-v3.0" | "prisma-v2.5";
export type TimbreModel = "timbre-v3.0" | "timbre-v2.5";

export class GnaniError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`Gnani request failed (${status}, ${code})`);
  }
}

export function speechKey() {
  return process.env.GNANI_API_KEY?.trim() || "";
}

export function mockMode() {
  if (process.env.GNANI_MODE === "mock" && process.env.VERCEL_ENV === "production") {
    throw new Error("GNANI_MODE=mock is forbidden in Vercel production.");
  }
  return process.env.GNANI_MODE === "mock";
}

async function gnani<T>(
  path: string,
  request: (headers: Headers) => RequestInit,
  parse: (response: Response) => Promise<T>,
  deadline: number,
  transport: typeof fetch,
) {
  const key = speechKey();
  if (!key) throw new GnaniError(503, "KEY_NOT_CONFIGURED");
  const backoffs = [500, 1000];
  const headers = new Headers({ "X-API-Key-ID": key, "X-API-Request-ID": crypto.randomUUID() });
  for (let attempt = 0; ; attempt++) {
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) throw new GnaniError(504, "TIMEOUT");
    try {
      const response = await transport(`${baseUrl}${path}`, {
        ...request(headers),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(10_000, timeLeft)),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const code = body?.detail?.error_code ?? body?.error?.type ?? body?.error?.code;
        throw new GnaniError(response.status, knownCodes.has(code) ? code : "UPSTREAM_ERROR");
      }
      return await parse(response);
    } catch (error) {
      const safeError = error instanceof GnaniError ? error : new GnaniError(504, "NETWORK_OR_TIMEOUT");
      const delay = backoffs[attempt];
      if (!retries.has(safeError.status) || delay === undefined || Date.now() + delay >= deadline) throw safeError;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const prismaResponse = z.object({
  success: z.literal(true),
  transcript: z.string().max(10_000),
  model: z.string().regex(/^(?:gnani-)?prisma-v(?:3\.0|2\.5)$/),
  request_id: z.string().regex(/^[\w-]{1,128}$/),
  detected_language_code: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(),
  end_to_end_latency: z.number().nonnegative().optional(),
  truncated: z.boolean().optional(),
});

export async function prisma(wav: Uint8Array, locale: Locale,
  model: PrismaModel, deadline = Date.now() + 20_000, transport = fetch) {
  return gnani("/stt/v3", (headers) => {
    const form = new FormData();
    form.set("audio_file", new Blob([Uint8Array.from(wav)], { type: "audio/wav" }), "reply.wav");
    form.set("language_code", locale !== "en" && model === "prisma-v3.0" ? `${locale}-IN,en-IN` : `${locale}-IN`);
    form.set("format", config.stt.format);
    if (model === "prisma-v3.0") {
      form.set("model", model);
      form.set("keyterms", JSON.stringify(config.stt.keyterms));
      form.set("topic", config.stt.topic);
    } else {
      form.set("bias_list", "OTP,UPI,PIN,KYC,bank");
      form.set("bias_score", "1.0");
    }
    return { method: "POST", headers, body: form };
  }, async (response) => {
    const parsed = prismaResponse.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new GnaniError(502, "INVALID_RESPONSE");
    return parsed.data;
  }, deadline, transport);
}

let fallbackUntil = 0;

export async function transcribe(wav: Uint8Array, locale: Locale, transport = fetch) {
  const deadline = Date.now() + 20_000;
  if (Date.now() >= fallbackUntil) {
    try {
      return { ...await prisma(wav, locale, config.stt.primaryModel as PrismaModel, deadline, transport), usedFallback: false };
    } catch (error) {
      if (!(error instanceof GnaniError) || ![400, 403].includes(error.status) || !fallbackCodes.has(error.code)) throw error;
      const fallback = await prisma(wav, locale, config.stt.fallbackModel as PrismaModel, deadline, transport);
      // Model-wide restrictions are cached only after the fallback actually succeeds.
      if (error.code !== "MODEL_UNSUPPORTED_LANGUAGE") fallbackUntil = Date.now() + 600_000;
      return { ...fallback, usedFallback: true };
    }
  }
  return { ...await prisma(wav, locale, config.stt.fallbackModel as PrismaModel, deadline, transport), usedFallback: true };
}

export async function timbre(text: string, locale: Locale, model: TimbreModel,
  container: "mp3" | "wav", transport = fetch) {
  const language = `${locale}-IN`;
  const voice = model === "timbre-v3.0" ? config.tts.voice : config.tts.fallbackVoices[locale];
  return gnani("/api/v1/tts/inference", (headers) => {
    headers.set("Content-Type", "application/json");
    return { method: "POST", headers, body: JSON.stringify({
      text, voice, model, language, speed: 1,
      audio_config: container === "wav"
        ? { container, sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: "linear_pcm" }
        : { container, sample_rate: config.tts.sampleRate, bitrate: config.tts.bitrate, num_channels: 1 },
    }) };
  }, async (response) => {
    const contentType = response.headers.get("content-type")?.split(";")[0];
    const audio = new Uint8Array(await response.arrayBuffer());
    const formatMatches = container === "wav"
      ? String.fromCharCode(...audio.subarray(0, 4)) === "RIFF"
      : String.fromCharCode(...audio.subarray(0, 3)) === "ID3" || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
    if (!contentType?.startsWith("audio/") || audio.length <= 1024 || !formatMatches) {
      throw new GnaniError(502, "INVALID_AUDIO_RESPONSE");
    }
    return { audio, contentType, voice, language, model };
  }, Date.now() + 25_000, transport);
}
