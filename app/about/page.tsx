import Link from "next/link";
import { Chrome } from "@/components/chrome";
import { Icon } from "@/components/icons";
import { rules } from "@/domain/rules";
import { health } from "@/server/health";

export const dynamic = "force-dynamic";

export default function About() {
  const status = health();
  return <Chrome mock={status.mode === "mock"} compact><main className="play-wrap shell">
    <article className="surface about">
      <div className="eyebrow"><span className="signal-dot"/>Behind the call</div>
      <h1>How ScamSuno works</h1>
      <p>ScamSuno is a fictional call for practising how to respond to pressure. The caller follows a fixed script and reacts to the intent of each reply.</p>
      <ol className="about-flow">
        <li><strong>Reply by voice, text or choice.</strong><p>Voice is recorded in short turns. Confirm what the speech service heard before sending it.</p></li>
        <li><strong>Classify the reply.</strong><p>A classifier can label replies when configured. Quick replies select a known intent directly.</p></li>
        <li><strong>Follow the script.</strong><p>The dialogue engine chooses a prewritten line. The debrief shows which behaviours the session exercised.</p></li>
      </ol>
      <h2>Speech and classification</h2>
      <p>Prisma STT configuration · {status.stt.primaryModel} with {status.stt.fallbackModel} fallback. {status.stt.enabled
        ? status.mode === "mock" ? "Development fixtures are enabled." : "Voice is enabled. Successful replies show the actual response model and request ID."
        : "Voice is currently unavailable."}</p>
      <p>Caller audio · {status.tts.models.length ? `Pre-generated with ${status.tts.models.join(", ")}.` : "Caption playback is available. Timbre audio has yet to be generated."}</p>
      <p>Reply labelling · {status.classifier.model ? `${status.classifier.model} via ${status.classifier.provider}.` : "Quick replies are available."}</p>
      <h2>Privacy and limitations</h2>
      <p>Use fictional details. Audio goes to Gnani for transcription and the current text reply goes to the classifier provider when enabled. Their handling is governed by their own terms. ScamSuno keeps no server-side audio or transcripts.</p>
      <p>Speech recognition and reply labelling can misread short or ambiguous replies. Confirm the transcription, switch to text or choose a quick reply. Some in-app browsers restrict microphone access.</p>
      <h2>Evaluation</h2><p>Provider and phone evaluation is pending. The feedback describes behaviour inside this practice call.</p>
      <h2>Official guidance</h2>
      <ul>{rules.map((rule) => <li key={rule.id}><a href={rule.url} target="_blank" rel="noreferrer">{rule.source} · {rule.title}</a></li>)}</ul>
      <Link className="btn primary" href="/">Try ScamSuno<Icon name="arrow" size={18}/></Link>
    </article>
  </main></Chrome>;
}
