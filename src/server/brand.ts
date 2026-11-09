import type { Metadata } from "next";

export const brandTitle = "ScamSuno — Can you trust this call?";
export const brandDescription = "Multilingual AI-powered scam-awareness training through fictional voice calls.";
export const brandThemeColor = "#211a2a";

const canonicalOrigin = "https://scamsuno.vercel.app";
const alternativeOrigin = "https://scamsuno-v3.vercel.app";
const classicOrigin = "https://scamsuno-classic.vercel.app";

function httpsOrigin(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
        url.pathname === "/" && !url.search && !url.hash) return url.origin;
  } catch { /* An invalid setting must not appear in links or metadata. */ }
}

export function approvedPublicOrigin(env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.VERCEL_ENV !== "production") return;
  const origin = httpsOrigin(env.SCAMSUNO_PUBLIC_ORIGIN);
  if (origin === canonicalOrigin || origin === alternativeOrigin) return origin;
}

export function scriptedPracticeOrigin(env: Record<string, string | undefined> = process.env): string {
  const publicOrigin = approvedPublicOrigin(env);
  if (!publicOrigin) return classicOrigin;
  const fallback = httpsOrigin(env.SCAMSUNO_SCRIPTED_PRACTICE_ORIGIN);
  return fallback && fallback !== canonicalOrigin && fallback !== alternativeOrigin ? fallback : classicOrigin;
}

export function trustOrTrapMetadata(env: Record<string, string | undefined> = process.env): Metadata {
  const origin = approvedPublicOrigin(env);
  const image = origin ? origin + "/brand/scamsuno-social.png" : undefined;
  const alt = "ScamSuno waveform on plum. Can you trust this call? Trust or Trap educational simulation.";
  return {
    title: brandTitle,
    description: brandDescription,
    icons: { icon: { url: "/brand/scamsuno-icon.svg", type: "image/svg+xml" }, apple: "/brand/scamsuno-app.png" },
    robots: { index: Boolean(origin), follow: Boolean(origin) },
    ...(origin ? { alternates: { canonical: origin } } : {}),
    openGraph: {
      type: "website", siteName: "ScamSuno", title: brandTitle, description: brandDescription,
      ...(image ? { url: origin, images: [{ url: image, width: 1200, height: 630, alt }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary", title: brandTitle, description: brandDescription,
      ...(image ? { images: [{ url: image, alt }] } : {}),
    },
  };
}
