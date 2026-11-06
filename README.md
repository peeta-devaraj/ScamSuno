# ScamSuno

An educational scam-call simulation in English and Hindi. Answer a fictional call from Kalpanik Bank, decide how to respond, then review the caller’s red flags and your decisions.

The build includes Timbre-generated caller audio, captions, quick replies, four endings, a scored debrief, and a downloadable result card. Live Prisma transcription and free-form reply labelling use server credentials. See the [release checklist](docs/PROGRESS.md) and [Gnani verification evidence](evidence/day0/SUMMARY.md).

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
2. Run `pnpm probe`. It requests real Timbre WAV and MP3 and sends the generated WAV to real Prisma. It also accepts optional English and Hindi WAV paths after the command. Results go to `evidence/day0/probe.json`.
3. Review Hindi caller lines and listen to the synthesized voice. Run `pnpm audio:gen` after the probe confirms the model and output format. Add `--v25` or `--wav` when the probe supports that choice. Run `pnpm check:audio` before release.
4. Configure `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` and `LLM_PROVIDER_NAME` for an HTTPS OpenAI-compatible classifier. Set `CLASSIFIER_MODE=buttons` to use explicit quick replies with voice transcription available independently.

`pnpm test:live` verifies the real STT route with a Timbre-generated scripted clip for each language. FFmpeg is used locally to decode the fixture before encoding browser-format WAV. Production recording uses the browser encoder directly.

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
