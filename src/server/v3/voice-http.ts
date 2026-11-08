import { createVoiceHandlers, type VoiceHttpDependencies } from "../v2/voice-http";
import { sessionOwner } from "./conversation-http";
import { readStoredSession } from "./sessions";
import { currentSpeechSession } from "./speech";

/** Shared bounded speech HTTP protocol; only the owned V3 session store is selected. */
export function createV3VoiceHandlers(deps: Omit<VoiceHttpDependencies, "storage">) {
  return createVoiceHandlers({ ...deps, mode: () => {
    const mode = deps.mode();
    return mode === "fixture" && (process.env.VERCEL || ["preview", "production"].includes(process.env.VERCEL_ENV ?? "")) ? null : mode;
  }, storage: { sessionOwner, readStoredSession, currentSpeechSession } });
}
