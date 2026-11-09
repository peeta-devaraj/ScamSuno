import type { Metadata } from "next";
import { scriptedPracticeOrigin } from "@/server/brand";
import { trustOrTrapEnabled } from "@/server/v3/config";
import { V2Call } from "@/components/v2-call";
import { isLocale } from "@/domain/scenario";
import { hostedConfiguration } from "@/server/v2/hosted-config";
import { voiceProofReady } from "@/server/v2/voice-proof";

export const metadata: Metadata = { title: "ScamSuno · A conversation worth practising",
  description: "A fictional scam-awareness conversation in Tamil, Telugu, English and Hindi." };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // This seam only presents UI to locally intercepted browser tests. It never opens an API.
  const fixture = params.fixture === "1" && process.env.NODE_ENV === "development" &&
    process.env.GNANI_MODE === "mock" && process.env.VERCEL_ENV === "development" && !process.env.VERCEL;
  const databaseUrl = process.env.V2_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const databaseToken = process.env.V2_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  const databaseReady = Boolean(databaseUrl &&
    (databaseUrl.startsWith("file:") ? !process.env.VERCEL : databaseToken));
  const available = fixture || Boolean(!trustOrTrapEnabled() && hostedConfiguration() && databaseReady);
  const voiceAvailable = fixture || Boolean(available && process.env.GNANI_API_KEY && process.env.STT_ENABLED === "true" && voiceProofReady());
  return <V2Call available={available} voiceAvailable={voiceAvailable} fixture={fixture}
    initialLocale={isLocale(params.l) ? params.l : "en"} scriptedOrigin={scriptedPracticeOrigin()} />;
}
