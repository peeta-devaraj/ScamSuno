"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/domain/copy";
import { isLocale, locales, type Locale } from "@/domain/scenario";
import { Chrome } from "./chrome";
import { Icon } from "./icons";

const languageNames: Record<Locale, string> = { en: "English", hi: "हिन्दी", ta: "தமிழ்", te: "తెలుగు" };
const landing = {
  en: {
    kicker: "Interactive call practice", title: "Can you survive", emphasis: "a scam call?",
    lead: "Answer a fictional bank call. Respond under pressure, then see which tricks the caller used to get your code.",
    language: "Call language", incoming: "Incoming call", note: "A fictional caller. Your move.",
    scenario: "The scenario", claim: "An unknown caller claims your bank account is about to be frozen.",
    privacy: "Privacy by design", provider: "Classifier", fictional: "Fictional call",
  },
  hi: {
    kicker: "इंटरैक्टिव कॉल अभ्यास", title: "क्या आप एक", emphasis: "स्कैम कॉल से बच सकते हैं?",
    lead: "एक काल्पनिक बैंक कॉल उठाएँ। दबाव में जवाब देने का अभ्यास करें और जानें कि किन संकेतों पर ध्यान देना है।",
    language: "भाषा", incoming: "आने वाली कॉल", note: "यह सिर्फ़ अभ्यास है",
    scenario: "कॉल का प्रकार", claim: "एक अनजान कॉलर कहता है कि आपका खाता बंद होने वाला है।",
    privacy: "आपकी निजता", provider: "लेबलिंग सेवा", fictional: "काल्पनिक कॉल",
  },
  ta: {
    kicker: "அழைப்புக்குப் பதிலளிக்கும் பயிற்சி", title: "மோசடி அழைப்பை", emphasis: "சமாளிக்க முடியுமா?",
    lead: "கற்பனை வங்கி அழைப்பை ஏற்றுப் பேசுங்கள். அழுத்தத்திலும் பதிலளித்துப் பாருங்கள். உங்கள் குறியீட்டைப் பெற அழைப்பவர் என்ன உத்திகளைப் பயன்படுத்தினார் என்று அறியுங்கள்.",
    language: "அழைப்பின் மொழி", incoming: "அழைப்பு வருகிறது", note: "கற்பனை அழைப்பு. இப்போது உங்கள் முறை.",
    scenario: "பயிற்சி நிலை", claim: "உங்கள் வங்கிக் கணக்கு முடக்கப்படப் போவதாகத் தெரியாத ஒருவர் கூறுகிறார்.",
    privacy: "உங்கள் தனியுரிமை", provider: "பதிலைப் புரிந்துகொள்ளும் சேவை", fictional: "கற்பனை அழைப்பு",
  },
  te: {
    kicker: "కాల్‌కు జవాబు ఇచ్చే అభ్యాసం", title: "మోసపూరిత కాల్‌ను", emphasis: "ఎదుర్కోగలరా?",
    lead: "కల్పిత బ్యాంకు కాల్ ఎత్తండి. ఒత్తిడిలో జవాబు ఇచ్చి చూడండి. మీ కోడ్ తెలుసుకోవడానికి కాల్ చేసిన వ్యక్తి ఏ ఎత్తులు వేశారో తెలుసుకోండి.",
    language: "కాల్ భాష", incoming: "కాల్ వస్తోంది", note: "ఇది కల్పిత కాల్. ఇప్పుడు మీ వంతు.",
    scenario: "అభ్యాస సందర్భం", claim: "మీ బ్యాంకు ఖాతా బ్లాక్ కాబోతోందని తెలియని వ్యక్తి చెబుతున్నారు.",
    privacy: "మీ గోప్యత", provider: "జవాబు అర్థం చేసుకునే సేవ", fictional: "కల్పిత కాల్",
  },
};

export function Home({ initial, mock, provider }: { initial: Locale | null; mock: boolean; provider: string | null }) {
  const [locale, setLocale] = useState<Locale>(initial ?? "en");
  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem("scamsuno-locale");
      if (isLocale(saved)) setLocale(saved);
    } catch { /* Private browser storage. */ }
  }, [initial]);
  const c = copy[locale];
  const words = landing[locale];
  function pick(value: Locale) {
    setLocale(value);
    try { localStorage.setItem("scamsuno-locale", value); } catch { /* Private browser storage. */ }
  }
  return <Chrome locale={locale} mock={mock}>
    <main className="shell home-main">
      <div className="hero">
        <section className="hero-copy">
          <div className="eyebrow"><span className="signal-dot"/>{words.kicker}</div>
          <h1>{words.title}<br/><em>{words.emphasis}</em></h1>
          <p className="hero-lead">{words.lead}</p>
          <div className="language"><Icon name="globe" size={17}/><div className="language-pills" role="group" aria-label={words.language}>
            {locales.map((option) => <button key={option} type="button" lang={option} aria-pressed={locale === option}
              onClick={() => pick(option)}>{languageNames[option]}</button>)}
          </div></div>
          <div className="hero-actions">
            <Link className="btn primary" href={`/play?s=kyc_freeze&l=${locale}`}><Icon name="phone" size={18}/>{c.start}<Icon name="arrow" size={18}/></Link>
            <Link className="quiet-link" href="/about">{c.about}<Icon name="arrow-up" size={15}/></Link>
          </div>
        </section>
        <div className="hero-art" aria-hidden="true">
          <div className="art-label"><span/> {words.incoming}</div>
          <div className="art-coordinate">01 / KYC</div>
          <div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="orbit orbit-c"/>
          <div className="mini-phone">
            <span className="mini-notch"/><span className="mini-badge">{c.ribbon}</span>
            <div className="mini-avatar"><Icon name="phone" size={25}/></div>
            <strong>{c.unknown}</strong><small>{c.bank}</small>
            <div className="mini-controls"><span><Icon name="end" size={22}/></span><span><Icon name="phone" size={21}/></span></div>
          </div>
          <div className="art-note"><Icon name="wave" size={20}/>{words.note}</div>
        </div>
      </div>
      <div className="home-info">
        <div className="info-scenario"><div className="info-icon"><Icon name="headphones"/></div><div><div className="eyebrow">{words.scenario}</div><h2>{c.scenario}</h2><p>{words.claim}</p></div></div>
        <div className="info-privacy"><div className="info-icon"><Icon name="lock"/></div><div><div className="eyebrow">{words.privacy}</div><p>{c.privacy}{provider && ` ${words.provider} — ${provider}.`}</p></div></div>
      </div>
    </main>
    <footer className="shell site-footer"><span>ScamSuno</span><span>{c.ribbon} · {words.fictional}</span></footer>
  </Chrome>;
}
