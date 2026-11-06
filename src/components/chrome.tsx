import Link from "next/link";
import { copy } from "@/domain/copy";
import type { Locale } from "@/domain/scenario";
import { Icon } from "./icons";

export function Chrome({ children, locale = "en", mock = false, compact = false }: {
  children: React.ReactNode; locale?: Locale; mock?: boolean; compact?: boolean;
}) {
  const c = copy[locale];
  return <div lang={locale} className={compact ? "site compact" : "site"}>
    <header className="site-header"><div className="shell nav-inner">
      <Link className="brand" href={locale === "hi" ? "/?l=hi" : "/"} aria-label="ScamSuno home">
        <span className="brand-icon"><Icon name="wave" size={24}/></span><span>Scam<span>Suno</span></span>
      </Link>
      <span className="ribbon"><Icon name="shield" size={15}/>{c.ribbon}</span>
      <Link href="/about" className="nav-about">{c.about}<Icon name="arrow-up" size={14}/></Link>
    </div></header>
    {mock && <div className="mock" role="status">MOCK MODE · {locale === "hi" ? "परीक्षण के लिए" : "Development fixtures"}</div>}
    {children}
  </div>;
}
