import { createV3VoiceHandlers } from "@/server/v3/voice-http";
import { createV3SpeechGateway, liveV3VoiceMode } from "@/server/v3/speech";
import { v3Database } from "@/server/v3/runtime";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createV3VoiceHandlers({ mode: liveV3VoiceMode, database: v3Database, speech: createV3SpeechGateway }).sttPOST;
