# ScamSuno

An educational scam-call simulation in English, Hindi, Tamil and Telugu. Answer a fictional call from Kalpanik Bank, decide how to respond, then review the caller’s red flags and your decisions.

**[Try ScamSuno](https://scamsuno.vercel.app)**

## Trust or Trap — V3

V3 development is isolated on `codex/scamsuno-v3`; canonical V1 and the preserved V2 preview are unchanged. The new `/v3` mode mixes three fictional caller scenarios and hides their assignment until the debrief. Tamil, Telugu, Hindi and English support free-form voice/text, independent simulated verification and nonnumeric evidence-based feedback. Caller generation reuses V2's bounded model/speech transports, with V3-owned sessions and atomic credit controls.

The complete implementation includes private `/admin/v3` durable pause, feature rollback, masked retained replies, signed transcript confirmation and privacy-safe public responses. The latest integrated checks passed 255 tests, type checking and production build; 23 browser journeys passed using explicit fixtures. Human phone and live V3 provider trials are deferred at the user's request. No educational-effectiveness or recognition-accuracy claim is established.

[Current private V3 Preview](https://scamsuno-v3-7pvoq66z3-peetadevaraj-2614s-projects.vercel.app/v3) runs in the dedicated `scamsuno-v3` project with its own $0 database and sensitive Preview configuration. Real Tamil/Telugu typed conversations now pass; speech and physical-phone acceptance remain pending. Test access uses an expiring bounded ledger allowance, so the page becomes unavailable when that allowance expires or is exhausted. See [resource isolation and current window](docs/V3_ISOLATION.md). Earlier V3-on-V2-project URLs are historical and closed.

See [V3 progress](docs/V3_PROGRESS.md), [deployment and operating instructions](docs/V3_DEPLOYMENT.md), [scenario design](docs/V3_SCENARIO_DESIGN.md), [rubric](docs/V3_EVALUATION_RUBRIC.md), [observed test results](docs/V3_TEST_RESULTS.md) and [demo plan](docs/V3_DEMO_PLAN.md). Private preview provider traffic stays paused until the later test window. Production promotion still requires explicit approval.

The build includes Timbre-generated caller audio, captions, quick replies, four endings, a scored debrief, and a downloadable result card. Live Prisma transcription and free-form reply labelling use server credentials. See the [release checklist](docs/PROGRESS.md) and [Gnani verification evidence](evidence/day0/SUMMARY.md).

V1 production currently offers live Prisma with quick replies for free-form input. Its hosted classifier is not configured. V2 is developed separately and has its own server-only Groq credential.

## Isolated V2 development

V1 is preserved at the immutable `v1-stable` release. V2 remains in the separate `feature/scamsuno-v2` worktree and `v2-verified-2026-11-08` recovery reference. Production promotion requires explicit user approval. See [the tested recovery procedure](docs/V1_PRESERVATION.md), [V2 progress](docs/IMPLEMENTATION_PROGRESS.md) and [architecture](docs/DYNAMIC_VOICE_ARCHITECTURE.md). Run `pnpm check:v1` after each major milestone.

V2 has a bounded controller, independent caller/evaluator contracts, durable server sessions, a quota-admitted Groq gateway, runtime Prisma/Timbre routes and private `/admin/usage`. The mobile `/v2` UI supports four languages, confirmed voice input, typed fallback, captions, End Call and evidence-based results. Browser acceptance and deployment checks are in progress; this is not yet a production release.

Real Tamil and Telugu API probes completed a Timbre → Prisma → signed voice confirmation → contextual caller/evaluator → Timbre → End journey. Inputs were explicitly synthetic speech, not a human microphone test. V2 has recorded 14 Gnani and 22 Groq attempts; exact credit cost is unknown. See [observed results and limitations](docs/TEST_RESULTS.md). Provider admission was closed after the probes. Physical-device listening and microphone acceptance remain pending.

Development uses the existing Gnani challenge allocation, [Groq Free](https://console.groq.com/keys) with `openai/gpt-oss-20b`, and an isolated Turso Starter database at $0/month. Keep credentials in ignored local files or encrypted server variables; never paste them into chat. [Groq limits](https://console.groq.com/docs/rate-limits) vary by account. Do not upgrade plans or add payment methods. The separate `scamsuno-v2-preview` project uses Preview/Development database configuration only; authorized secrets are configured in Preview with `V2_LIVE_ENABLED=false`.

## Run locally

Use Node.js 24 and pnpm 11.25.0. The lockfile pins the dependency versions.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open [ScamSuno locally](http://127.0.0.1:3000). With empty credentials, continue without the microphone and use quick replies. For local fixture testing, set `GNANI_MODE=mock` and `CLASSIFIER_MODE=buttons` in the shell or ignored `.env.local`. Mock mode carries a visible badge and is rejected on Vercel production.

Open `/v2` for the isolated dynamic interface; Tamil is its default language. The API fails closed unless the remote store, provider settings, live flag and current bounded quota policy all permit it. A visible UI fixture is available only in a local development mock environment at `/v2?fixture=1`; it cannot enable provider calls or run on Vercel. See [V2 architecture](docs/DYNAMIC_VOICE_ARCHITECTURE.md), [credit safeguards](docs/GNANI_CREDIT_TRACKING.md) and [unknown-charge recovery](docs/LEDGER_RECOVERY.md).

## V1 live voice tooling

1. Put `GNANI_API_KEY` in the ignored `.env.local` file. Copy the structure from `.env.example` if needed. Keep keys in server environment variables.
2. Run `pnpm probe`. It requests real Timbre WAV and MP3 and sends the generated WAV to real Prisma. It accepts optional WAV paths in English, Hindi, Tamil and Telugu order. Results go to `evidence/day0/probe.json`.
3. Review caller lines and listen to the synthesized voice. Run `pnpm audio:gen` after the probe confirms the model and output format. Add `--v25` or `--wav` when the probe supports that choice. Run `pnpm check:audio` before release.
4. Configure `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` and `LLM_PROVIDER_NAME` for an HTTPS OpenAI-compatible classifier. Set `CLASSIFIER_MODE=buttons` to use explicit quick replies with voice transcription available independently.

`pnpm test:live` verifies the real STT route with a Timbre-generated scripted clip for each language. Pass the HTTPS site URL to verify a deployment. FFmpeg is used locally to decode the fixture before encoding browser-format WAV. Production recording uses the browser encoder directly.

The configured STT path uses Prisma v3.0 with Prisma v2.5 fallback for documented model or scope failures. The UI shows the model and request ID returned by Prisma after a voice reply is confirmed. Timbre runs during asset generation. The manifest records the exact model, voice, caption and checksum for each generated file. [Gnani API quick start](https://docs.gnani.ai/api/introduction/quick-start)

## How it works

```text
AudioWorklet -> 16 kHz WAV -> /api/stt -> Gnani Prisma -> user confirms
Voice or text -> /api/turn -> constrained label -> deterministic script
Quick reply  -> /api/turn -> explicit intent   -> deterministic script
Ending       -> debrief   -> enum-only share link -> /api/card PNG
```

The labeller can return compliance, refusal, a question, hang-up, acknowledgement or uncertainty. The script owns all caller text, escalation and endings. A narrow digit-only shortcut applies during an OTP demand. Quoted or contextual numbers never trigger it, and a model suggestion of compliance on a contextual code is downgraded to unclear. Untested behaviours are excluded from the points total.

ScamSuno sends voice clips to Gnani and sends the current reply text to the configured classifier. Providers handle inputs under their own terms. Audio and raw replies are processed in memory and omitted from server logs. The browser keeps a masked session until it is refreshed. Share cards contain outcome and behaviour grades. Use fictional information for every playthrough.

V1 is turn-based and scripted. V2 generates bounded dialogue inside a fixed fictional scenario and uses separate evaluation; it does not support streaming or full-duplex interruption. Speech recognition can mishear short replies, and a model can still mislabel free-form intent. Some in-app browsers block the microphone. V2 quotas are durable; V1's original limits remain per running instance. Public voice use depends on provider credits. The simulation has no measured real-world protection outcome.

## Verify and deploy

```sh
pnpm verify
pnpm exec playwright install chromium
pnpm test:e2e
pnpm check:audio
```

Set `PLAYWRIGHT_CHROME` to a local Chrome executable to use it for browser tests. Browser tests use generated signal audio and labelled mock transcription. The live text evaluation uses a separate synthetic dataset and a configured classifier. Run `pnpm eval:text` for development cases, and `pnpm eval:text --holdout` after freezing the classifier.

Use the separate V2 Vercel project and Preview deployments with Node.js 24. Keep production and preview server variables separate. Do not replace the canonical V1 deployment or promote V2 without explicit user approval. Production checks audio coverage and prohibits mock mode; deployed legacy routes in this branch cannot bypass the V2 paid-request ledger. Complete the real-device smoke steps before release. [Vercel GitHub setup](https://vercel.com/docs/git/vercel-for-github) · [Vercel environment variables](https://vercel.com/docs/environment-variables)

- [Technical decisions](docs/DECISIONS.md)
- [Device checks](docs/DEVICE_TESTS.md)
- [Demo and submission instructions](docs/DEMO.md)
- [Progress checklist](docs/PROGRESS.md)
