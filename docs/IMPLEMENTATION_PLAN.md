# V2 implementation plan

The V1 preservation checkpoint is complete. V2 work is isolated from the production branch. Tamil and Telugu are priority languages, with English and Hindi included in every shared interface.

## Dependency order

P0.1 preservation → P0.2 production monitor → P1.1 provider/budget access → P2.1 contracts → P2.2 caller + P2.3 validator/evaluator → P2.4 text integration → P3.1 guarded live speech → P3.2 complete voice flow → P4.1 durable ledger → P4.2 dashboard → P5.1 responsiveness → P6.1 mobile acceptance → P7.1 approved production promotion.

Durable request accounting and conservative quotas must precede any live V2 testing. Unrestricted public speech remains gated on verified reserve protection.

## Numbered tasks

1. **P0.1 · P0 · Lead + recovery audit · DONE · low risk.** Preserve exact V1 source, environment/config snapshots, source release and rollback evidence. Acceptance is recorded in V1_PRESERVATION.md.
2. **P0.2 · P0 · recovery audit · DONE · low risk.** Added a zero-credit V1 monitor for every milestone. It rejects a changed production commit, unavailable health, disabled speech, missing locales and missing caller assets. Five focused tests and the live check passed.
3. **P1.1 · P0 · Lead · BLOCKED on free hosted LLM credential · high risk.** Official dashboard reconciliation is recorded in GNANI_CREDIT_TRACKING.md; refresh it before live testing. User requires free services only. Groq Free setup is prepared; no purchases or paid upgrades. Verify account access/model limits before testing.
4. **P1.2 · P0 · Lead · DONE for isolated store · high risk.** Approved $0 Starter store provisioned in Mumbai and connected only to the new V2 project's Preview/Development. Remote concurrency/readback passed; all dispatch remains disabled. Deployment authentication/configuration acceptance is pending.
5. **P1.3 · P0 · voice researcher · DONE for documentation · medium risk.** Verify current streaming/billing documentation and select REST as the first dynamic path. Live latency and entitlement measurements remain pending.
6. **P2.1 · P0 · conversation owner · DONE · medium risk.** Versioned contracts/controller, bounded memory, invalid/stale session rejection and masking pass eight tests. Server-owned persistence is a later dependency.
7. **P2.2 · P0 · conversation owner · DONE for injected gateway · high risk.** Contextual caller/evaluator adapters, independent prompts, cancellation and invalid-schema/error handling pass eight tests. Live transport/access is still blocked.
8. **P2.3 · P0 · safety owner · DONE for deterministic guards · high risk.** Dialogue validation and independent evidence checking pass sixteen tests for credential/payment/link content, quotation, refusal, conditional compliance, verification negation and uncertainty. Live/native-language validation remains required.
9. **P2.4 · P0 · Lead · DONE for explicit fixtures · high risk.** Four integration tests exercise bounded multi-turn ta/te/en/hi text, termination, provider failure/fallback and cancellation. No live dynamic-conversation claim; durable session integration and UI are pending.
10. **P3.1 · P0 · budget owner · DONE for hosted LLM · high risk.** Atomic quota plus active-lease checks, persistent operation IDs and conservative timeout accounting pass twenty-two ledger and thirteen gateway tests. Add the same guard to speech paths next.
11. **P3.2 · P0 · voice owner · TODO · high risk.** Connect live Prisma → caller → validator → Timbre under durable quota admission. Verify genuine multi-turn responses in Tamil and Telugu first.
12. **P3.3 · P0 · frontend owner · TODO · medium risk.** Connect actual operation states to speaking/listening/captions, immediate hangup, transcript correction and failure recovery. Test stale audio cancellation.
13. **P4.1 · P0 · budget owner · DONE for quota accounting · high risk.** Reconciliation snapshots, reserve admission threshold, kill switch and session caps pass local and remote tests. Exact credit reserve guarantees require verified billing bounds; current Gnani admission is zero. Operator recovery for unknown charges remains TODO.
14. **P4.2 · P0 · budget owner · DONE for HTTP implementation · high risk.** Authenticated /admin/usage and pausing pass nine auth/route tests; unknown costs remain labelled. Hosted/mobile dashboard acceptance is pending.
15. **P5.1 · P1 · voice owner · TODO · medium risk.** Trial Timbre SSE after the REST flow is stable. Measure first-audio and complete-turn timing on the same scripted conditions.
16. **P5.2 · P1 · voice owner · TODO · high risk.** Trial STT streaming/VAD and reconnection only after P5.1. Streaming and barge-in claims require real observed evidence.
17. **P6.1 · P0 · QA owner · TODO · high risk.** Run deployed preview voice, safety, scoring, credit-concurrency and failure tests. Complete Android Chrome and iOS Safari acceptance with device/network details.
18. **P7.1 · P0 · Lead · BLOCKED on acceptance and explicit approval · high risk.** Audit the V1 rollback position, record the approved V2 deployment, and promote only after user approval. Recheck V1 and reserve safeguards first.
19. **P7.2 · P0 · Lead · TODO · medium risk.** Record an accurate live demo, update README/model credits and prepare submission evidence from observed runs.

## Existing application audit

Verified V1 includes four languages, Prisma REST, pre-generated Timbre, a deterministic scenario graph, conservative scoring, transcript confirmation, quick replies and share cards. Free-form classification is implemented but lacks a configured hosted credential. Dynamic dialogue, runtime TTS, durable budget accounting and an authenticated usage dashboard are missing. Browser sessions are bounded but self-reported and held in memory.

Do not implement generation inside the V1 production route until the isolated replacement passes its acceptance checks. The V2 specification authorizes bounded generation in V2 and supersedes the original scripted-dialogue restriction for that isolated path.
