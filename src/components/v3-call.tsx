"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CallAudio } from "@/client/audio";
import { audible, encodeWav, RECORD_SECONDS } from "@/domain/wav";
import type { Reply } from "@/domain/v2/contracts";
import { PublicSessionSchema as SessionSchema, type PublicSession as ConversationSession } from "@/domain/v3/contracts";
import { uiCopy, v3Languages } from "@/domain/v3/ui-copy";
import type { Locale } from "@/domain/scenario";
import { Icon } from "./icons";
import styles from "../../app/v3/v3.module.css";

type Stage = "incoming" | "connecting" | "ready" | "thinking" | "audioLoading" | "speaking" |
  "arming" | "recording" | "transcribing" | "confirming" | "ending" | "results" | "ended";
type Recorder = Awaited<ReturnType<CallAudio["record"]>>;
type Result = { educationalSimulation: true; category: string; categoryLabel: string; explanation: string; recordedCaptions: string[];
  decisions: {id:string;status:string;label:string;statusLabel:string;explanation:string;evidenceTurns:number[]}[]; ending:string };
type Envelope = { ok:true; mode:"live"|"fixture"|"disabled"; session:ConversationSession; status:string; callerSource:string; debrief?:Result|null };
type Heard = { transcript: string; stt: { model: string; requestId: string }; proof: string; expiresAt: number };
type Job = { token: number; signal: AbortSignal };

function debrief(value: unknown): Result | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Result;
  const text = (s: unknown, max = 2400) => typeof s === "string" && s.length > 0 && s.length <= max;
  if (v.educationalSimulation !== true || !text(v.category, 50) || !text(v.categoryLabel, 200) || !text(v.explanation) ||
      !Array.isArray(v.recordedCaptions) || v.recordedCaptions.length > 12 || !v.recordedCaptions.every(s => text(s, 500)) ||
      !Array.isArray(v.decisions) || v.decisions.length > 8 || !v.decisions.every(d => d && text(d.id, 80) && text(d.label, 200) &&
        text(d.status, 40) && text(d.statusLabel, 200) && text(d.explanation) && Array.isArray(d.evidenceTurns) &&
        d.evidenceTurns.length <= 10 && d.evidenceTurns.every(t => Number.isInteger(t) && t > 0 && t <= 10))) return null;
  return v;
}

async function jsonRequest<T>(path: string, body: object | FormData, signal: AbortSignal): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(path, { method: "POST", credentials: "same-origin",
    signal: AbortSignal.any([signal, AbortSignal.timeout(27_000)]),
    ...(multipart ? {} : { headers: { "Content-Type": "application/json" } }),
    body: multipart ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error("V3_REQUEST_FAILED");
  return data as T;
}

export function V3Call({ available, voiceAvailable, initialLocale = "en", fixture = false }: {
  available: boolean; voiceAvailable: boolean; initialLocale?: Locale; fixture?: boolean;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [stage, setStage] = useState<Stage>("incoming");
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [fixtureMode, setFixtureMode] = useState(fixture);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [checking, setChecking] = useState(false);
  const current = useRef<ConversationSession | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const job = useRef<AbortController | null>(null);
  const capture = useRef<CallAudio | null>(null);
  const recording = useRef<Recorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playback = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const audioCache = useRef<{ key: string; blob: Blob } | null>(null);
  const finishing = useRef(false);
  const c = uiCopy[locale];
  const v1Href = `https://scamsuno.vercel.app/?l=${locale}`;
  const busy = checking || ["connecting", "thinking", "arming", "transcribing", "ending"].includes(stage);
  const active = !["incoming", "results", "ended"].includes(stage);
  const alive = (task: Job) => mounted.current && generation.current === task.token && !task.signal.aborted;

  function stopPlayback() {
    const element = playback.current;
    playback.current = null;
    if (element) {
      element.onplaying = element.onended = element.onerror = element.onpause = element.onwaiting = null;
      element.pause(); element.removeAttribute("src"); element.load();
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }
  function stopMicrophone() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    recording.current?.close(); recording.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    void meter.current?.close().catch(() => undefined); meter.current = null;
    if (mounted.current) setLevel(0);
  }
  function begin(): Job {
    generation.current++;
    setChecking(false);
    job.current?.abort(); stopPlayback(); stopMicrophone();
    job.current = new AbortController();
    return { token: generation.current, signal: job.current.signal };
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; generation.current++; job.current?.abort();
      stopMicrophone(); stopPlayback(); capture.current?.close(); capture.current = null; audioCache.current = null;
    };
  }, []);
  useEffect(() => {
    if (!session || !active) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - session.createdAt) / 1000)));
    update(); const interval = setInterval(update, 1000); return () => clearInterval(interval);
  }, [session?.createdAt, active]);

  async function playCaption(s: ConversationSession, task: Job) {
    if (!voiceAvailable || s.ending || !alive(task)) { if (alive(task)) setStage("ready"); return; }
    const cacheKey = `${s.sessionId}:${s.turn}:${s.lastCaller}`;
    setStage("audioLoading");
    try {
      let blob = audioCache.current?.key === cacheKey ? audioCache.current.blob : null;
      if (!blob) {
        const response = await fetch("/api/v3/tts", { method: "POST", credentials: "same-origin",
          signal: AbortSignal.any([task.signal, AbortSignal.timeout(25_000)]), headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: s.sessionId, expectedTurn: s.turn, operationId: crypto.randomUUID() }) });
        if (!response.ok || !response.headers.get("content-type")?.includes("audio/")) throw new Error("V3_AUDIO_UNAVAILABLE");
        blob = await response.blob();
        if (!blob.size || blob.size > 8_000_000) throw new Error("V3_AUDIO_UNAVAILABLE");
        if (!alive(task)) return;
        audioCache.current = { key: cacheKey, blob };
      }
      if (!alive(task)) return;
      stopPlayback();
      const element = new Audio();
      const url = URL.createObjectURL(blob); objectUrl.current = url; playback.current = element;
      const valid = () => alive(task) && playback.current === element;
      element.onplaying = () => { if (valid()) setStage("speaking"); };
      element.onwaiting = () => { if (valid()) setStage("audioLoading"); };
      element.onended = () => { if (valid()) { stopPlayback(); setStage("ready"); } };
      element.onpause = () => { if (valid()) setStage("ready"); };
      element.onerror = () => { if (valid()) { stopPlayback(); setStage("ready"); setError(c.audioError); } };
      element.src = url;
      await element.play();
    } catch {
      if (alive(task)) { stopPlayback(); setStage("ready"); setError(c.audioError); }
    }
  }

  async function apply(data: Envelope, task: Job, ending = false) {
    if (!alive(task)) return;
    const parsed = SessionSchema.safeParse(data.session);
    if (!parsed.success || parsed.data.locale !== locale) throw new Error("V3_INVALID_RESPONSE");
    const previous = current.current;
    current.current = parsed.data; setSession(parsed.data);
    if (data.mode === "fixture") setFixtureMode(true);
    if (data.status === "evaluation_unavailable") {
      setError(c.stalled);
      setStage(heard ? "confirming" : "ready");
      return;
    }
    if (parsed.data.ending) {
      setDraft(""); setHeard(null);
      stopMicrophone(); stopPlayback(); audioCache.current = null;
      const result = debrief(data.debrief);
      setResult(result); setStage(result ? "results" : "ended"); return;
    }
    if (ending) { setStage("ended"); return; }
    if (previous?.turn === parsed.data.turn && previous?.sessionId === parsed.data.sessionId) { setStage("ready"); return; }
    setDraft(""); setHeard(null);
    await playCaption(parsed.data, task);
  }

  async function answer() {
    if (stage !== "incoming" || !available) return;
    const task = begin(); setError(""); setStage("connecting"); setResult(null);
    capture.current ??= new CallAudio(); void capture.current.unlock();
    try { await apply(await jsonRequest<Envelope>("/api/v3/conversation", { action: "start", locale }, task.signal), task); }
    catch { if (alive(task)) { setStage("incoming"); setError(c.connectionError); } }
  }

  async function send(reply: Reply, confirmation?: { proof: string; expiresAt: number }) {
    const s = current.current;
    if (!s || s.ending || busy || stage === "recording") return;
    const task = begin(); setStage("thinking"); setError("");
    try {
      await apply(await jsonRequest<Envelope>("/api/v3/conversation", { action: "reply", operation: {
        sessionId: s.sessionId, expectedTurn: s.turn, operationId: crypto.randomUUID(), reply,
      }, ...(confirmation ? { confirmation } : {}) }, task.signal), task);
    } catch { if (alive(task)) { setStage(heard ? "confirming" : "ready"); setError(c.connectionError); } }
  }
  function sendDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (heard && draft === heard.transcript && heard.expiresAt <= Date.now()) {
      setHeard(null);
      setStage("ready");
      setError(c.voiceExpired);
      return;
    }
    if (heard && draft === heard.transcript) {
      void send({ origin: "voice", text: heard.transcript, transcription: {
        provider: "gnani", model: heard.stt.model, requestId: heard.stt.requestId, confirmed: true,
      } }, { proof: heard.proof, expiresAt: heard.expiresAt });
    } else void send({ origin: "typed", text: draft.trim() });
  }

  async function finishRecording(task: Job) {
    const rec = recording.current, s = current.current;
    if (!rec || !s || finishing.current || !alive(task)) return;
    finishing.current = true;
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    setStage("transcribing");
    try {
      const samples = await rec.finish(); stopMicrophone();
      if (!alive(task)) return;
      if (!audible(samples)) { setStage("ready"); setError(c.silence); return; }
      const wav = encodeWav(samples.slice(0, Math.floor(rec.rate * RECORD_SECONDS)), rec.rate);
      const form = new FormData();
      form.set("sessionId", s.sessionId); form.set("expectedTurn", String(s.turn)); form.set("operationId", crypto.randomUUID());
      form.set("audio", new Blob([Uint8Array.from(wav)], { type: "audio/wav" }), "practice-reply.wav");
      const data = await jsonRequest<Heard>("/api/v3/stt", form, task.signal);
      if (!alive(task)) return;
      if (typeof data.transcript !== "string" || !data.transcript.trim() || data.transcript.length > 500 ||
          !data.stt?.model || !data.stt.requestId || typeof data.proof !== "string" || !Number.isSafeInteger(data.expiresAt)) throw new Error("V3_INVALID_TRANSCRIPT");
      setHeard(data); setDraft(data.transcript); setStage("confirming");
    } catch { if (alive(task)) { stopMicrophone(); setStage("ready"); setError(c.connectionError); } }
    finally { finishing.current = false; }
  }

  async function record() {
    if (!voiceAvailable || busy || stage === "recording" || !current.current || current.current.ending) return;
    const task = begin(); setHeard(null); setDraft(""); setError(""); setStage("arming"); setRecordSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("V3_MIC_UNAVAILABLE");
      capture.current ??= new CallAudio(); await capture.current.unlock();
      const input = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1,
        echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!alive(task)) { input.getTracks().forEach((track) => track.stop()); return; }
      stream.current = input;
      const rec = await capture.current.record(input, task.signal);
      if (!alive(task)) { rec.close(); stopMicrophone(); return; }
      recording.current = rec;
      const analyserContext = new AudioContext(); meter.current = analyserContext;
      await analyserContext.resume();
      if (!alive(task)) { stopMicrophone(); return; }
      const analyser = analyserContext.createAnalyser(); analyser.fftSize = 256;
      const quiet = analyserContext.createGain(); quiet.gain.value = 0;
      analyserContext.createMediaStreamSource(input).connect(analyser).connect(quiet).connect(analyserContext.destination);
      const values = new Float32Array(analyser.fftSize); const started = Date.now(); let previous = 0;
      const measure = () => {
        if (!alive(task) || !recording.current) return;
        if (Date.now() - previous > 75) {
          analyser.getFloatTimeDomainData(values);
          const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
          setLevel(Math.min(1, rms * 12)); setRecordSeconds(Math.min(RECORD_SECONDS, Math.floor((Date.now() - started) / 1000))); previous = Date.now();
        }
        frame.current = requestAnimationFrame(measure);
      };
      setStage("recording"); measure(); timer.current = setTimeout(() => void finishRecording(task), RECORD_SECONDS * 1000);
    } catch { if (alive(task)) { stopMicrophone(); setStage("ready"); setError(c.micError); } }
  }

  async function end() {
    const s = current.current;
    const task = begin(); setStage("ending"); setError(""); setHeard(null); setDraft(""); audioCache.current = null;
    capture.current?.close(); capture.current = null;
    if (!s) { setStage("ended"); return; }
    try { await apply(await jsonRequest<Envelope>("/api/v3/conversation", { action: "end", sessionId: s.sessionId }, task.signal), task, true); }
    catch { if (alive(task)) { setStage("ended"); setError(c.endError); } }
  }
  async function verify() {
    const s = current.current;
    if (!s || s.verification.checked || busy || stage === "recording" || stage === "confirming") return;
    const task = begin(); setChecking(true); setError("");
    try {
      await apply(await jsonRequest<Envelope>("/api/v3/conversation", { action: "verify", operation: {
        sessionId: s.sessionId, expectedTurn: s.turn, operationId: crypto.randomUUID(),
      } }, task.signal), task);
    } catch { if (alive(task)) { setStage(s.ending && result ? "results" : s.ending ? "ended" : "ready"); setError(c.panelError); } }
    finally { if (alive(task)) setChecking(false); }
  }
  function restart() {
    begin(); current.current = null; setSession(null); setResult(null); setHeard(null); setDraft(""); setError(""); setElapsed(0); setStage("incoming");
  }
  const status = stage === "recording" ? `${c.recording} · ${recordSeconds} / ${RECORD_SECONDS}` :
    stage === "connecting" ? c.starting : c[stage as "thinking" | "audioLoading" | "speaking" | "arming" | "transcribing" | "confirming" | "ending"] ?? c.ready;
  const languages = <div><span className={styles.languageLabel}>{c.language}</span><div className={styles.languages} role="group" aria-label={c.language}>
    {v3Languages.map((option) => <button type="button" key={option.locale} lang={option.locale}
      aria-pressed={locale === option.locale} onClick={() => setLocale(option.locale)}>{option.name}</button>)}
  </div></div>;
  const verificationPanel = session && <aside className={styles.verification} data-testid="v3-verification">
    <div className={styles.panelHeading}><Icon name="shield" size={18}/><h2>{c.panelTitle}</h2></div>
    <p>{c.panelIntro}</p>
    {session.verification.checked ? <><strong className={styles.checked}>{c.panelDone}</strong><p data-testid="v3-verification-finding">{session.verification.message}</p></> :
      <><button type="button" className={styles.secondary} disabled={busy || stage === "recording" || stage === "confirming"}
        onClick={() => void verify()}>{checking ? c.panelChecking : c.panelAction}<Icon name="arrow" size={15}/></button><small>{c.checkAfter}</small></>}
    <p className={styles.panelBoundary}>{c.panelBoundary}</p>
  </aside>;
  return <div className={styles.page} lang={locale}>
    <header className={styles.header}><Link className={styles.brand} data-testid="v3-brand" href={`/v3?l=${locale}`}><Icon name="wave" size={22}/><span>Scam<em>Suno</em></span></Link>
      <span className={styles.badge}><Icon name="shield" size={13}/>{c.simulation}</span></header>
    {fixtureMode && <p className={styles.fixture} role="status" data-testid="v3-fixture">{c.fixture}</p>}
    <main className={styles.shell}>
      <nav className={styles.modeNav} aria-label={c.mode}><span aria-current="page">V3 · {c.trust}</span><Link href={`/v2?l=${locale}`}>{c.classic}</Link></nav>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {!available ? <section className={styles.closed}><div className={styles.avatar}><Icon name="headphones" size={34}/></div>
        <span className={styles.eyebrow}>{c.preview}</span><h1>{c.unavailableTitle}</h1><p>{c.unavailableBody}</p>{languages}
        <Link href={v1Href} className={styles.primary}>{c.v1}<Icon name="arrow" size={17}/></Link></section> :
      stage === "incoming" ? <><div className={styles.hero}><section className={styles.intro}>
        <div className={styles.eyebrow}>{c.incoming}</div><h1>{c.title}<span>{c.accent}</span></h1><p className={styles.lead}>{c.intro}</p>
        {languages}</section>
        <section className={styles.incoming} aria-label={c.fictional}><div className={styles.incomingTag}><Icon name="phone" size={14}/>{c.fictional}</div>
          <div><div className={styles.avatar}><Icon name="phone" size={34}/></div><h2>{c.caller}</h2><p>{c.organisation}</p></div>
          <button className={styles.primary} type="button" onClick={() => void answer()}><Icon name="phone" size={18}/>{c.answer}<Icon name="arrow" size={17}/></button></section></div>
        <div className={styles.steps}>{[c.stepOne, c.stepTwo, c.stepThree].map((text, index) => <div key={text}><b>0{index + 1}</b>{text}</div>)}</div>
        <p className={styles.privacy}><Icon name="lock" size={16}/>{c.privacy}</p>
        <Link href={v1Href} className={styles.quiet}>{c.v1}<Icon name="arrow-up" size={14}/></Link></> :
      stage === "results" && result ? <section className={styles.results}>
        <div className={styles.resultsHero}><span className={styles.eyebrow}>{c.simulation}</span><h1>{c.resultsTitle}</h1><p>{c.resultsLead}</p>
          <div className={styles.reveal} data-testid="v3-reveal"><strong>{result.categoryLabel}</strong><p>{result.explanation}</p></div></div>
        <div className={styles.criteria}>{result.decisions.map(decision=><div className={styles.criterion} key={decision.id} data-testid="v3-decision">
          <div className={styles.criterionBody}><strong>{decision.label}</strong><p>{decision.explanation}</p>{decision.evidenceTurns.length>0&&<small>{c.evidence}: {decision.evidenceTurns.join(", ")}</small>}</div>
          <span data-status={decision.status}>{decision.statusLabel}</span></div>)}</div>
        {verificationPanel}
        <details className={styles.evidence}><summary>{c.evidenceTitle}</summary><p>{c.evidenceCaution}</p>{result.recordedCaptions.map((text,index)=><p key={index}>{text}</p>)}</details>
        <p className={styles.privacy}>{c.educational}</p><div className={styles.takeaway}><h2>{c.reference}</h2><p>{c.referenceBody}</p><a href="https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244" target="_blank" rel="noreferrer">RBI<Icon name="arrow-up" size={12}/></a></div>
        <div className={styles.resultActions}><button type="button" className={styles.primary} onClick={restart}><Icon name="replay" size={17}/>{c.startAgain}</button><Link href={v1Href} className={styles.quiet}>{c.v1}</Link></div></section> :
      stage === "ended" ? <section className={styles.closed}><div className={styles.avatar}><Icon name="end" size={32}/></div><h1>{c.localEnded}</h1><p>{c.localEndedBody}</p>
        {current.current && !current.current.ending && <button className={styles.secondary} onClick={() => void end()}>{c.saveEnd}</button>}
        <button type="button" className={styles.primary} onClick={restart}>{c.startAgain}</button></section> :
      <div className={styles.callGrid}><section className={styles.call} aria-label={c.fictional}>
        <div className={styles.callTop}><div className={styles.identity}><span className={styles.miniAvatar}><Icon name="phone" size={21}/></span>
          <div><strong>{c.caller}</strong><small>{c.organisation}</small></div></div><span className={styles.timer}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span></div>
        <div className={styles.caption}><div className={styles.captionMeta}><span>{c.captions}</span>
          {voiceAvailable && session && <button type="button" aria-label={stage === "speaking" ? c.pause : c.replay} disabled={busy || stage === "recording" || stage === "confirming"}
            onClick={() => { if (stage === "speaking") { stopPlayback(); setStage("ready"); } else { const task = begin(); void playCaption(current.current!, task); } }}>
            <Icon name={stage === "speaking" ? "close" : "headphones"} size={19}/></button>}</div>
          <p data-testid="v3-caption">{session?.lastCaller ?? c.starting}</p></div>
        <div className={styles.status} role="status" data-testid="v3-state"><span className={styles.statusDot}/>{status}</div>
        {stage === "recording" && <div className={styles.wave} aria-hidden="true">{Array.from({ length: 19 }, (_, index) =>
          <span key={index} style={{ height: `${3 + level * (45 - Math.abs(index - 9) * 3)}px` }}/> )}</div>}
        {voiceAvailable && <div className={styles.recordArea}><button type="button" className={styles.primary} disabled={busy || stage === "confirming" || !session}
          onClick={() => stage === "recording" ? void finishRecording({ token: generation.current, signal: job.current!.signal }) : void record()}>
          <Icon name="mic" size={20}/>{stage === "recording" ? c.stop : c.record}</button><p>{c.limit}</p></div>}
        {verificationPanel}
        <div className={styles.endBar}><button type="button" className={styles.end} disabled={stage === "ending"} onClick={() => void end()}><Icon name="end" size={21}/>{c.end}</button></div>
      </section>
      {stage === "confirming" && heard ? <form className={styles.confirm} onSubmit={sendDraft}>
        <label htmlFor="v3-confirmation">{c.confirmTitle}</label><p>{c.confirmHint}</p><textarea id="v3-confirmation" value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)}/>
        {draft !== heard.transcript && <p>{c.edited}</p>}<div className={styles.confirmActions}><button type="submit" className={styles.primary} disabled={!draft.trim()}>{c.confirmSend}</button>
          <button type="button" className={styles.secondary} onClick={() => { setHeard(null); setDraft(""); setStage("ready"); }}>{c.discard}</button></div></form> :
      <form className={styles.composer} onSubmit={sendDraft}><label htmlFor="v3-reply">{c.compose}</label><textarea id="v3-reply" value={draft} maxLength={500}
        placeholder={c.placeholder} disabled={busy || stage === "recording" || !session} onChange={(event) => setDraft(event.target.value)}/>
        <button type="submit" className={styles.primary} disabled={busy || stage === "recording" || !session || !draft.trim()}>{c.send}<Icon name="arrow" size={17}/></button>
        <p>{c.captionOnly}</p></form>}
      </div>}
    </main><footer className={styles.footer}><span>ScamSuno · {c.preview}</span><span>{c.simulation}</span></footer>
  </div>;
}
