# ScamSuno V3 — Trust or Trap

An educational fictional-call simulation in Tamil, Telugu, Hindi and English. Ask your own questions, check a notice through the simulated trusted panel, end the call safely, then review evidence-based feedback. V3 uses turn-based voice: listen → record → confirm/send → hear the reply.

**[Open the V3 private Preview](https://scamsuno-v3-gy6v04bmg-peetadevaraj-2614s-projects.vercel.app/v3?l=ta)** · **[Verified build and current readiness](docs/audit/V3_REMEDIATION_RESULTS.md)** · **[Tamil/Telugu phone-test checklist](docs/audit/V3_DEVICE_ACCEPTANCE.md)**

V3's entry route is `/v3` on the dedicated private `scamsuno-v3` Preview. On deployments explicitly configured with `V3_TRUST_OR_TRAP_ENABLED=true`, `/` redirects to `/v3` and preserves a valid language choice. A Vercel sign-in prompt may appear. A paused page means the live allowance/configuration is closed; opening V1 does not test V3. Use the exact candidate link in the remediation results, not an older deployment URL.

**[V1 fallback — scripted practice](https://scamsuno.vercel.app)** remains separately available. It is the original experience, not the adaptive V3 test. Within V3, the other mode is explicitly labelled **V2 · Single-scenario practice**. The ScamSuno brand stays in V3.

## Current release boundary

V1/V2 and the pre-remediation V3 recovery point are preserved. P0 changes are isolated on `codex/scamsuno-v3-p0`; application Production promotion requires explicit approval. Physical Tamil/Telugu phone acceptance remains **pending the participant's observed results**. Automated browser fixtures do not establish real microphone, recognition, caller-speech quality or educational effectiveness.

Gnani's current remaining balance is **unknown unless reconciled against fresh provider data**. V1 and V3 share the provider account. Durable V3 controls limit request attempts, duration, text size and concurrency, but do not guarantee an account-wide credit reserve. A private Preview can be published with live admission closed; live phone testing requires a fresh reconciled bounded window. No streaming or automatic interruption is implemented.

P0 consistency protection constrains the caller to model-selected, server-reviewed responses for its assigned scenario. Participants can reply freely; arbitrary model-authored facts are rejected. This trades caller wording variety for scenario consistency.

See [P0 remediation results](docs/audit/V3_REMEDIATION_RESULTS.md), [release checklist](docs/audit/V3_RELEASE_CHECKLIST.md), [scenario design](docs/V3_SCENARIO_DESIGN.md), [rubric](docs/V3_EVALUATION_RUBRIC.md), [independent audit](SCAMSUNO_V3_INDEPENDENT_AUDIT.md) and [resource isolation](docs/V3_ISOLATION.md). Older evidence below describes V1/V2 milestones and does not establish current V3 acceptance.

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
