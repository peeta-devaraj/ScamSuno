import manifest from "../generated/audio-manifest.json";
import { lines, type LineId, type Locale } from "./scenario";

export type AudioEntry = {
  lineId: LineId; locale: Locale; text: string; model: "timbre-v3.0" | "timbre-v2.5";
  voice: string; language: string; bytes: number; sha256: string; url: string; generatedAt: string;
};

export const callerAudio = (manifest as AudioEntry[]).filter((entry) =>
  Object.hasOwn(lines, entry.lineId) && lines[entry.lineId][entry.locale] === entry.text);

export function audioFor(lineId: LineId, locale: Locale) {
  return callerAudio.find((entry) => entry.lineId === lineId && entry.locale === locale)?.url ?? null;
}
