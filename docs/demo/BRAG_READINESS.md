# ScamSuno demo and /brag readiness — November 9, 2026

The revised draft shows the signed-out public V3 entry and closes with [scamsuno.vercel.app](https://scamsuno.vercel.app). See [current production status](VIDEO_PRODUCTION_STATUS.md) for the export and evidence.

**Decision: The draft is ready for review; the genuine Android exchange is still pending.** [Public V3](https://scamsuno.vercel.app) has a bounded voice rollout and a passing real-provider smoke with synthetic English input. That smoke does not certify a phone or supply footage. [Classic](https://scamsuno-classic.vercel.app) remains the separate scripted fallback. The recorded Gnani challenge deadline is **November 10, 2026 at 11:59 p.m. IST**. Treat social publication and competition submission as separate approvals. [Public voice rollout](../release/PUBLIC_VOICE_ROLLOUT.md) · [Official challenge rules](https://www.gnani.ai/internship).

## Tooling and installation

- The project-local `/brag` workflow is pinned to `669ab928`; the editable timeline uses HyperFrames 0.9.26, Chrome and FFmpeg. No tool installation is needed for this revision. The storyboard explicitly uses 60 seconds. [Editor and render commands](../../brag-output/composition/README.md) · [Upstream skill](https://github.com/latent-spaces/brag).

## Record two real acceptance takes

1. Confirm the exact approved target and remaining bounded allowance before recording. Public V3 requires no sign-in; a protected candidate requires Vercel sign-in outside the recording. On Android Chrome, enable the phone's native screen recorder with **device sound and microphone** if available. Check the recorder locally first, without calling a provider. Hide notifications and account details. If the recorder interferes with the browser microphone, complete acceptance first and use a second device only if it preserves intelligible, synchronized audio.
2. Record one continuous Tamil take from incoming call to debrief, then one Telugu take. For each, include the caller's audible opening and caption, a short reply in your own words using fictional details, the original on-screen transcript, unchanged confirmation, the contextual caller reply, End, and the debrief. Ask a short question about the caller's reason or how to verify the notice. Use the simulated independent check after End for the shortest plan. Show what it verifies without implying it authenticates the caller. [Device procedure and result form](../audit/V3_DEVICE_ACCEPTANCE.md).
3. Keep the original files privately. Log candidate, language, phone/Chrome version, original transcript quality, caller audio, contextual fit, End/debrief and any error. An edited transcript is typed input. If either take fails, stop and report it without retries; the plan has no retry allowance. Do not send passwords, real OTPs, account identifiers, dashboard screens or raw footage containing private details.
4. Once both acceptance runs are documented, select the clearest genuine exchange for the 60-second edit. Keep its reply and debrief from the same session. Save the second take for language verification or a separately labeled clip. Use only audio from the real take for the caller and user; captions should reflect what was heard. Mark cuts that shorten waiting. Never stitch turns together to imply faster performance or a different response.

## 60-second storyboard and caption copy

- **00:00–00:05 · Problem.** A restrained incoming-call graphic. On-screen: **“A convincing voice can still be a scam.”** Label it illustrative; use no synthetic caller dialogue.
- **00:05–00:10 · Product.** Show real footage of the V3 Trust or Trap entry. On-screen: **“ScamSuno · Trust or Trap”** and **“Practise with fictional calls.”**
- **00:10–00:36 · Genuine voice exchange.** From one accepted take, let viewers hear the opening, the user's question and caller's reply; show the actual transcript confirmation. On-screen: **“Speak → confirm what was heard → hear the reply.”** Use small labels for **Gnani Prisma STT** and **Gnani Timbre TTS** only on the corresponding verified segments. Use a visible cut marker if waiting is shortened. Keep the voice/confirmation sequence in order.
- **00:36–00:45 · Independent check.** Show End, then the simulated trusted-panel check from the same call. On-screen: **“Verify through a trusted channel.”** Explain that verifying the notice does not authenticate the inbound caller.
- **00:45–00:52 · Result.** Return the focus to the same call's evidence-based debrief. On-screen: **“Feedback based on what you did.”** Show one real observed signal and leave an untested behavior unscored.
- **00:52–00:56 · Three categories.** Illustrated cards: **“Legitimate” · “Fraudulent” · “Ambiguous.”** Label them **“Scenario categories”**. This explains the design; it does not imply that all three were played on the phone.
- **00:56–01:00 · Brand and URL.** ScamSuno waveform and wordmark, **“Trust or Trap · Educational simulation.”** Keep the signed-out-verified `scamsuno.vercel.app` on the end card.

## Assets and edit checks

- Use the repository wordmark/waveform and V3 colors; reference the [V3 styles](../../app/v3/v3.module.css). The graphic placeholders are the incoming call, language lower-third, trusted-channel callout, three category cards and closing brand frame. Keep illustrated graphics distinct from screen footage. Prepare separate live-footage slots and an editable end-card URL field.
- Choose 1920×1080 at 30 fps with a large portrait phone inset, H.264 video and AAC audio in MP4. Give the phone UI room to be readable at playback size. Burn in short English subtitles and have a Tamil/Telugu speaker confirm translations; preserve the actual speech. Keep sound effects out of the spoken exchange. Include an accessible caption file if practical.
- Verify actual duration, video and audio tracks, audio and on-screen action synchronization and output readability on mobile. Watch the entire rendered file once with sound and once muted. Scrub for any private content. Make it clear the conversation is turn-based: the user records and confirms, the caller responds within the scenario. Do not claim streaming, interruption, unrestricted caller generation or measured accuracy.
- For the submission description, identify the configured Gnani models (Prisma v3.0 and Timbre v3.0) and observed model provenance in the take. Groq `openai/gpt-oss-20b` is the default text-model configuration for classification and contextual selection. Explain the fictional education goal, independent verification and evidence-based feedback. Link to public V3 and disclose the bounded voice availability. Keep protected previews out of public copy.

## Exact next actions

1. **Done:** render and review the 60-second draft, including public landing footage, three labeled evidence slots, graphics, end card and thumbnail.
2. **Before filming:** check the approved target and its remaining allowance; use one Tamil and one Telugu call. Reconcile provider usage before any renewed allowance. Document both results and resolve any failed stage before using it as evidence.
3. **After acceptance:** replace the three slots from one accepted take, verify captions and audio/video sync, and recheck the public URL and claims. Review the final MP4 and post drafts with the owner before any publication or submission.
