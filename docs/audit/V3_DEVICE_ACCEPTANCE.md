# V3 physical-device voice acceptance — Tamil and Telugu

Status: **NOT PERFORMED**. This checklist is prepared for the participant. A development fixture, model-generated synthetic speech or a V1 screenshot cannot satisfy it.

## Operator preflight

- Use the exact candidate commit, immutable Preview URL and deployment ID in the [release stress report](V3_RELEASE_STRESS_REPORT.md). Confirm the page identifies V3 Trust or Trap before testing.
- Confirm private Vercel access: the participant signs into the same Vercel account on Android Chrome. Do not send credentials in chat or disable deployment protection to avoid login. Public judge access is a separate later release gate.
- Current Gnani balance is **unknown until freshly reconciled against provider data**. Capture only nonsecret official remaining-credit and STT/TTS/request totals with timestamp. Earlier screenshots and local request counters do not establish the current balance. V1 shares the provider account, so leave its allowance intact.
- Read durable V3 usage policy/counters and unresolved holds. Require a current reconciled policy with at most one active attempt. Never reset unknown or dispatched spending to regain quota. Preserve the V3-only pause mechanism.
- Open a short, explicitly bounded test window only after reconciliation. For the two minimal tests below, allowance is **six speech attempts total**: two opening TTS + two STT + two response TTS. Each reply generally requires evaluator + caller: **four model attempts minimum**. Choose a small explicit model cap with headroom; retain existing per-session and duration/text caps. These are request counts, not a credit cost forecast or reserve guarantee.
- Record the actual opening/closing time in IST and counters before testing. Do not reuse an old expiry from README/history. If the window expires, obtain a fresh reconciliation instead of silently extending it.
- If live admission is closed or quota cannot support both exchanges, stop before recording. Publish the closed private Preview normally; label voice acceptance as blocked, not passed.

## Participant setup

Use Android with Chrome (regular tab, HTTPS), headphones if available, quiet surroundings and a stable connection. Record phone model, Android version, Chrome version, speaker/headphone choice and network type. Do not use an in-app browser. iPhone/Safari remains unverified until separately tested.

1. Open the exact candidate URL ending `/v3?l=ta`. Sign into Vercel if asked.
2. Verify **V3** appears in the mode navigation and the educational simulation label is visible. The page must say Trust or Trap in the selected language. If you see preset V1 quick replies, stop and report the URL/mode; do not continue the wrong test.
3. Allow microphone permission when Chrome requests it. Use fictional information only. Never speak a real OTP, PIN, password, phone number, account detail or personal identifier.

## Tamil — one exchange

1. Select Tamil, answer the practice call, and wait until the caller audio finishes.
2. Check that spoken Tamil is audible and agrees with the visible caption. Note unusual pronunciation or a silent/partial clip.
3. Tap Speak your reply. Ask one short question **in your own words**, within 15 seconds; for example ask who is calling and what the service message concerns. You need not use a prescribed answer.
4. Tap Finish recording. Read the transcript. Before changing it, note whether it matches what you actually said; do not report a corrected transcript as original recognition success.
5. If recognition is usable, confirm/send unchanged once. Listen to the next response and check that it addresses your question and does not contradict its earlier message. If you edit the transcript, record that this became typed input; the unchanged-voice path still needs a later test.
6. Tap End. Confirm recording/playback stops and a debrief appears. Inspect the category explanation and evidence labels. Untested abilities must not be treated as successfully demonstrated.
7. Use the simulated trusted-panel check after End if desired; it requires no provider request. Confirm it describes the notice and explicitly does not authenticate the inbound caller.

## Telugu — one exchange

After Tamil has ended, open the **same candidate** with `/v3?l=te`. Repeat the seven steps in Telugu, asking a short original question. Do not press Replay repeatedly, open extra calls or retry failed recordings without checking the remaining allowance.

## Stop conditions

On any error, unexpected preset-only screen, wrong mode, missing microphone permission, unmatched transcript, silent caller, hanging request or failed End: capture the visible nonsecret error and stop. Report what happened before retrying. Stop recording/call on the device. If End cannot save, report that separately; do not invent a successful debrief. A provider timeout may still be chargeable.

## Result form — complete once per language

- Candidate URL/build/deployment:
- Date/time IST:
- Phone / Android / Chrome / network / audio output:
- Language:
- Correct V3 mode + educational label visible: pass/fail
- Opening audio clear and matched caption: pass/fail + comments
- Microphone worked: pass/fail
- Recognition matched spoken reply before edits: yes/partly/no + nonsecret comments
- Transcript edited: yes/no (edited input is typed)
- Confirm/send succeeded: pass/fail
- Caller response addressed the question: yes/partly/no + comments
- Response audio clear, no contradiction: pass/fail + comments
- End stopped recording/playback: pass/fail
- Debrief appeared and untested criteria stayed untested: pass/fail
- Post-End simulated check worked: pass/fail/not attempted
- Error shown / retries taken:

Do not upload or retain microphone audio for acceptance. Use comments or screenshots without real personal information. No accuracy percentage, latency benchmark or effectiveness claim follows from two exchanges.

## Operator closeout

Read counters and unresolved attempts afterward, reconcile official usage when available, record actual deltas and close admission. If provider balance is not observable, keep remaining balance unknown. Run the zero-provider V1 health monitor. Update the remediation results with participant-observed outcomes, separating speech, typed edits and fixture tests. Any failure requires a fix and targeted retest; P0 F02 remains pending until accepted observations exist.
