# Gnani live verification

**Status on November 6, 2026 · live Prisma and Timbre verified in English, Hindi, Tamil and Telugu.**

The REST request and response shapes follow the official [Prisma documentation](https://docs.gnani.ai/api/STT/speech-to-text) and [Timbre documentation](https://docs.gnani.ai/api/TTS/tts-inference). The [live probe](probe.json) records the actual responses. The [route smoke](route-smoke.json) uses the app’s WAV encoder and live Prisma through the actual STT route.

The [deployed browser smoke](deployed-smoke.json) used a Timbre-generated microphone fixture with the public app. It verified real caller playback, live Prisma, confirmation, the debrief request ID and a PNG result.

- [x] Timbre v3.0 with Avinash returned both WAV and MP3 in all four languages.
- [x] Prisma v3.0 and the default v2.5 returned model and request IDs for one synthetic clip per language.
- [x] Both models returned the intended short phrases with script and punctuation variations. Prisma v3.0 used Latin script for some words in the Telugu probe.
- [x] The route passed with normalized 16 kHz WAV, a Prisma model and request ID, and signed confirmation metadata in all four languages.
- [x] Verify the checksums of all 60 Timbre v3.0 caller clips. FFmpeg decoded all 30 newly generated Tamil and Telugu clips.
- [ ] Listen to the caller clips and record any pronunciation issues.
- [ ] Record dashboard credit consumption and concurrency limits.
- [ ] Run human, concurrency, short/long clip and condition checks if the initial provider gate passes and credits allow.

`pnpm probe` writes the observed statuses, selected safe response fields and measured timing to `probe.json`. The script excludes transcripts from supplied human clips and masks digits in its scripted round trip. Keep personal clips out of source control.
