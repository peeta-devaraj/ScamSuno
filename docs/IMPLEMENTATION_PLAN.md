# V2 implementation plan

The V1 preservation checkpoint is complete. V2 work is isolated from the production branch. Tamil and Telugu are priority languages, with English and Hindi included in every shared interface.

## Dependency order

P0.1 preservation → P0.2 production monitor → P1.1 provider/budget access → P2.1 contracts → P2.2 caller + P2.3 validator/evaluator → P2.4 text integration → P3.1 guarded live speech → P3.2 complete voice flow → P4.1 durable ledger → P4.2 dashboard → P5.1 responsiveness → P6.1 mobile acceptance → P7.1 approved production promotion.

Durable request accounting and conservative quotas must precede any live V2 testing. Unrestricted public speech remains gated on verified reserve protection.

## Numbered tasks

1. **P0.1 · P0 · Lead + recovery audit · DONE · low risk.** Preserve exact V1 source, environment/config snapshots, source release and rollback evidence. Acceptance is recorded in V1_PRESERVATION.md.
2. **P0.2 · P0 · recovery audit · DONE · low risk.** Added a zero-credit V1 monitor for every milestone. It rejects a changed production commit, unavailable health, disabled speech, missing locales and missing caller assets. Five focused tests and the live check passed.
3. **P1.1 · P0 · Lead · BLOCKED · high risk.** Obtain a working conversational LLM credential and reconcile the official Gnani balance. Record the observation time and reserve. No estimated balance is treated as measured.
4. **P1.2 · P0 · Lead · TODO · high risk.** Provision an independent durable V2 ledger store and admin authentication. Dependencies are account access and P1.1. Acceptance requires a non-production namespace and recoverable credentials.
5. **P1.3 · P0 · voice researcher · DONE for documentation · medium risk.** Verify current streaming/billing documentation and select REST as the first dynamic path. Live latency and entitlement measurements remain pending.
6. **P2.1 · P0 · conversation owner · TODO · medium risk.** Define versioned conversation input/output and bounded memory schemas. Test invalid/stale session rejection and masking.
7. **P2.2 · P0 · conversation owner · TODO · high risk.** Add a hosted contextual caller adapter that returns structured dialogue without tools or external actions. Test history handling, timeout and invalid schema responses.
8. **P2.3 · P0 · safety owner · TODO · high risk.** Validate generated dialogue before synthesis and evaluate participant decisions independently. Test genuine-code requests, payment instructions, links, unsafe content, quotations, refusals and uncertainty.
9. **P2.4 · P0 · Lead · TODO · high risk.** Integrate a bounded multi-turn text conversation. Depends on P2.1–P2.3. Verify coherent replies, safe termination and evidence-based feedback.
10. **P3.1 · P0 · budget owner · TODO · high risk.** Reserve request quota atomically before every provider attempt and record idempotent operation IDs. Test concurrent admission and conservative handling of timeout/cancellation.
11. **P3.2 · P0 · voice owner · TODO · high risk.** Connect live Prisma → caller → validator → Timbre under durable quota admission. Verify genuine multi-turn responses in Tamil and Telugu first.
12. **P3.3 · P0 · frontend owner · TODO · medium risk.** Connect actual operation states to speaking/listening/captions, immediate hangup, transcript correction and failure recovery. Test stale audio cancellation.
13. **P4.1 · P0 · budget owner · TODO · high risk.** Add reconciliation, reserve thresholds, kill switch and session caps. Verify no concurrent path crosses the protected reserve or double-counts retries.
14. **P4.2 · P0 · budget owner · TODO · high risk.** Build authenticated /admin/usage from ledger data. Show actual credits only when reconciled, with estimated/request-count measures labelled separately.
15. **P5.1 · P1 · voice owner · TODO · medium risk.** Trial Timbre SSE after the REST flow is stable. Measure first-audio and complete-turn timing on the same scripted conditions.
16. **P5.2 · P1 · voice owner · TODO · high risk.** Trial STT streaming/VAD and reconnection only after P5.1. Streaming and barge-in claims require real observed evidence.
17. **P6.1 · P0 · QA owner · TODO · high risk.** Run deployed preview voice, safety, scoring, credit-concurrency and failure tests. Complete Android Chrome and iOS Safari acceptance with device/network details.
18. **P7.1 · P0 · Lead · BLOCKED on acceptance and explicit approval · high risk.** Audit the V1 rollback position, record the approved V2 deployment, and promote only after user approval. Recheck V1 and reserve safeguards first.
19. **P7.2 · P0 · Lead · TODO · medium risk.** Record an accurate live demo, update README/model credits and prepare submission evidence from observed runs.

## Existing application audit

Verified V1 includes four languages, Prisma REST, pre-generated Timbre, a deterministic scenario graph, conservative scoring, transcript confirmation, quick replies and share cards. Free-form classification is implemented but lacks a configured hosted credential. Dynamic dialogue, runtime TTS, durable budget accounting and an authenticated usage dashboard are missing. Browser sessions are bounded but self-reported and held in memory.

Do not implement generation inside the V1 production route until the isolated replacement passes its acceptance checks. The V2 specification authorizes bounded generation in V2 and supersedes the original scripted-dialogue restriction for that isolated path.
