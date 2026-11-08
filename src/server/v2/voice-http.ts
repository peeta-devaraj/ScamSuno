import type { Client } from "@libsql/client";
import { z } from "zod";
import { readWav, RECORD_SECONDS, WAV_LIMIT } from "../../domain/wav";
import { boundedBody, failure, reply, withinLimit } from "../http";
import { sessionOwner } from "./conversation-http";
import { databaseWrite } from "./database";
import { readStoredSession } from "./sessions";
import type { Synthesis, Transcription, SpeechStorage, SpeechSessionView } from "./speech";
import { currentSpeechSession } from "./speech-session";
import { mintVoiceProof, voiceProofReady } from "./voice-proof";

const ContextSchema = z.object({ sessionId: z.uuid(), expectedTurn: z.number().int().min(0).max(10), operationId: z.uuid() }).strict();
type SpeechContext = z.infer<typeof ContextSchema>;
export type VoiceHttpDependencies = {
  mode: () => "live" | "fixture" | null;
  database: () => Promise<Client>;
  speech: (client: Client, context: SpeechContext) => {
    transcribe: (wav: Uint8Array, signal?: AbortSignal) => Promise<Transcription>;
    synthesize: (signal?: AbortSignal) => Promise<Synthesis>;
  };
  storage?: {
    sessionOwner: typeof sessionOwner;
    readStoredSession: (client: Client, sessionId: string, secret: string) => Promise<unknown>;
    currentSpeechSession: SpeechStorage["currentSpeechSession"];
  };
};
const TranscriptionSchema = z.object({
  transcript: z.string().max(500), model: z.string().regex(/^(?:gnani-)?prisma-v(?:3\.0|2\.5)$/),
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  detectedLanguage: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(),
}).strict();
class VoiceHttpError extends Error {
  constructor(readonly code: "V2_SESSION_NOT_FOUND" | "V2_SPEECH_SESSION_INACTIVE") { super(code); }
}
const invalid = () => failure("V2_SPEECH_INVALID_REQUEST", "Could not read that voice request.", 400);
const unavailable = () => failure("V2_SPEECH_DISABLED", "Voice is unavailable. Type your reply or use a quick reply.", 503);

/** Only the deployed live adapter is selected here; fixtures require explicit dependency injection. */
export function liveVoiceMode(): "live" | null {
  return process.env.V2_LIVE_ENABLED === "true" && process.env.GNANI_MODE !== "mock" && process.env.GNANI_API_KEY?.trim() && voiceProofReady()
    ? "live" : null;
}
function trustedOrigin(request: Request) {
  const url = new URL(request.url);
  const localDevelopment = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.VERCEL_ENV;
  return request.headers.get("origin") === url.origin && (url.protocol === "https:" || localDevelopment);
}
function safeFailure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "V2_SESSION_NOT_FOUND" || code === "V3_SESSION_NOT_FOUND") return failure(code, "Start a practice call to use voice.", 401);
  if (code === "V2_SPEECH_SESSION_INACTIVE" || code === "V2_SPEECH_DUPLICATE" || code === "V2_STALE_TURN" || code === "V2_SESSION_ENDED" || code === "V3_STALE_TURN" || code === "V3_SESSION_ENDED") {
    return failure(code, "This call changed. Continue with its current turn or start a new call.", 409);
  }
  if (code === "V2_SPEECH_INVALID_REQUEST") return invalid();
  return unavailable();
}
async function authorized(deps: VoiceHttpDependencies, request: Request, context: SpeechContext) {
  const store = deps.storage ?? { sessionOwner, readStoredSession, currentSpeechSession };
  const secret = store.sessionOwner(request, context.sessionId);
  if (!secret) throw new VoiceHttpError("V2_SESSION_NOT_FOUND");
  const client = await deps.database();
  await store.readStoredSession(client, context.sessionId, secret);
  const session = await databaseWrite(client, (tx) => store.currentSpeechSession(tx, context, Date.now()));
  if (!session) throw new VoiceHttpError("V2_SPEECH_SESSION_INACTIVE");
  return { client, secret, session };
}
async function stillCurrent(client: Client, context: SpeechContext, captured: SpeechSessionView, reader: SpeechStorage["currentSpeechSession"] = currentSpeechSession) {
  const current = await databaseWrite(client, (tx) => reader(tx, context, Date.now()));
  if (!current || current.locale !== captured.locale || current.lastCaller !== captured.lastCaller || current.updatedAt !== captured.updatedAt) {
    throw new VoiceHttpError("V2_SPEECH_SESSION_INACTIVE");
  }
}

/** All audio and transcripts live only in the request/response; storage receives no reply content here. */
export function createVoiceHandlers(deps: VoiceHttpDependencies) {
  async function handle(request: Request, kind: "stt" | "tts"): Promise<Response> {
    try {
      if (!trustedOrigin(request)) return failure("V2_SPEECH_INVALID_ORIGIN", "Open the call page to use voice.", 403);
      const mode = deps.mode();
      if (!mode || (mode === "fixture" && process.env.VERCEL_ENV === "production")) return unavailable();
      if (request.method !== "POST") return invalid();
      const contentType = request.headers.get("content-type") ?? "";
      const mime = contentType.split(";")[0].trim().toLowerCase();
      if (contentType.length > 256 || mime !== (kind === "stt" ? "multipart/form-data" : "application/json")) return invalid();
      const body = await boundedBody(request, kind === "stt" ? WAV_LIMIT + 2048 : 2048);
      if (!body) return invalid();
      let context: SpeechContext;
      let wav: Uint8Array | null = null;
      try {
        if (kind === "stt") {
          const form = await new Response(Uint8Array.from(body), { headers: { "Content-Type": contentType } }).formData();
          const entries = [...form.entries()];
          const expected = ["sessionId", "expectedTurn", "operationId", "audio"];
          if (entries.length !== 4 || expected.some((name) => form.getAll(name).length !== 1) ||
              entries.some(([name]) => !expected.includes(name))) return invalid();
          const turn = form.get("expectedTurn"), audio = form.get("audio");
          if (typeof turn !== "string" || !/^(?:[0-9]|10)$/.test(turn) || !(audio instanceof File) ||
              audio.type !== "audio/wav" || audio.size > WAV_LIMIT) return invalid();
          context = ContextSchema.parse({ sessionId: form.get("sessionId"), expectedTurn: Number(turn), operationId: form.get("operationId") });
          wav = new Uint8Array(await audio.arrayBuffer());
          const shape = readWav(wav);
          if (!shape || shape.sampleRate !== 16_000 || shape.seconds < 0.5 || shape.seconds > RECORD_SECONDS) return invalid();
        } else {
          context = ContextSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
        }
      } catch { return invalid(); }
      const { client, secret, session } = await authorized(deps, request, context);
      if (request.signal.aborted) return unavailable();
      if (!withinLimit(request, "v2-voice", 80)) return failure("V2_SPEECH_RATE_LIMITED", "Please wait before another voice request.", 429);
      const speech = deps.speech(client, context);
      if (kind === "stt") {
        const parsed = TranscriptionSchema.safeParse(await speech.transcribe(wav!, request.signal));
        if (!parsed.success) return unavailable();
        await stillCurrent(client, context, session, deps.storage?.currentSpeechSession);
        if (request.signal.aborted) return unavailable();
        const { transcript, model, requestId, detectedLanguage } = parsed.data;
        const confirmation = transcript.trim() ? mintVoiceProof(secret, { sessionId: context.sessionId,
          expectedTurn: context.expectedTurn, locale: session.locale, text: transcript, model, requestId })
          : { proof: null, expiresAt: null };
        return reply({ ok: true, mode, educationalSimulation: true, transcript,
          stt: { model, requestId, ...(detectedLanguage ? { detectedLanguage } : {}) }, ...confirmation });
      }
      const result = await speech.synthesize(request.signal);
      const shape = result.audio instanceof Uint8Array && result.audio.byteLength <= 2_000_000 ? readWav(result.audio) : null;
      if (!shape || shape.sampleRate !== 16_000 || result.contentType !== "audio/wav" ||
          !/^timbre-v(?:3\.0|2\.5)$/.test(result.model)) return unavailable();
      await stillCurrent(client, context, session, deps.storage?.currentSpeechSession);
      if (request.signal.aborted) return unavailable();
      return new Response(Uint8Array.from(result.audio), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "X-Gnani-Model": result.model, "X-ScamSuno-Mode": mode, "X-Educational-Simulation": "true" } });
    } catch (error) { return safeFailure(error); }
  }
  return { sttPOST: (request: Request) => handle(request, "stt"), ttsPOST: (request: Request) => handle(request, "tts") };
}
