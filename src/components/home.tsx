"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/domain/copy";
import type { Locale } from "@/domain/scenario";
import { Chrome } from "./chrome";
import { Icon } from "./icons";

export function Home({ initial, mock, provider }: { initial: Locale | null; mock: boolean; provider: string | null }) {
  const [locale, setLocale] = useState<Locale>(initial ?? "en");
  useEffect(() => {
    if (initial) return;
    try { if (localStorage.getItem("scamsuno-locale") === "hi") setLocale("hi"); } catch { /* Private browser storage. */ }
  }, [initial]);
  const c = copy[locale];
  const hindi = locale === "hi";
  function pick(value: Locale) {
    setLocale(value);
    try { localStorage.setItem("scamsuno-locale", value); } catch { /* Private browser storage. */ }
  }
  return <Chrome locale={locale} mock={mock}>
    <main className="shell home-main">
      <div className="hero">
        <section className="hero-copy">
          <div className="eyebrow"><span className="signal-dot"/>{hindi ? "इंटरैक्टिव कॉल अभ्यास" : "Interactive call practice"}</div>
          <h1>{hindi ? "क्या आप एक" : "Can you survive"}<br/><em>{hindi ? "स्कैम कॉल से बच सकते हैं?" : "a scam call?"}</em></h1>
          <p className="hero-lead">{hindi
            ? "एक काल्पनिक बैंक कॉल उठाएँ। दबाव में जवाब देने का अभ्यास करें और जानें कि किन संकेतों पर ध्यान देना है।"
            : "Answer a fictional bank call. Respond under pressure, then see which tricks the caller used to get your code."}</p>
          <div className="language"><Icon name="globe" size={17}/><div className="language-pills" role="group" aria-label={hindi ? "भाषा" : "Call language"}>
            <button type="button" lang="en" aria-pressed={!hindi} onClick={() => pick("en")}>English</button>
            <button type="button" lang="hi" aria-pressed={hindi} onClick={() => pick("hi")}>हिन्दी</button>
          </div></div>
          <div className="hero-actions">
            <Link className="btn primary" href={`/play?s=kyc_freeze&l=${locale}`}><Icon name="phone" size={18}/>{c.start}<Icon name="arrow" size={18}/></Link>
            <Link className="quiet-link" href="/about">{c.about}<Icon name="arrow-up" size={15}/></Link>
          </div>
        </section>
        <div className="hero-art" aria-hidden="true">
          <div className="art-label"><span/> {hindi ? "आने वाली कॉल" : "INCOMING CALL"}</div>
          <div className="art-coordinate">01 / KYC</div>
          <div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="orbit orbit-c"/>
          <div className="mini-phone">
            <span className="mini-notch"/><span className="mini-badge">{c.ribbon}</span>
            <div className="mini-avatar"><Icon name="phone" size={25}/></div>
            <strong>{c.unknown}</strong><small>{c.bank}</small>
            <div className="mini-controls"><span><Icon name="end" size={22}/></span><span><Icon name="phone" size={21}/></span></div>
          </div>
          <div className="art-note"><Icon name="wave" size={20}/>{hindi ? "यह सिर्फ़ अभ्यास है" : "A fictional caller. Your move."}</div>
        </div>
      </div>
      <div className="home-info">
        <div className="info-scenario"><div className="info-icon"><Icon name="headphones"/></div><div><div className="eyebrow">{hindi ? "कॉल का प्रकार" : "The scenario"}</div><h2>{c.scenario}</h2><p>{hindi ? "एक अनजान कॉलर कहता है कि आपका खाता बंद होने वाला है।" : "An unknown caller claims your bank account is about to be frozen."}</p></div></div>
        <div className="info-privacy"><div className="info-icon"><Icon name="lock"/></div><div><div className="eyebrow">{hindi ? "आपकी निजता" : "Privacy by design"}</div><p>{c.privacy}{provider && ` ${hindi ? "लेबलिंग सेवा" : "Classifier"} — ${provider}.`}</p></div></div>
      </div>
    </main>
    <footer className="shell site-footer"><span>ScamSuno</span><span>{c.ribbon} · {hindi ? "काल्पनिक कॉल" : "Fictional call"}</span></footer>
  </Chrome>;
}
