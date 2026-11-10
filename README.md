# ScamSuno — Can you trust this call?

![ScamSuno. Can you trust this call? An educational simulation.](public/brand/scamsuno-social.png)

**Trust or Trap** is a multilingual educational simulator for practising how to respond to a convincing phone call. It was built for Gnani AI’s Great Indian AI Internship Challenge 2026.

[Open Trust or Trap](https://scamsuno.vercel.app/) · [Read the one-page solution pitch](docs/submission/ScamSuno-One-Page-Solution-Pitch.pdf) · [Watch the 2:05 competition demo](docs/submission/ScamSuno-Submission-Final.mp4) · [Open Classic scripted practice](https://scamsuno-classic.vercel.app/)

## Try Trust or Trap

1. Choose English, தமிழ் (Tamil), తెలుగు (Telugu) or हिन्दी (Hindi). The server assigns a fictional legitimate, fraudulent or ambiguous call.
2. Read or listen to the caller and reply in your own words. When voice is available, record a short turn and review the transcript before sending.
3. Open the simulated trusted app to verify the notice. The caller’s identity remains unverified.
4. End the call to reveal the scenario and see feedback based on the choices observed. Untested behaviours and uncertain interpretations stay unscored.

Use fictional details. If live admission is closed, the public entry links to Classic, the separate scripted exercise with shipped caller audio.

## Architecture

A confirmed voice transcript or typed reply enters the same server-owned scenario. A hosted text model selects from scenario-approved caller lines. The server validates the selection and evaluates participant decisions separately. Gnani **Prisma** transcribes the voice turn, and Gnani **Timbre** synthesises the approved caller line. The browser receives a restricted view of the session. The server releases the debrief after End.

The stack uses Next.js, React, TypeScript, Zod and libSQL. The app handles audio in memory and sends recordings to Gnani for transcription. New V3 session records omit participant reply text. The filtered current reply can go to the hosted model. The durable usage ledger limits provider admission. [Scenario design](docs/V3_SCENARIO_DESIGN.md) · [Evaluation rubric](docs/V3_EVALUATION_RUBRIC.md) · [Usage ledger](docs/V2_LEDGER_SCHEMA.md)

## Demo and verification limits

The final competition video, **ScamSuno-Submission-Final.mp4**, runs **2:05**. It shows two offline typed cases and explains the voice architecture. The [submission assets](docs/submission/README.md) include the full demo, the separate 60-second social cut, and captions for both.

A separate bounded English API smoke used synthetic input with live Prisma and Timbre and completed the reply and debrief. Physical Android microphone acceptance in Tamil and Telugu remains pending. Live speech and hosted conversations depend on the production admission policy. The simulator is an educational prototype. [Public rollout and provider evidence](docs/release/PUBLIC_VOICE_ROLLOUT.md)

## Run locally

Use **Node.js 24** and **pnpm 11.25.0**. The local mock uses scripted practice and requires no provider credentials.

```sh
pnpm install --frozen-lockfile
GNANI_MODE=mock CLASSIFIER_MODE=buttons VERCEL_ENV=development pnpm dev
```

In PowerShell, run the install first, then set the environment and start the server.

```powershell
$env:GNANI_MODE = 'mock'
$env:CLASSIFIER_MODE = 'buttons'
$env:VERCEL_ENV = 'development'
pnpm dev
```

Open [the local home page](http://127.0.0.1:3000). To exercise the V3 flow using labelled offline fixtures, install the Playwright Chromium browser and run the V3 journeys.

```sh
pnpm exec playwright install chromium
pnpm test:e2e --headed tests/browser/v3.spec.ts
```

Run `pnpm verify` for type checking, unit and route tests and the production build. Run `pnpm check:audio` for shipped audio integrity and `pnpm test:e2e` for the full browser suite.

Keep credentials in ignored local environment files or the intended server environment. GitHub verification and Vercel promotion are separate. [Environment template](.env.example) · [Voice runbook](docs/audit/V3_VOICE_LAUNCH_RUNBOOK.md) · [V1 preservation](docs/V1_PRESERVATION.md) · [V3 recovery](docs/V3_RECOVERY.md)
