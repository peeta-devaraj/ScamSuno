# Gnani live verification

**Status on November 6, 2026 · live Prisma and Timbre verified in English and Hindi.**

The REST request and response shapes follow the official [Prisma documentation](https://docs.gnani.ai/api/STT/speech-to-text) and [Timbre documentation](https://docs.gnani.ai/api/TTS/tts-inference). The [live probe](probe.json) records the actual responses. The [route smoke](route-smoke.json) uses the app’s WAV encoder and live Prisma through the actual STT route.

The [deployed browser smoke](deployed-smoke.json) used a Timbre-generated microphone fixture with the public app. It verified real caller playback, live Prisma, confirmation, the debrief request ID and a PNG result.

- [x] Timbre v3.0 with Avinash returned both WAV and MP3 in English and Hindi.
- [x] Prisma v3.0 and the default v2.5 returned actual model and request IDs for both synthetic clips.
- [x] Both versions returned the intended text on the two short round trips, with punctuation, spelling and script variation. Prisma v3.0 used Latin script for some Hindi words.
- [x] The route passed with normalized 16 kHz WAV, a returned Prisma model and request ID, and signed confirmation metadata in both languages.
- [x] Generate all scripted caller lines with Timbre v3.0 MP3 and verify their manifest checksums.
- [ ] Listen to the English and Hindi clips and record any pronunciation issues.
- [ ] Record dashboard credit consumption and concurrency limits.
- [ ] Run human, concurrency, short/long clip and condition checks if the initial provider gate passes and credits allow.

`pnpm probe` writes the observed statuses, selected safe response fields and measured timing to `probe.json`. The script excludes transcripts from supplied human clips and masks digits in its scripted round trip. Keep personal clips out of source control.
