# Device verification

## Verified locally

Five automated Chromium journeys passed on November 6, 2026. They use a 390 × 844 viewport, a generated input waveform and labelled mock STT. They cover all four endings, mic denial, the real AudioWorklet capture, debrief and PNG download. This evidence is separate from the real-device gate.

## Release checks

- [ ] Android Chrome on deployed HTTPS, live English and Hindi microphone flows.
- [ ] iOS Safari on deployed HTTPS, audio starts after Answer, microphone flow completes, PNG opens or saves.
- [ ] Social in-app browser, mic denial or unsupported message, complete captions and quick replies.
- [ ] Phone with microphone permission denied, complete a call using quick replies.
- [ ] Desktop Chrome, keyboard controls, completed call, downloaded PNG and share page.
- [ ] Verify the production health endpoint reports live mode, an enabled STT service and complete caller audio.
- [ ] Confirm each voice transcript, check the actual Prisma model and request ID in the debrief, and record which device, OS, browser, scenario, language and network were used.
- [ ] Reach all four outcomes on production. Use fictional replies and include a refusal containing a synthetic code as a safety check.

Do not attach raw recordings, real codes or personal data to the verification record.
