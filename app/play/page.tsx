import { Call } from "@/components/call";
import { health } from "@/server/health";

export const dynamic = "force-dynamic";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const params = await searchParams;
  const status = health();
  return <Call locale={params.l === "hi" ? "hi" : "en"} mock={status.mode === "mock"}
    voiceEnabled={status.stt.enabled} classifierEnabled={status.classifier.mode === "llm"}/>;
}
