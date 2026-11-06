"use client";

import { useEffect, useRef, useState } from "react";
import { CallAudio } from "@/client/audio";
import { copy } from "@/domain/copy";
import type { Session, SttMetadata, score } from "@/domain/engine";
import { buttons, graph, SCENARIO, type Button, type LineId, type Locale } from "@/domain/scenario";
import { audible, encodeWav, RECORD_SECONDS } from "@/domain/wav";
import { Chrome } from "./chrome";
import { Icon } from "./icons";
import { Debrief, ResultCard, Reveal } from "./results";

type Stage = "permission" | "ringing" | "connecting" | "caller" | "ready" | "arming" | "recording" |
  "transcribing" | "confirm" | "typing" | "classifying" | "ending" | "reveal" | "debrief" | "card";
type PlayLine = { lineId: LineId; caption: string; audioUrl: string | null };
type Result = ReturnType<typeof score> & { shareToken: string };
type TurnResponse = { session: Session; play: PlayLine[]; result: Result | null; stalled: boolean;
  ui: { showQuickReplies: boolean; showTypingHelper: boolean } };
type Heard = { transcript: string; empty: boolean; stt: SttMetadata; proof: string };
type Recorder = Awaited<ReturnType<CallAudio["record"]>>;

class CallError extends Error {
  constructor(message: string, readonly retryable = false) { super(message); }
}

async function api<T>(path: string, body: object | FormData, signal: AbortSignal): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path, { method: "POST", signal,
    body: isForm ? body : JSON.stringify(body), headers: isForm ? undefined : { "Content-Type": "application/json" } });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new CallError(data.error?.message || "The request failed.", Boolean(data.error?.retryable));
  return data as T;
}

export function Call({ locale, mock, voiceEnabled, classifierEnabled }: {
  locale: Locale; mock: boolean; voiceEnabled: boolean; classifierEnabled: boolean;
}) {
  const c = copy[locale];
  const [interactive, setInteractive] = useState(false);
  const [stage, setStage] = useState<Stage>("permission");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [voice, setVoice] = useState(false);
  const [error, setError] = useState("");
  const [quick, setQuick] = useState(!classifierEnabled);
  const [captions, setCaptions] = useState<PlayLine[]>([]);
  const [activeCaption, setActiveCaption] = useState<LineId | null>(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [retry, setRetry] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [second, setSecond] = useState(0);
  const [started, setStarted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const session = useRef<Session | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<CallAudio | null>(null);
  const recording = useRef<Recorder | null>(null);
  const clip = useRef<Blob | null>(null);
  const job = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusFocus = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const recordingStart = useRef(0);
  const requesting = useRef(false);

  function releaseMic() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  function begin() {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    return controller.signal;
  }

  function dispose() {
    job.current?.abort();
    if (timeout.current) clearTimeout(timeout.current);
    recording.current?.close();
    recording.current = null;
    audio.current?.close();
    audio.current = null;
    clip.current = null;
    releaseMic();
  }

  useEffect(() => { setInteractive(true); return dispose; }, []);
  useEffect(() => {
    if (!started || result) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [started, result]);
  useEffect(() => {
    if (stage !== "recording") return;
    const id = setInterval(() => setSecond(Math.floor((Date.now() - recordingStart.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [stage]);
  useEffect(() => {
    if (["ringing", "ready", "reveal", "debrief", "card"].includes(stage)) statusFocus.current?.focus();
  }, [stage]);

  function player() {
    audio.current ??= new CallAudio();
    return audio.current;
  }

  async function requestMic() {
    if (requesting.current) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode ||
        /FBAN|FBAV|Instagram|LinkedInApp|Twitter/i.test(navigator.userAgent) ||
        (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !/Safari|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent))) {
      setError(c.unsupported);
      return;
    }
    const signal = begin();
    requesting.current = true;
    setPermissionBusy(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      } });
      if (signal.aborted) { input.getTracks().forEach((track) => track.stop()); return; }
      stream.current = input;
      setVoice(true);
      setStage("ringing");
    } catch {
      if (!signal.aborted) setError(c.blocked);
    } finally { requesting.current = false; setPermissionBusy(false); }
  }

  function noMic() {
    begin();
    releaseMic();
    setError("");
    setVoice(false);
    setStage("ringing");
  }

  async function playLines(items: PlayLine[], signal: AbortSignal) {
    setCaptions(items);
    setAudioMissing(items.some((item) => !item.audioUrl));
    if (!items.some((item) => item.audioUrl)) return;
    setStage("caller");
    for (const item of items) {
      if (signal.aborted) return;
      setActiveCaption(item.lineId);
      if (item.audioUrl && !await player().play(item.audioUrl, signal) && !signal.aborted) setAudioMissing(true);
    }
    if (!signal.aborted) setActiveCaption(null);
  }

  async function applyTurn(data: TurnResponse, signal: AbortSignal) {
    if (signal.aborted) return;
    session.current = data.session;
    setQuick(data.ui.showQuickReplies || data.ui.showTypingHelper);
    setDraft("");
    setHeard(null);
    setRetry(false);
    clip.current = null;
    if (data.stalled) {
      setError(c.noClassifier);
      setStage("ready");
      return;
    }
    if (data.result) releaseMic();
    await playLines(data.play, signal);
    if (signal.aborted) return;
    if (data.result) {
      audio.current?.close();
      audio.current = null;
      setResult(data.result);
      setStage("reveal");
    } else setStage("ready");
  }

  function issueMessage(problem: unknown) {
    return problem instanceof CallError && locale === "en" ? problem.message : c.connection;
  }

  async function answer() {
    if (busy.current) return;
    busy.current = true;
    const signal = begin();
    void player().unlock();
    setStage("connecting");
    setError("");
    try {
      const data = await api<TurnResponse>("/api/turn", { action: "start", scenarioId: SCENARIO,
        locale, sessionId: crypto.randomUUID() }, signal);
      if (signal.aborted) return;
      setStarted(Date.now());
      setElapsed(0);
      busy.current = false;
      await applyTurn(data, signal);
    } catch (problem) {
      if (!signal.aborted) {
        setError(issueMessage(problem));
        setStage("ringing");
      }
    } finally { if (!signal.aborted) busy.current = false; }
  }

  async function upload(wav: Blob, signal: AbortSignal) {
    setStage("transcribing");
    setRetry(false);
    setError("");
    const form = new FormData();
    form.set("audio", wav, "reply.wav");
    form.set("locale", locale);
    form.set("scenarioId", SCENARIO);
    form.set("stateId", session.current?.stateId ?? "INTRO");
    try {
      const output = await api<Heard>("/api/stt", form, signal);
      if (signal.aborted) return;
      if (output.empty) {
        setError(c.empty);
        setStage("ready");
        return;
      }
      setHeard(output);
      setStage("confirm");
    } catch (problem) {
      if (signal.aborted) return;
      setError(issueMessage(problem));
      setRetry(!(problem instanceof CallError) || problem.retryable);
      setStage("ready");
    }
  }

  async function finishRecording(signal: AbortSignal) {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    setStage("transcribing");
    try {
      const samples = await current.finish();
      if (signal.aborted) return;
      if (samples.length / current.rate < 0.5 || !audible(samples)) {
        setError(samples.length / current.rate < 0.5 ? c.short : c.silent);
        setStage("ready");
        return;
      }
      const wav = new Blob([encodeWav(samples, current.rate)], { type: "audio/wav" });
      clip.current = wav;
      await upload(wav, signal);
    } catch {
      if (!signal.aborted) { setError(c.micError); setStage("ready"); }
    }
  }

  async function mic() {
    if (stage === "recording" && job.current) { await finishRecording(job.current.signal); return; }
    if (!stream.current || busy.current) return;
    const signal = begin();
    const input = stream.current;
    setHeard(null);
    setRetry(false);
    setError("");
    clip.current = null;
    setStage("arming");
    try {
      recording.current = await player().record(input, signal);
      if (signal.aborted) { recording.current.close(); recording.current = null; return; }
      recordingStart.current = Date.now();
      setSecond(0);
      setStage("recording");
      timeout.current = setTimeout(() => void finishRecording(signal), RECORD_SECONDS * 1000);
    } catch {
      if (!signal.aborted) { setError(c.micError); setStage("ready"); }
    }
  }

  async function submit(input: object, back: Stage) {
    const current = session.current;
    if (!current || current.terminal || busy.current) return;
    busy.current = true;
    const signal = begin();
    setError("");
    setStage("classifying");
    try {
      const data = await api<TurnResponse>("/api/turn", { action: "reply", session: current, reply: input }, signal);
      if (signal.aborted) return;
      busy.current = false;
      await applyTurn(data, signal);
    } catch (problem) {
      if (!signal.aborted) { setError(issueMessage(problem)); setStage(back); }
    } finally { if (!signal.aborted) busy.current = false; }
  }

  async function hangup() {
    const current = session.current;
    const signal = begin();
    audio.current?.stop();
    recording.current?.close();
    recording.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    setActiveCaption(null);
    setError("");
    if (!current) { busy.current = false; setStage("ringing"); return; }
    releaseMic();
    setVoice(false);
    if (current.terminal && result) { setStage("reveal"); return; }
    setStage("ending");
    try {
      const data = await api<TurnResponse>("/api/turn", { action: "hangup", session: current }, signal);
      if (!signal.aborted) await applyTurn(data, signal);
    } catch (problem) {
      if (!signal.aborted) {
        setError(issueMessage(problem));
        if (current.terminal) setStage("reveal");
        else setStage("ready");
      }
    } finally { if (!signal.aborted) busy.current = false; }
  }

  function reset() {
    dispose();
    session.current = null;
    busy.current = false;
    setStarted(0); setElapsed(0); setVoice(false); setResult(null); setHeard(null); setDraft("");
    setDeclined(false); setError(""); setRetry(false); setQuick(!classifierEnabled); setStage("permission");
  }

  async function replay() {
    const signal = begin();
    await player().unlock();
    if (!signal.aborted) await playLines(captions, signal);
    if (!signal.aborted) setStage("ready");
  }

  const statuses: Partial<Record<Stage, string>> = { connecting: c.connecting, caller: c.calling, ready: c.yourTurn,
    arming: c.listening, recording: c.listening, transcribing: c.transcribing, confirm: c.confirming,
    typing: c.yourTurn, classifying: c.thinking, ending: c.callEnded };
  const currentSession = session.current;
  const canReply = stage === "ready" || stage === "typing" || stage === "confirm";
  const outcome = currentSession?.terminal;
  return <Chrome locale={locale} mock={mock} compact>
    <main className="play-wrap shell">
      {stage === "permission" && <section className="surface entry">
        <div className="entry-glyph"><Icon name="headphones" size={35}/></div>
        <div className="eyebrow"><span className="signal-dot"/>{c.scenario}</div>
        <h1>{c.permissionTitle}</h1><p>{c.permissionText}</p>
        {!voiceEnabled && <p className="notice">{c.voiceOff}</p>}
        {error && <p className="notice" role="alert">{error}</p>}
        <div className="stack-buttons">
          {voiceEnabled && <button type="button" className="btn primary" onClick={requestMic} disabled={!interactive || permissionBusy}>
            <Icon name="mic"/>{permissionBusy ? c.waiting : c.allow}
          </button>}
          <button type="button" className={voiceEnabled ? "btn secondary" : "btn primary"} onClick={noMic} disabled={!interactive}><Icon name="keyboard"/>{c.typingMode}</button>
        </div>
        <div className="small-note"><Icon name="lock" size={16}/>{c.safe}</div>
      </section>}
      {stage === "ringing" && <section className="phone-panel ring-panel" ref={statusFocus} tabIndex={-1}>
        <div className="phone-top"><span className="dark-tag"><span className="signal-dot"/>{c.ringing}</span></div>
        <div className="caller-id"><div className="avatar pulse"><Icon name="phone" size={36}/></div><h1>{c.unknown}</h1><p>{c.bank}</p></div>
        {declined && <p className="dark-notice" role="status">{c.declined}</p>}
        {error && <p className="dark-notice" role="alert">{error}</p>}
        <div className="ring-actions">
          <button className="ring-action" type="button" onClick={() => setDeclined(true)}><span className="red"><Icon name="end" size={27}/></span>{c.decline}</button>
          <button className="ring-action" type="button" onClick={answer}><span className="green"><Icon name="phone" size={25}/></span>{c.answer}</button>
        </div>
        <p className="phone-foot"><Icon name="shield" size={15}/>{c.ribbon}</p>
      </section>}
      {statuses[stage] && <section className="phone-panel active-panel">
        <div className="phone-top in-call-top"><div className="phone-person"><span className="small-avatar"><Icon name="phone" size={18}/></span>
          <div><strong>{c.bank}</strong><small>{c.live}</small></div></div>
          <span className="timer">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
        </div>
        <div className="call-caption" aria-live="polite">
          <div className="caption-meta"><span>{c.captions}</span>{stage === "ready" && captions.some((line) => line.audioUrl) &&
            <button type="button" onClick={replay}><Icon name="replay" size={15}/>{c.replay}</button>}</div>
          {captions.length ? captions.map((item) => <p key={item.lineId} className={activeCaption && activeCaption !== item.lineId ? "caption-quiet" : undefined}>{item.caption}</p>) : <p>{c.connecting}</p>}
          {audioMissing && <small>{c.audioUnavailable}</small>}
        </div>
        <div className="call-status" role="status" tabIndex={-1} ref={(element) => { statusFocus.current = element; }}><span className={stage === "recording" ? "signal-dot recording-dot" : "signal-dot"}/>
          {statuses[stage]}{stage === "recording" && ` · ${Math.max(0, RECORD_SECONDS - second)}s`}</div>
        {error && <div className="dark-notice" role="alert">{error}
          {retry && <button className="text-dark" type="button" onClick={() => { if (clip.current) void upload(clip.current, begin()); }}>{c.retry}</button>}</div>}
        {stage === "transcribing" && <button className="text-dark" type="button" onClick={() => {
          begin(); setRetry(Boolean(clip.current)); setStage("ready");
        }}>{c.cancel}</button>}
        {stage === "confirm" && heard && <div className="reply-sheet" aria-live="polite">
          <span className="eyebrow">{c.heard}</span><p>{heard.transcript}</p>
          <div className="trace-tags"><span>{heard.stt.model}</span>{heard.stt.detectedLanguage && <span>{heard.stt.detectedLanguage}</span>}</div>
          <div className="sheet-actions"><button className="btn secondary" type="button" onClick={mic}>{c.rerecord}</button>
            <button className="btn primary" type="button" onClick={() => void submit({
              inputMode: "voice", text: heard.transcript, stt: heard.stt, proof: heard.proof,
            }, "confirm")}>{c.send}<Icon name="arrow" size={17}/></button></div>
        </div>}
        {stage === "typing" && <form className="reply-sheet" onSubmit={(event) => {
          event.preventDefault(); if (draft.trim()) void submit({ inputMode: "typed", text: draft }, "typing");
        }}>
          <label className="eyebrow" htmlFor="reply-text">{c.type}</label>
          <textarea id="reply-text" value={draft} maxLength={300} rows={2} placeholder={c.typePrompt} onChange={(event) => setDraft(event.target.value)} autoFocus />
          <div className="sheet-actions"><button className="btn secondary" type="button" onClick={() => setStage("ready")}>{c.back}</button>
            <button className="btn primary" type="submit" disabled={!draft.trim()}>{c.send}<Icon name="arrow" size={17}/></button></div>
        </form>}
        {stage === "ready" && (quick ? <div className="quick-replies"><div className="quick-label">{c.quick}</div>
          <div className="quick-grid">{buttons.filter((id) => id !== "hang_up").map((id: Button) =>
            <button type="button" key={id} onClick={() => void submit({ inputMode: "button", buttonId: id }, "ready")}>
              {id === "go_along" && currentSession && graph[currentSession.stateId].demand === "otp" ? c.shareCode : c[id]}
            </button>)}</div>
        </div> : <button type="button" className="text-dark" onClick={() => setQuick(true)}>{c.options}</button>)}
        <div className="call-controls">
          <button type="button" onClick={() => { setError(""); setStage("typing"); }} disabled={!canReply}>
            <span><Icon name="keyboard" size={22}/></span>{c.type}
          </button>
          <button className="talk-control" type="button" onClick={mic} aria-pressed={stage === "recording"}
            disabled={!voice || !(stage === "ready" || stage === "recording")}>
            <span className={stage === "recording" ? "red" : "light"}><Icon name={stage === "recording" ? "close" : "mic"} size={26}/></span>
            {stage === "recording" ? c.stop : c.mic}
          </button>
          <button type="button" onClick={hangup} disabled={stage === "ending" || Boolean(outcome)}>
            <span className="red"><Icon name="end" size={24}/></span>{c.hangup}
          </button>
        </div>
        <p className="phone-foot"><Icon name="lock" size={15}/>{c.noSecret}</p>
      </section>}
      {stage === "reveal" && outcome && result && <Reveal locale={locale} outcome={outcome} next={() => setStage("debrief")} focus={statusFocus}/>}
      {stage === "debrief" && currentSession && result && <Debrief locale={locale} session={currentSession} result={result}
        next={() => setStage("card")} reset={reset} focus={statusFocus}/>}
      {stage === "card" && result && <ResultCard locale={locale} token={result.shareToken} reset={reset} focus={statusFocus}/>}
    </main>
  </Chrome>;
}
