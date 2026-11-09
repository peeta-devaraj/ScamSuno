import { health } from "@/server/health";
import { Home } from "@/components/home";
import { isLocale } from "@/domain/scenario";
import { trustOrTrapEnabled } from '@/server/v3/config';
import { redirect } from 'next/navigation';

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const params = await searchParams;
  const initial = isLocale(params.l) ? params.l : null;
  if (trustOrTrapEnabled()) redirect(`/v3?l=${initial ?? "en"}`);
  const status = health();
  return <Home initial={initial} mock={status.mode === "mock"} provider={status.classifier.provider} trustOrTrap={trustOrTrapEnabled()}/>;
}
