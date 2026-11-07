# ScamSuno

An educational scam-call simulation in English, Hindi, Tamil and Telugu. Answer a fictional call from Kalpanik Bank, decide how to respond, then review the caller’s red flags and your decisions.

**[Try ScamSuno](https://scamsuno.vercel.app)**

The build includes Timbre-generated caller audio, captions, quick replies, four endings, a scored debrief, and a downloadable result card. Live Prisma transcription and free-form reply labelling use server credentials. See the [release checklist](docs/PROGRESS.md) and [Gnani verification evidence](evidence/day0/SUMMARY.md).

Production currently offers live Prisma with quick replies for free-form input. The hosted classifier is awaiting credentials.

## Isolated V2 development

V1 is preserved at the immutable `v1-stable` release. This worktree uses `feature/scamsuno-v2`; production promotion requires explicit user approval. See [the tested recovery procedure](docs/V1_PRESERVATION.md), [V2 progress](docs/IMPLEMENTATION_PROGRESS.md) and [architecture](docs/DYNAMIC_VOICE_ARCHITECTURE.md). Run `pnpm check:v1` after each major milestone.

V2 currently has a fixture-tested conversation controller, bounded memory, separate caller/evaluator adapter contracts, safety validation and prepared-turn integration. It has no connected live model, durable store or V2 voice UI yet. The original application routes remain the V1 experience in this branch.

Development must use free services only. Create a key on the [Groq Free plan](https://console.groq.com/keys) and put it in this worktree's ignored `.env.local` as `LLM_API_KEY`; never paste keys into chat. Groq's [free limits](https://console.groq.com/docs/rate-limits) vary by model/account. The local setup uses `https://api.groq.com/openai/v1` and provisionally `openai/gpt-oss-20b`, pending actual account access and Tamil/Telugu evaluation. Keep speech and V2 live admission disabled until the durable quota gate passes. Do not upgrade plans or add payment methods.

## Run locally

Use Node.js 24 and pnpm 11.25.0. The lockfile pins the dependency versions.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open [ScamSuno locally](http://127.0.0.1:3000). With empty credentials, continue without the microphone and use quick replies. For local fixture testing, set `GNANI_MODE=mock` and `CLASSIFIER_MODE=buttons` in the shell or ignored `.env.local`. Mock mode carries a visible badge and is rejected on Vercel production.

## Live voice

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

The call is turn-based and scripted. Speech recognition can mishear short replies, and a model can still mislabel free-form intent. Some in-app browsers block the microphone. Rate limits apply per running instance, and public voice use depends on provider credits. The simulation has no measured real-world protection outcome.

## Verify and deploy

```sh
pnpm verify
pnpm exec playwright install chromium
pnpm test:e2e
pnpm check:audio
```

Set `PLAYWRIGHT_CHROME` to a local Chrome executable to use it for browser tests. Browser tests use generated signal audio and labelled mock transcription. The live text evaluation uses a separate synthetic dataset and a configured classifier. Run `pnpm eval:text` for development cases, and `pnpm eval:text --holdout` after freezing the classifier.

Import the private GitHub repo into Vercel and use the Next.js preset with Node.js 24. Configure production and preview server variables separately. Production checks audio coverage and prohibits mock mode. Use the configured Mumbai region if the project supports it. After deployment, follow the real-device smoke steps before sharing the URL. [Vercel GitHub setup](https://vercel.com/docs/git/vercel-for-github) · [Vercel environment variables](https://vercel.com/docs/environment-variables)

- [Technical decisions](docs/DECISIONS.md)
- [Device checks](docs/DEVICE_TESTS.md)
- [Demo and submission instructions](docs/DEMO.md)
- [Progress checklist](docs/PROGRESS.md)
