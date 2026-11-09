import { createHash, randomUUID } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import type { Locale } from "../../domain/scenario";
import { z } from "zod";
import config from "../../../config/gnani.json";
import { readWav } from "../../domain/wav";
import { databaseWrite } from "./database";
import { LedgerError, markDispatched, reserveUsage, settleUsage, type SettlementStatus } from "./ledger";
import { currentSpeechSession } from "./speech-session";

export type SpeechErrorCode = "V2_SPEECH_DISABLED" | "V2_SPEECH_DUPLICATE" | "V2_SPEECH_FAILED" |
  "V2_SPEECH_CANCELLED" | "V2_SPEECH_INVALID_REQUEST" | "V2_SPEECH_SESSION_INACTIVE";
export class SpeechError extends Error {
  constructor(readonly code: SpeechErrorCode) { super(code); this.name = "SpeechError"; }
}
export type Transcription = { transcript: string; model: string; requestId: string; detectedLanguage?: string };
export type Synthesis = { audio: Uint8Array; contentType: "audio/wav"; model: string; voice: string };
export type SpeechSessionView = { locale: Locale; turn: number; lastCaller: string; updatedAt: number; ending: string | null };
export type SpeechStorage = {
  currentSpeechSession: (tx: Transaction, context: { sessionId: string; expectedTurn: number }, now: number) => Promise<SpeechSessionView | null>;
  enabled?: () => boolean;
  sttContext?: { keyterms: readonly string[]; topic: string };
};
type Stage = "stt" | "tts";
const fail = (code: SpeechErrorCode): never => { throw new SpeechError(code); };
const ContextSchema = z.object({ sessionId: z.uuid(), expectedTurn: z.number().int().min(0).max(10), operationId: z.uuid() }).strict();
const TranscriptSchema = z.object({
  success: z.literal(true), transcript: z.string().max(500),
  model: z.string().regex(/^(?:gnani-)?prisma-v(?:3\.0|2\.5)$/),
  request_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  detected_language_code: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(),
  truncated: z.literal(false).optional(),
});
type Outcome<T> = { status: number; value: T | null; requestId?: string };

function speechKey(stage: Stage) {
  const key = process.env.GNANI_API_KEY?.trim();
  return process.env.V2_LIVE_ENABLED === "true" && process.env.GNANI_MODE !== "mock" && key &&
    (stage !== "stt" || process.env.STT_ENABLED !== "false") ? key : null;
}
function operationId(id: string, stage: Stage) {
  const bytes = createHash("sha256").update(`scamsuno-v2-speech\0${id.toLowerCase()}\0${stage}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function checkedSignal(signal?: AbortSignal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) return fail("V2_SPEECH_INVALID_REQUEST");
  if (signal?.aborted) return fail("V2_SPEECH_CANCELLED");
}
async function cancellable<T>(action: () => Promise<T>, signal: AbortSignal): Promise<T> {
  checkedSignal(signal);
  let cancel!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(new SpeechError("V2_SPEECH_CANCELLED"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([action(), aborted]); }
  finally { signal.removeEventListener("abort", cancel); }
}
async function discard(response: Response) {
  try { await response.body?.cancel(); } catch { /* Never expose rejected provider data. */ }
}
async function boundedBytes(response: Response, limit: number, signal: AbortSignal): Promise<Uint8Array | null> {
  const advertised = response.headers.get("content-length");
  if ((advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > limit)) || !response.body) {
    await discard(response);
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      checkedSignal(signal);
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function parseTranscript(response: Response, signal: AbortSignal): Promise<Outcome<Transcription>> {
  const invalid = { status: response.status, value: null };
  if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    await discard(response);
    return invalid;
  }
  const bytes = await boundedBytes(response, 65_536, signal);
  if (!bytes) return invalid;
  try {
    const parsed = TranscriptSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) return invalid;
    const { transcript, model, request_id, detected_language_code } = parsed.data;
    return { status: 200, requestId: request_id, value: { transcript, model, requestId: request_id,
      ...(detected_language_code ? { detectedLanguage: detected_language_code } : {}) } };
  } catch { return invalid; }
}
function completeTimbreWav(audio: Uint8Array): Uint8Array | null {
  if (readWav(audio)?.sampleRate === 16_000) return audio;
  // Observed Timbre v3 streaming output uses two unknown-length sentinels in
  // this exact PCM header. Only a fully buffered, bounded response is completed.
  if (audio.byteLength < 46 || audio.byteLength > 2_000_000 || (audio.byteLength - 44) % 2) return null;
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(4, true) !== 0xffffffff ||
      view.getUint32(8) !== 0x57415645 || view.getUint32(12) !== 0x666d7420 || view.getUint32(16, true) !== 16 ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== 16_000 ||
      view.getUint32(28, true) !== 32_000 || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 ||
      view.getUint32(36) !== 0x64617461 || view.getUint32(40, true) !== 0xffffffff) return null;
  const completed = Uint8Array.from(audio);
  const header = new DataView(completed.buffer);
  header.setUint32(4, completed.byteLength - 8, true);
  header.setUint32(40, completed.byteLength - 44, true);
  return readWav(completed)?.sampleRate === 16_000 ? completed : null;
}
async function parseAudio(response: Response, signal: AbortSignal): Promise<Outcome<Synthesis>> {
  const invalid = { status: response.status, value: null };
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (response.status !== 200 || !["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(type ?? "")) {
    await discard(response);
    return invalid;
  }
  const buffered = await boundedBytes(response, 2_000_000, signal);
  const audio = buffered ? completeTimbreWav(buffered) : null;
  return audio ? { status: 200,
    value: { audio, contentType: "audio/wav", model: config.tts.model, voice: config.tts.voice } } : invalid;
}

/** Authenticated server routes supply the identity; callers cannot supply text, locale, or models. */
export function createSpeechGateway(
  client: Client, context: { sessionId: string; expectedTurn: number; operationId: string }, transport: typeof fetch = fetch,
  storage: SpeechStorage = { currentSpeechSession },
) {
  const parsed = ContextSchema.safeParse(context);
  if (!parsed.success) return fail("V2_SPEECH_INVALID_REQUEST");
  const identity = parsed.data;
  async function execute<T>(stage: Stage, signal: AbortSignal | undefined, audio: { bytes: Uint8Array; seconds: number } | null,
    parse: (response: Response, signal: AbortSignal) => Promise<Outcome<T>>): Promise<T> {
    checkedSignal(signal);
    const key = speechKey(stage);
    if (!key || storage.enabled?.() === false) return fail("V2_SPEECH_DISABLED");
    let session;
    try { session = await databaseWrite(client, (tx) => storage.currentSpeechSession(tx, identity, Date.now())); }
    catch { return fail("V2_SPEECH_FAILED"); }
    if (!session) return fail("V2_SPEECH_SESSION_INACTIVE");
    const attemptId = randomUUID();
    let reservation;
    try {
      const base = { attemptId, operationId: operationId(identity.operationId, stage), sessionId: identity.sessionId };
      reservation = await reserveUsage(client, stage === "stt"
        ? { ...base, kind: "gnani_stt", model: config.stt.primaryModel, audioSeconds: audio!.seconds }
        : { ...base, kind: "gnani_tts", model: config.tts.model, textChars: session.lastCaller.length });
    } catch (error) {
      return fail(error instanceof LedgerError && ["V2_ADMISSION_CLOSED", "V2_QUOTA_EXCEEDED"].includes(error.code)
        ? "V2_SPEECH_DISABLED" : "V2_SPEECH_FAILED");
    }
    if (!reservation.admitted) return fail("V2_SPEECH_DUPLICATE");
    async function settle(status: SettlementStatus, outcome?: Outcome<T>, latencyMs?: number) {
      try {
        await settleUsage(client, attemptId, status, {
          ...(outcome && outcome.status >= 100 && outcome.status <= 599 ? { statusCode: outcome.status } : {}),
          ...(outcome?.requestId ? { providerRequestId: outcome.requestId } : {}),
          ...(latencyMs !== undefined ? { latencyMs } : {}),
        });
      } catch { return fail("V2_SPEECH_FAILED"); }
    }
    if (signal?.aborted || speechKey(stage) !== key || storage.enabled?.() === false) {
      await settle("released");
      return fail(signal?.aborted ? "V2_SPEECH_CANCELLED" : "V2_SPEECH_DISABLED");
    }
    let dispatch;
    try {
      dispatch = await markDispatched(client, attemptId, undefined, async (tx, now) => {
        if (signal?.aborted || speechKey(stage) !== key || storage.enabled?.() === false) return false;
        const current = await storage.currentSpeechSession(tx, identity, Math.max(now, Date.now()));
        return Boolean(current && current.locale === session.locale && current.lastCaller === session.lastCaller &&
          current.updatedAt === session.updatedAt);
      });
    } catch { await settle("released"); return fail("V2_SPEECH_FAILED"); }
    if (!dispatch.dispatch) {
      if (dispatch.attempt.status !== "reserved") return fail("V2_SPEECH_DUPLICATE");
      await settle("released");
      return fail(signal?.aborted ? "V2_SPEECH_CANCELLED" : speechKey(stage) !== key || dispatch.reason !== "V2_SESSION_INACTIVE"
        ? "V2_SPEECH_DISABLED" : "V2_SPEECH_SESSION_INACTIVE");
    }
    const started = performance.now();
    const deadline = AbortSignal.timeout(stage === "stt" ? 15_000 : 20_000);
    const providerSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    let outcome: Outcome<T>;
    try {
      outcome = await cancellable(async () => {
        const headers = new Headers({ "X-API-Key-ID": key, "X-API-Request-ID": attemptId });
        let body: FormData | string;
        if (stage === "stt") {
          body = new FormData();
          body.set("audio_file", new Blob([Uint8Array.from(audio!.bytes)], { type: "audio/wav" }), "reply.wav");
          body.set("language_code", session.locale === "en" ? "en-IN" : `${session.locale}-IN,en-IN`);
          body.set("format", config.stt.format);
          body.set("model", config.stt.primaryModel);
          const context = storage.sttContext ?? config.stt;
          body.set("keyterms", JSON.stringify(context.keyterms));
          body.set("topic", context.topic);
        } else {
          headers.set("Content-Type", "application/json");
          body = JSON.stringify({ text: session.lastCaller, voice: config.tts.voice, model: config.tts.model,
            language: `${session.locale}-IN`, speed: 1,
            audio_config: { container: "wav", sample_rate: 16_000, num_channels: 1, sample_width: 2, encoding: "linear_pcm" } });
        }
        const response = await transport(`https://api.vachana.ai${stage === "stt" ? "/stt/v3" : "/api/v1/tts/inference"}`,
          { method: "POST", headers, body, signal: providerSignal, redirect: "error", cache: "no-store" });
        return parse(response, providerSignal);
      }, providerSignal);
    } catch {
      await settle("unknown", undefined, Math.min(86_400_000, Math.round(performance.now() - started)));
      return fail(providerSignal.aborted ? "V2_SPEECH_CANCELLED" : "V2_SPEECH_FAILED");
    }
    await settle(outcome.value === null ? "failed" : "succeeded", outcome,
      Math.min(86_400_000, Math.round(performance.now() - started)));
    if (outcome.value === null) return fail("V2_SPEECH_FAILED");
    return outcome.value;
  }
  return {
    async transcribe(wav: Uint8Array, signal?: AbortSignal): Promise<Transcription> {
      checkedSignal(signal);
      if (!(wav instanceof Uint8Array) || wav.byteLength > 600_000) return fail("V2_SPEECH_INVALID_REQUEST");
      const bytes = Uint8Array.from(wav);
      const metadata = readWav(bytes);
      if (!metadata || metadata.sampleRate !== 16_000 || metadata.seconds < 0.5 || metadata.seconds > 15) {
        return fail("V2_SPEECH_INVALID_REQUEST");
      }
      return execute("stt", signal, { bytes, seconds: metadata.seconds }, parseTranscript);
    },
    synthesize(signal?: AbortSignal): Promise<Synthesis> { return execute("tts", signal, null, parseAudio); },
  };
}
