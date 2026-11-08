import type { Metadata } from "next";
import { V3Call } from "@/components/v3-call";
import { isLocale } from "@/domain/scenario";
import { v3Readiness } from '@/server/v3/readiness';

export const metadata: Metadata = { title: "ScamSuno · Trust or Trap",
  description: "A fictional call. An open question. Practise independent verification in Tamil, Telugu, English and Hindi." };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Local, visibly labelled browser fixtures never enable a deployed API.
  const fixture = params.fixture === "1" && process.env.NODE_ENV === "development" &&
    process.env.GNANI_MODE === "mock" && process.env.VERCEL_ENV === "development" && !process.env.VERCEL;
  const readiness = fixture ? {available:true,voiceAvailable:true} : await v3Readiness();
  const {available,voiceAvailable}=readiness;
  return <V3Call available={available} voiceAvailable={voiceAvailable} fixture={fixture}
    initialLocale={isLocale(params.l) ? params.l : "ta"} />;
}
