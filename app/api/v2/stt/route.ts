import { createVoiceHandlers, liveVoiceMode } from "@/server/v2/voice-http";
import { trustOrTrapEnabled } from "@/server/v3/config";
import { createSpeechGateway } from "@/server/v2/speech";
import { v2Database } from "@/server/v2/runtime";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createVoiceHandlers({ mode: () => trustOrTrapEnabled() ? null : liveVoiceMode(), database: v2Database, speech: createSpeechGateway }).sttPOST;
