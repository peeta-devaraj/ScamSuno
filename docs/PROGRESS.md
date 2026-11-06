# ScamSuno progress

## Completed locally

- [x] Read MVP.md and audit the workspace, toolchain and documented provider APIs.
- [x] Initialize Git and create the private GitHub repository.
- [x] Implement Prisma and Timbre adapters, a real-call probe, and the static audio generation and manifest check.
- [x] Implement the KYC script, deterministic branching, all four endings, and uncertainty-aware scoring.
- [x] Replace the unsafe contextual digit shortcut and test quotations, refusals and misleading classifier suggestions.
- [x] Implement AudioWorklet recording, transcript confirmation, typing, quick replies and the full captions path.
- [x] Implement the debrief, official sources, privacy-safe PNG and share page.
- [x] Prepare the Vercel build, automated checks, synthetic text evaluation, and demo instructions.
- [x] Run the local type check, unit and route tests, and production build.
- [x] Pass all five mobile-viewport Chromium journeys with labelled mock STT.
- [x] Verify real Timbre v3.0 and Prisma v3.0/v2.5 responses in English and Hindi.
- [x] Verify live Prisma through the application STT route with browser-format WAV.
- [x] Generate the complete Timbre audio manifest and verify all asset checksums.
- [x] Create the Vercel project and configure encrypted Gnani credentials with explicit authorization.
- [x] Push the implementation to the private GitHub repository and pass GitHub Actions.
- [x] Deploy [ScamSuno](https://scamsuno.vercel.app) to Vercel production.
- [x] Complete the production Chromium journey with live Prisma, actual Timbre playback, a confirmed voice reply, the debrief trace and a PNG card. The microphone input was synthetic.
- [x] Add Tamil and Telugu alongside English and Hindi. Verify all 60 caller clips, four live STT round trips and seven Chromium journeys.
- [x] Deploy the four-language update. Verify the public STT route in each language and complete both new localized browser journeys with quick replies.

## Release gates

- [ ] Native-speaker listening review and actual phone verification.
- [ ] Hosted text labelling and evaluation. Waiting for access to an OpenAI-compatible classifier.
- [ ] Android Chrome and iOS Safari verification on a deployed HTTPS URL. Requires deployment and physical devices.
- [ ] Automatic Git-triggered deployments. The CLI deployed production successfully. Vercel requires the account owner to authorize a GitHub Login Connection before linking the private repository.
- [ ] Record the real demo and complete the public post and submission steps after the live device gate.

## Deferred to protect P0

Additional scenarios, analytics, streaming speech, shared storage, extensive audio evaluation infrastructure, and post-release engagement tasks. The small dev/holdout text suite is ready to run when the classifier is configured. Human audio evaluation and device latency remain pending.
