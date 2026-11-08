import { createVoiceHandlers, liveVoiceMode } from "@/server/v2/voice-http";
import { createSpeechGateway } from "@/server/v2/speech";
import { v2Database } from "@/server/v2/runtime";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createVoiceHandlers({ mode: liveVoiceMode, database: v2Database, speech: createSpeechGateway }).ttsPOST;
