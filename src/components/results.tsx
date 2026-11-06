"use client";

import { useState, type RefObject } from "react";
import { copy, type Copy } from "@/domain/copy";
import { flagsFor, type Session, type score } from "@/domain/engine";
import { rules } from "@/domain/rules";
import { buttons, graph, lines, type Button, type Locale, type Terminal } from "@/domain/scenario";
import { Icon } from "./icons";

type Focus = RefObject<HTMLElement | null>;
const messages = {
  END_SAFE: "safeMessage", END_VERIFIED: "verifiedMessage",
  END_SCAMMED: "scammedMessage", END_INCOMPLETE: "incompleteMessage",
} as const;

export function Reveal({ locale, outcome, next, focus }: { locale: Locale; outcome: Terminal; next: () => void; focus: Focus }) {
  const c = copy[locale];
  return <section className="surface entry reveal" ref={focus} tabIndex={-1}>
    <div className={`entry-glyph ${outcome === "END_SCAMMED" ? "risk" : ""}`}><Icon name={outcome === "END_SCAMMED" ? "warning" : "shield"} size={37}/></div>
    <span className="eyebrow">{c.revealTag}</span><h1>{c[outcome]}</h1><p>{c[messages[outcome]]}</p>
    <button type="button" className="btn primary" onClick={next}>{c.debrief}<Icon name="arrow" size={18}/></button>
    <a className="quiet-link" href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">
      {c.report}<Icon name="arrow-up" size={15}/>
    </a>
  </section>;
}

const criterionTip = { protect_secrets: "protectTip", verify_independently: "verifyTip", exit_safely: "exitTip" } as const;

export function Debrief({ locale, session, result, next, reset, focus }: {
  locale: Locale; session: Session; result: ReturnType<typeof score>; next: () => void; reset: () => void; focus: Focus;
}) {
  const c = copy[locale];
  const terminal = session.terminal!;
  const traces = session.turns.map((turn, i) => ({ ...turn, index: i + 1 }));
  const flags = [...traces.map((turn) => ({ turn, lineIds: turn.callerLineIds, index: turn.index })),
    { turn: null, lineIds: session.lastCallerLineIds, index: traces.length + 1 }];
  function text(turn: typeof traces[number]) {
    if (turn.inputMode === "button" && turn.maskedTranscript === "go_along" && graph[turn.stateId].demand === "otp") return c.shareCode;
    return turn.inputMode === "button" && buttons.includes(turn.maskedTranscript as Button)
      ? c[turn.maskedTranscript as Button] : turn.maskedTranscript;
  }
  return <section className="debrief" ref={focus} tabIndex={-1}>
    <div className="debrief-hero surface">
      <div className="entry-glyph"><Icon name="shield" size={30}/></div>
      <span className="eyebrow">{c.training}</span><h1>{c[terminal]}</h1>
      <div className="score-row"><div><strong>{result.possible ? `${result.earned} / ${result.possible}` : "–"}</strong><span>{result.possible ? c.pointLabel : c.noneTested}</span></div>
        <div><strong>{result.tested} / {result.criteria.length}</strong><span>{c.behaviourLabel}</span></div></div>
      {result.tested < result.criteria.length && <p>{c.untested}</p>}
    </div>
    <div className="surface debrief-section">
      <h2>{c.flagTitle}</h2>
      <ol className="timeline">{flags.map(({ turn, lineIds, index }) => {
        const seen = flagsFor(lineIds);
        if (!seen.length) return null;
        return <li key={index}><div className="turn-index">{String(index).padStart(2, "0")}</div><div>
          <div className="flag-row">{seen.map((flag) => <span key={flag}>{c[flag as keyof Copy]}</span>)}</div>
          {lineIds.map((id) => <p key={id}>“{lines[id][locale]}”</p>)}
          {turn ? <div className="observed"><span>{c[turn.inputMode]} · {c[turn.effectiveIntent]}</span><small>{text(turn)}</small></div>
            : <div className="observed">{c.callEnded}</div>}
        </div></li>;
      })}</ol>
    </div>
    <div className="surface debrief-section"><h2>{c.behaviours}</h2>
      <div className="criteria">{result.criteria.map(({ id, grade, points, max }) =>
        <div key={id}><div><strong>{c[id]}</strong><p>{c[criterionTip[id]]}</p></div>
          <div className="criteria-status"><span className={`grade grade-${grade.toLowerCase()}`}>{c[grade]}</span>
            {grade !== "NOT_TESTED" && <small>{points} / {max}</small>}</div></div>)}</div>
    </div>
    <div className="surface debrief-section"><h2>{c.sources}</h2>
      {rules.map((rule) => <article className="source-card" key={rule.id}>
        <a href={rule.url} target="_blank" rel="noreferrer">{rule.source}<Icon name="arrow-up" size={15}/></a>
        <blockquote lang="en">“{rule.quote}”</blockquote>
        <p><strong>{c.sourceSummary}</strong> · {rule.summary[locale]}</p>
      </article>)}
    </div>
    <details className="surface debrief-section trace"><summary>{c.trace}</summary>
      {traces.map((turn) => <article key={turn.index}><strong>{turn.index}. {c[turn.inputMode]} · {c[turn.effectiveIntent]}</strong>
        <p>{text(turn)}</p>
        <div className="trace-tags">
          <span>{turn.classification.source}</span>
          {turn.classification.source === "llm" && <span>{c.confidence} {turn.classification.confidence.toFixed(2)}</span>}
          {turn.stt && <><span>{turn.stt.model}</span><span className="request-id" title={turn.stt.gnaniRequestId}>ID {turn.stt.gnaniRequestId}</span>
            {turn.stt.detectedLanguage && <span>{turn.stt.detectedLanguage}</span>}</>}
          {turn.classification.reasons.map((reason) => <span key={reason}>{reason.replaceAll("_", " ")}</span>)}
        </div>
      </article>)}
    </details>
    <div className="result-actions"><button type="button" className="btn primary" onClick={next}>{c.card}<Icon name="arrow" size={18}/></button>
      <button type="button" className="btn secondary" onClick={reset}>{c.again}</button></div>
  </section>;
}

export function ResultCard({ locale, token, reset, focus }: { locale: Locale; token: string; reset: () => void; focus: Focus }) {
  const c = copy[locale];
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const cardUrl = `/api/card?t=${token}`;
  const resultUrl = `/r?t=${token}`;
  const fullUrl = () => new URL(resultUrl, window.location.origin).href;
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
    } catch { setShowLink(true); }
  }
  async function shareUrl() {
    if (!navigator.share) { await copyUrl(); return; }
    try { await navigator.share({ title: "ScamSuno · Educational simulation", url: fullUrl() }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) await copyUrl(); }
  }
  return <section className="surface card-view" ref={focus} tabIndex={-1}>
    <div className="eyebrow">{c.training}</div><h1>{c.card}</h1><p>{c.cardPrivacy}</p>
    {/* The card is a dynamic PNG from this app, already sized by the renderer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="result-image" src={cardUrl} width={1200} height={630} alt="ScamSuno simulation result card"/>
    <div className="result-actions">
      <a href={cardUrl} download="ScamSuno-result.png" className="btn primary"><Icon name="download" size={18}/>{c.download}</a>
      <button className="btn secondary" type="button" onClick={shareUrl}><Icon name="share" size={18}/>{c.share}</button>
      <button className="btn secondary" type="button" onClick={copyUrl}><Icon name="link" size={18}/>{copied ? c.copied : c.copy}</button>
    </div>
    {showLink && <input className="share-url" aria-label={c.copy} readOnly value={fullUrl()} onFocus={(event) => event.target.select()}/>}
    <button type="button" className="quiet-link" onClick={reset}>{c.again}<Icon name="replay" size={16}/></button>
  </section>;
}
