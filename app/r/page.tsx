import Link from "next/link";
import { Chrome } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { decodeShare, outcomeNames } from "@/domain/share";
import { mockMode } from "@/server/gnani/client";

export const dynamic = "force-dynamic";

export default async function SharedResult({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const result = decodeShare(t);
  const url = result ? `/api/card?t=${t}` : "/api/card";
  return <Chrome mock={mockMode()} compact><main className="play-wrap shell">
    <section className="surface card-view">
      <span className="eyebrow">ScamSuno · Shared result</span>
      <h1>{result ? outcomeNames[result.o] : "Can you survive a scam call?"}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="result-image" src={url} width={1200} height={630} alt="Educational simulation training feedback"/>
      <Link href={result?.l === "hi" ? "/?l=hi" : "/"} className="btn primary">Try the simulation<Icon name="arrow" size={18}/></Link>
    </section>
  </main></Chrome>;
}
