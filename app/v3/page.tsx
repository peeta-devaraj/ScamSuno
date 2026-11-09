import type { Viewport } from "next";
import { V3Call } from "@/components/v3-call";
import { isLocale } from "@/domain/scenario";
import { approvedPublicOrigin, brandThemeColor, scriptedPracticeOrigin, trustOrTrapMetadata } from "@/server/brand";
import { v3Readiness } from "@/server/v3/readiness";
import "../../public/brand/tokens.css";

export const metadata = trustOrTrapMetadata();
export const viewport: Viewport = { themeColor: brandThemeColor, colorScheme: "dark" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Local fixtures never enable a deployed API.
  const fixture = params.fixture === "1" && process.env.NODE_ENV === "development" &&
    process.env.GNANI_MODE === "mock" && process.env.VERCEL_ENV === "development" && !process.env.VERCEL;
  const readiness = fixture ? { available: true, voiceAvailable: true } : await v3Readiness();
  return <V3Call available={readiness.available} voiceAvailable={readiness.voiceAvailable} fixture={fixture}
    initialLocale={isLocale(params.l) ? params.l : "en"} privatePreview={!approvedPublicOrigin()}
    scriptedOrigin={scriptedPracticeOrigin()}/>;
}
