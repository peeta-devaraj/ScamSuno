# V3 release stress report

November 9, 2026 IST. Baseline `13ee4c9`, branch `codex/scamsuno-v3-p0`. This review covers the existing V1, V2 and V3 routes, with remediation scoped to the dedicated V3 candidate.

## Baseline results

- `pnpm test` passed all 269 tests in 83.68 seconds. Coverage includes scenario consistency, ownership, redaction, signed voice proof, End races, transaction contention across SQLite clients, provider timeouts, charge holds, quotas, and recovery. [Unit log](evidence/release-baseline-unit.log)
- `pnpm test:e2e --repeat-each=2` passed 48 browser executions in 2.1 minutes. Covered locale navigation, V1 share, V2/V3 calls, microphone denial, audio capture and confirmation fixtures, delayed responses, End, verification and debrief. The baseline suite did not exercise a V2-to-V3 round trip or V3 draft recovery after an evaluator failure. [Browser log](evidence/release-baseline-browser.log)
- `pnpm exec tsx docs/audit/evidence/release-probes.cjs` exercised real handler code and local in-memory SQLite with synthetic provider configuration. The gateway was never called. [Probe log](evidence/release-baseline-probes.log)

## Confirmed defects

1. **R1 · Navigation and defaults.** V3 offers an explicit V2 link. V2 offers a brand link to the deployment-dependent root and no explicit V3 return. Both call pages and the V3 root redirect default to Tamil, and English is third in both pickers. Preserve a selected locale in both directions and move English to the first position and default.
2. **R2 · Closed-policy writes.** Twelve parallel start requests with an initialized, closed V3 ledger returned 200 and wrote twelve rows. The server checks the V3 pause flag but omits the policy check that the page uses. Gate live starts in the same transaction as session creation and bound concurrent start bursts at the database.
3. **R3 · V2 route on the V3 deployment.** A V2 start returned 200 under V3-enabled configuration. The V2 model/speech handlers use V2 admission hooks and share the project's ledger. A V3 pause does not close those hooks. This probe established route reachability without spending credits. Close V2 live dispatch in the dedicated V3 configuration and make the V2 page's return route visible.
4. **R4 · Bare numeric payload.** A synthetic six-digit reply reached both caller and evaluator request bodies unchanged. The redaction added in P0 covers named credential references and persisted numbers. Apply the existing number masking before the outbound request as well and keep ambiguous replies unscored.
5. **R5 · Recovery loses input.** Both V2 and V3 clear draft and transcript before recognizing evaluation_unavailable. V3 also clears a typed draft after a same-turn independent check. Preserve input on either response and make a confirmed transcript usable as text after its proof expires, with explicit provenance.
6. **R6 · Retention and duplicate verification.** Session expiration controls admission and cookie lifetime. Expired rows still contain history and the verification route can write new operation rows for an already checked session. Bound cleanup separately from the billing ledger and make repeated verification a read of existing state.
7. **R7 · Language coverage in evaluation.** The earlier synthetic probe classified an English caller-link commitment as risk and its Telugu counterpart as uncertain. The production gate is an English-only pattern. Add narrowly reviewed native-script equivalents and test negative and conditional forms. The neutral STT-context mismatch is also confirmed by configuration inspection.

## Limits and release gates

This is a local stress run on Windows with desktop Chromium, mobile viewports, fake capture and synthetic provider responses. Physical phones, native-language speech quality, live provider failure rates, cloud concurrency and public judge access need separate acceptance. The previous provider window is expired and a current Gnani balance requires provider reconciliation. V1 and V3 share the account. The durable ledger caps attempts and preserves unknown charge holds.

## Remediation

- **R1.** English is first and preselected on V2 and V3, including the V3 root redirect. V2 has a visible V3 return link and both links carry the selected language. The new browser regression exercises the round trip at 320 pixels wide.
- **R2.** A live start now checks the pause flag and ledger inside the write transaction. The database caps starts at 12 per eight-minute rolling period, including ended calls. The burst regression rejects 16 of 16 starts with a closed policy and allows exactly 12 of 16 under an open fixture policy. This global cap limits storage growth and can still be filled by an authenticated tester.
- **R3.** Dedicated V3 settings close V2 conversation, STT and TTS route admission on this build. The V2 page stays navigable so users can return to V3. Previous immutable previews have their original route wiring. Before reopening the shared ledger, restrict access to older builds or give the release candidate a dedicated admission store.
- **R4.** Caller and evaluator payloads both use the existing credential and number masking helper. Tested bare Western, Tamil, Telugu and Devanagari digits. Audio goes to the speech recognizer before a transcript can be masked. Unrecognized forms and other personal information remain outside the lexical filter.
- **R5.** Failed assessment preserves the typed reply or voice confirmation. Same-turn verification preserves a typed draft. An expired confirmation keeps the transcript and offers an explicit typed submission. Transport failures after a turn is claimed can still require waiting for the lease to expire or ending the call.
- **R6.** Live starts prune up to 50 V3 sessions that expired at least 24 hours earlier, including their turn and verification rows. An authenticated operator can run the same bounded cleanup while admission is closed. The cleanup excludes billing and reconciliation tables. Repeat verification returns the already checked state. Without traffic or operator cleanup, expired content can remain in the database. Production needs an agreed cleanup cadence and backup-retention policy.
- **R7.** The evaluator recognizes tested positive commitments to use a caller-provided channel in Hindi, Tamil and Telugu, with uncertainty retained for unmatched, quoted or negative wording. V3 speech requests now use the same neutral service-notice hints across scenarios. Native-language speech and broader phrasing coverage still need human evaluation.

The focused rerun passed all 36 tests. The three baseline probes now show zero closed-policy writes, no raw number in either model payload, and HTTP 503 on the V2 start route under V3 settings. The first focused run caught a Telugu joiner normalization mismatch, which the passing rerun covers. [Focused log](evidence/release-focused.log) · [Initial log](evidence/release-focused-initial.log) · [Probe rerun](evidence/release-after-probes.log)

The static audio check passed. V1 health returned the preserved build and zero provider requests. [Audio log](evidence/release-audio.log) · [V1 health log](evidence/release-v1.log)
