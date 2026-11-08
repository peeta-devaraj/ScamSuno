# ScamSuno V3 — independent audit

Audit date: November 8, 2026. Source: `codex/scamsuno-v3`, `9bb000bf1c8eda58f4ea74e246c66e59618c376a`. Scope: targeted, non-destructive engineering/product/security review for the user-stated November 10, 11:59 p.m. IST deadline. No application code, deployment, provider configuration or external database records were changed. No subagents were used during the resumed review.

## Executive verdict

V3 is a credible implemented prototype, with stronger ownership, persistence and conservative feedback than V1. It is **not yet demonstrated to be a reliable live multilingual voice submission**. The highest-value next work is correcting scenario consistency and privacy gaps, then completing an unmistakably V3 mobile voice rehearsal with an operational demo link. Full streaming and automatic interruption should wait.

This audit reproduced three substantive limitations: a scenario-contradicting caller sentence passes validation; a plain password paraphrase remains in the outbound model payload; and equivalent English/Telugu caller-channel trust statements produce different evidence classifications. These are synthetic offline reproductions, not claims that a live model generated the bad output or that real credentials leaked.

The strongest verified behavior is bounded conservative handling: immediate hang-up in all three scenarios earns only safe-exit feedback, while untested abilities stay untested. Selected tests also pass for owned sessions, replay/End races, speech provenance, privacy projections and quota accounting. Test count is not evidence of native-language speech quality.

Recommended disposition: retain the private preview, fix the P0 items below, and approve public release only after an observed end-to-end V3 voice rehearsal. The production V1 remains a separate fallback; this audit did not recheck its live health.

## Method and evidence boundaries

The interrupted first session left only its test log. AUDIT_PROGRESS.md, REPOSITORY_INVENTORY.md and INITIAL_FINDINGS.md were reconstructed explicitly, not represented as recovered files. Two earlier specialist attempts failed with usage-limit messages and contributed no findings. This is a fresh skeptical review of code the same assistant previously helped develop, not external human certification.

Evidence hierarchy used:

- **Executed offline:** 17 saved tests, 80 newly selected critical tests, and synthetic audit probes. No provider traffic.
- **Source inspection:** actual request handlers, controller, scenarios, model prompts, shared speech/model gateways, ledger, session ownership, administration, configuration and selected UI paths.
- **Developer-reported history:** 263 hosted build tests, 23 earlier fixture browser journeys, and selected real typed model probes described in docs/V3_TEST_RESULTS.md and docs/V3_ISOLATION.md. Not independently rerun as deployment evidence.
- **User screenshots:** show classic V1 and a transcript/fallback UI. They cannot certify V3 voice. The user's exact spoken audio is unavailable, so transcription correctness cannot be inferred.
- **Not performed:** current deployed browser acceptance, live API tests, physical microphone testing, latency benchmarks, security fuzzing of production, dependency advisory lookup, fresh provider-balance reconciliation or educational pilot.

All file references below are relative to this audit's V3 repository root. Line numbers refer to the recorded revision. Reproducers and execution logs are in docs/audit/evidence. No remaining-credit or current-window claim is made.

## Architecture and specification fit

Next App Router serves three experiences from one source tree. V1 uses deterministic scripted conversation and static caller clips. V2 supplies reusable hosted-model, speech, database, ledger and proof machinery. V3 owns random scenario assignment, its state schema, controller/evaluation, conversation HTTP layer, session tables, public projection and durable pause.

Critical path: V3 client -> same-origin owned HTTP operation -> persistent lease -> evaluator request -> caller request -> dialogue validation -> state commit -> public DTO -> TTS request -> browser playback. STT precedes this path and requires participant confirmation. This is contextual model-generated dialogue inside a small fictional scenario, with authored opening and fallback lines. It is neither fully scripted nor an unrestricted real-time voice agent.

Implemented, selectively verified offline: server-side assignment; hidden-state projection; explicit trusted-panel action; conservative nonnumeric feedback; End and voice ownership boundaries; durable request admission. Implemented but not independently live-tested: four-language caller generation, microphone/STT/TTS journey, remote persistence and private deployment operations. Partial: semantic scenario consistency, multilingual evaluation parity, privacy redaction, free-form failure recovery. Absent from the inspected V3 flow: continuous streaming, automatic speech-end detection and automatic barge-in. Manual record can stop playback through begin(); that does not amount to automatic interruption.

V3 result UI presents local replay/original-experience links, not V1's downloadable share-card workflow (src/components/v3-call.tsx:319-321). Treat V1 sharing as a separate feature; V3 sharing is optional until explicitly required for submission.

Architecture is appropriate for a small prototype. Reusing tested adapters is preferable to a rewrite. Main maintenance concerns are duplicated V2/V3 client/controller plumbing, version-prefixed configuration inherited into V3, dense server modules, and contradictory historical status prose. Database write transactions—not the process-local queue—are the concurrency boundary. V3 store selection depends on environment configuration; code alone does not prove project isolation.

## Findings and ranked roadmap

Severity describes impact; priority describes what to do before the deadline. No exploitable critical credential disclosure or ownership bypass was established.

### F05 — Generated dialogue can contradict the scenario

**High severity; P0; high confidence in the validator gap.** References: src/server/v3/scenarios.ts:30-35; src/server/v3/controller.ts:115-135.

The legitimate scenario requires an existing information-only update. Injecting the candidate “There is no service update in the app.” into attachCaller returns source=hosted and retains that caption. Its trusted panel and eventual debrief still say the update exists. See `scenario_contradiction` in audit-probes.log. This reproduces validator acceptance, not live generation frequency.

Root cause: lexical pressure/category checks do not enforce permitted facts. Impact: inconsistent evidence undermines Trust or Trap's central educational task. Correction: represent the caller's factual claims with bounded scenario-owned acts/claims and validate them before rendering; keep limited linguistic variation, and use a reviewed scenario-consistent fallback on contradiction. Do not add another unbounded model dependency merely to label safety.

Acceptance: injected negation/invention cases for every category and language are rejected or safely rendered; captions, verification and debrief agree. Estimated effort: 0.5–1.5 engineer-days; medium regression risk to conversational variety.

### F01 — V3 discovery and the demo entry route are confusing

**High demo impact; P0; high confidence.** References: README.md:5, src/components/v3-call.tsx:76,294-311; app/api/turn/route.ts:65-90; docs/V3_ISOLATION.md:7-31.

The README's primary Try link goes to canonical V1. V3's brand and original-experience links also navigate there, while Classic practice leads to V2. The supplied screenshots show V1 and its exact classifier-unavailable fallback; they are not evidence of V3 failing. The actual navigation sequence taken by the user is unknown.

Root cause: multiple generations share branding and entry points, and closed V3 offers an attractive V1 escape route. Impact: a judge or tester can miss the implemented differentiator. Correction: give the approved submission one clearly labelled V3 entry URL, persistent mode identification, and an explicit warning/label when switching generations. Keep V1 recovery separate and visible without presenting it as the V3 test.

Acceptance: a fresh phone user reaches the intended V3 build, identifies the mode, completes a call, and never unknowingly switches to V1; verify signed-out judge access separately. Estimate: 2–4 hours plus deployment approval; low implementation risk. Existing private Vercel sign-in and finite window must be resolved operationally, not silently bypassed.

### F02 — Real V3 phone voice acceptance is still unverified

**High release risk; P0 acceptance gate; high confidence about the evidence gap.** References: playwright.config.ts:7-35; tests/browser/v3.spec.ts:8-49,116-148; docs/V3_TEST_RESULTS.md:3-27.

The browser fixture intercepts conversation, STT and TTS. It returns canned recognition and audio; the browser profile is desktop Chrome at a 390×844 viewport with fake microphone capture. Those tests exercise controls/provenance, not Gnani or a physical phone. Historical V2 synthetic speech is useful integration evidence but cannot substitute for V3 phone acceptance.

Correction: conduct a bounded actual V3 Android Chrome rehearsal in Tamil and Telugu with fictional replies; record build, locale, transcript accuracy judged by the speaker, playback clarity, contextual response, End and debrief. Measure latency only from actual timestamps. Test denied microphone/network failure with local fixtures. iPhone remains explicitly unsupported/unverified until tested.

Acceptance: observed V3 voice path for both priority languages, no unexplained fallback, documented errors and usage delta. Estimate: 1–3 hours of coordinated testing plus any fixes; low test risk under bounded quota. Do not call this an implemented defect solely because evidence is missing.

### F06 — Ordinary credential paraphrases evade redaction

**High privacy impact; P0 before broader access; high confidence for the synthetic case.** References: src/server/v3/privacy.ts:8-23; src/server/v3/caller.ts:36-49; src/server/v3/sessions.ts:38-44.

“The password I use is synthetic-mango-test-only.” survives into buildCallerMessages. The audit uses only an invented value and makes no provider request. The same retention helper misses that wording, so the storage path can retain it. Detection covers specific credential/value syntax, not general paraphrases, names, addresses or obfuscation.

Correction: conservatively withhold likely credential-bearing free text before both model submission and persistence, add common paraphrase and transliteration coverage, and clearly describe residual limits. Prefer avoiding retained free text when evidence enums suffice. Preserve safe-refusal handling; do not classify redaction as compliance or failure.

Acceptance: synthetic paraphrase tests across four languages leave no value in model payloads or stored rows; refusal/quotation tests remain conservative; no raw-text logging. Estimate: 4–8 hours for bounded improvement, longer for general privacy assurance; medium risk of excessive redaction. No regex solution should be advertised as universal PII protection.

### F09 — Risk evidence has an English-only channel-trust gate

**Medium severity; P1; high confidence in unequal coverage.** References: src/server/v3/evaluation.ts:32,76-77,101-102.

With equivalent injected high-confidence evaluator outputs, “I will use the link you sent.” becomes unsafe_commitment; “నేను మీరు ఇచ్చిన లింక్‌ను ఉపయోగిస్తాను.” becomes uncertain. The latter matches first-person intent but not the English-only trustCallerChannel expression. This demonstrates unequal rule coverage, not population-level language bias or a false safe grade.

Correction: define multilingual positive/negative/conditional evidence cases for this dimension and support natural equivalents conservatively. Validate translations with native speakers. Acceptance: equivalent statements receive consistent risk or uncertainty treatment, including negation, quotation and sarcasm; no blanket guessing from low-confidence text. Estimate: 4–8 hours; medium scoring regression risk.

### F03 — Evaluator outage stalls the conversation and clears the draft

**Medium severity; P1; high confidence.** References: src/server/v3/conversation.ts:17-20; src/components/v3-call.tsx:162-168; src/server/v2/hosted.ts:149-170.

A synthetic evaluator exception produces evaluation_unavailable, unchanged turn zero and no caller invocation. The client clears draft/heard before handling that status. This is conservative about scoring, but a free-tier outage makes the caller stop responding and the participant loses the reply they could edit or retry. Two sequential model stages also add latency; no actual latency measured here.

Correction: preserve the draft/transcript on assessment failure; clearly offer retry, a reviewed unscored continuation, and End. Any retry must use explicit new operation accounting while duplicates remain non-dispatchable. Acceptance: injected evaluator failure does not erase participant input, invent a grade, loop automatically or consume unbounded requests. Estimate: 3–6 hours; medium lifecycle risk.

### F07 — The ledger protects request counts, not a continuously reconciled credit reserve

**Medium severity in private capped testing, high if advertised as public account protection; P1 before public access; high confidence.** References: src/server/v2/ledger.ts:135-137,167-199,208-262; docs/V3_ISOLATION.md:15,27-31.

Admission compares a historical verifiedCreditFloor with reserveCredits, then counts attempts and bounds audio/text size. It does not subtract a documented upper-bound credit cost. V1 and V3 still share the provider account, and V1 usage is outside this V3 ledger. Request ceilings substantially limit exposure but cannot prove the account retains 2,000 credits.

Correction: keep small reconciled windows for the demo, disclose the distinction, and verify provider tariff/account usage before deriving a worst-case allowance. Any account-wide guarantee requires accounting for V1 and other consumers. Acceptance: no unsupported remaining-credit estimate; dispatched/failed/unknown requests remain counted; expiry/concurrency checks pass; actual before/after dashboard observations recorded. Estimate: 2–4 hours for demo operations/documentation; durable account-wide integration is larger and provider-dependent. Never reset unknown holds to make a demo work.

### F04 — Lexical safety rules unnecessarily suppress natural replies

**Medium severity; P1; high confidence in restrictions, uncertain frequency.** References: src/server/v3/caller.ts:13-18; src/domain/v2/safety.ts:111-143; docs/V3_TEST_RESULTS.md:11.

The prompt must forbid ordinary “one”/“एक” and benign credential mentions because the shared validator rejects them. Historical documentation reports a Hindi article-triggered fallback. Broad restrictions can turn reasonable clarification into repetitive authored continuation; no representative fallback-rate measurement exists.

Correction: add approved safe clarification acts and carefully distinguish forbidden requests from benign mentions. Keep dangerous operational content blocked; do not broadly remove validation. Acceptance: a small adversarial multilingual matrix accepts harmless explanations and rejects requests for secrets/payments; failures explicitly identify fallback source internally without storing raw input. Estimate: 0.5–1 day; medium/high safety regression risk. Prioritize F05 before expanding generation.

### F08 — Session expiry is not a transcript retention policy

**Medium severity; P1 before wider access; medium confidence about operational deployment.** References: src/server/v3/sessions.ts:57-81,108-112; src/server/v3/public-session.ts:18-19; src/server/http.ts (withinLimit).

State/history is persisted and has an expires_at field, but targeted src/app/scripts search found no purge job. Session creation is bounded only by a process-local request limiter, not the paid-request quota; repeated starts can add database rows without a provider call. No distributed abuse test was run and an external cleanup process is not ruled out.

Correction: publish a short retention period, remove expired participant content on a controlled schedule, retain separate accounting/audit records, and add durable session-start admission if publicly exposed. Never purge billing holds with transcripts. Acceptance: an isolated cleanup test removes only expired content and preserves reconciliation, active calls and accounting. Estimate: 4–8 hours; medium data-recovery risk.

### F10 — V3 speech recognition inherits a V1-specific topic

**Low/medium severity; P1 low-cost improvement; high confidence in configuration, unmeasured recognition impact.** References: config/gnani.json:5-7; src/server/v2/speech.ts:206-211.

All V3 recognition sends keyterms OTP/UPI/PIN/KYC and a topic describing a one-time-code KYC call, including legitimate and ambiguous service notices. This is a scenario-context mismatch; it is not proof that Gnani misrecognized the user's screenshots.

Correction: use neutral V3-wide service-call context or audited mode-specific configuration without exposing the hidden category to the client. Acceptance: outbound fixture requests use appropriate neutral context; existing V1/V2 behavior is preserved; native-language samples validate any recognition change. Estimate: 1–2 hours plus bounded comparison; low regression risk if configured per mode.

## Trust or Trap and educational assessment

The three categories are genuinely separate server-side definitions, selected with crypto.randomInt; HTTP start accepts locale, not category. Public projection exposes neither hidden assignment nor stored observations before End. The verification panel deliberately provides corroborated, contradicted or inconclusive evidence; that is the learning action, not accidental answer-key leakage. It explicitly does not authenticate the inbound caller.

Immediate End yields safe exit only across all categories in the executed probe. Generic refusal does not grant secret-protection credit. This is appropriate: safe disengagement must not be penalized to manufacture difficulty. However, calibrated_response currently means a recognized question, uncertainty statement or narrow harmless acknowledgment—not a validated measure of calibrated trust. The dimensions are evidence summaries, not predictions of real-world fraud resistance.

Replay value is limited by three short variants around the same bank/update premise. The ambiguous scenario has genuinely unresolved provenance, but little substantive content beyond that uncertainty. The fraudulent fallback explicitly says the user lacks evidence, making the exercise instructional rather than highly realistic. Before expanding scenarios, make existing facts coherent and demonstrate natural priority-language exchanges. No external educational efficacy or current banking-guidance certification is provided by this audit.

## Security, privacy and credit strengths

Inspected controls include secure/HttpOnly/SameSite owner cookies; 32-byte random secrets stored as hashes; owned parameterized session queries; strict operation schemas; signed unchanged voice transcripts; no client-supplied caller text for synthesis; server-only provider keys; output/body bounds; TLS/same-origin validation; sanitized errors; and private Basic authentication with timing-safe digest comparison. Tests for selected ownership, cross-origin, fixture rejection, End-race and hidden-state cases passed.

There is no demonstrated public access to private usage data or arbitrary score write. That is not a comprehensive penetration-test conclusion. Prompt-injection resistance is partly lexical and prompt-based; semantic leakage is not proven impossible. No fresh built-bundle credential scan or current Vercel/Turso permission inspection was performed. Dependency versions were inventoried, not certified vulnerability-free.

Ledger strengths include write-transaction reservation/dispatch, idempotency, separate model/speech ceilings, per-session limits, bounded concurrent attempts, expiry, and conservative unknown-charge handling. Selected tests include real local SQLite persistence and concurrency. Remote multi-region races were not exercised. One unknown attempt can block a maxConcurrent=1 window until reconciliation; this is deliberate financial conservatism with an operational availability cost.

Recovery documentation describes encrypted environment/metadata snapshots and separate source/database restoration. Those are historical records, not a new restore test. DPAPI backup portability is limited to the same Windows user/machine. Production rollback/data recovery must not be inferred from Git tags alone.

## Voice and runtime assessment

V3 uses shared V2 speech adapters directly; the older src/server/gnani/client.ts is not its live speech path. The V3 path uses non-streaming HTTP Prisma v3 and Timbre v3, fixed server models/voice, 16 kHz WAV, maximum 15-second recordings, and bounded response decoding. It buffers complete TTS before playback. The shared runtime adapter does not perform the legacy automatic v2.5 fallback; do not attribute V1 fallback behavior to V3.

Speech requests have 15-second STT/20-second TTS deadlines; model stages have separate 8-second deadlines. These are configured limits, not measured response times. Browser capture requests echo cancellation/noise suppression, but physical device behavior remains unverified. Replay caches the current audio; generation tokens and aborts suppress stale UI updates. Server End checks suppress late audio/proof responses, as tested with fixtures.

The V3 browser client already has record/confirm/typed input and visible End. It does not continuously listen, detect utterance endings or automatically interrupt speech. Streaming would introduce new hosting, cancellation, transcript and billing work and is P2 for this deadline.

## Test execution and coverage quality

1. Saved Session 1: `pnpm exec tsx --test tests/v3-evaluation.test.ts tests/v3-privacy.test.ts` — 17 passed, zero failed, 1018.5212 ms. Evidence: docs/audit/evidence/session1-offline-tests.log.
2. Resumed run: `pnpm exec tsx --test tests/v3-controller.test.ts tests/v3-http.test.ts tests/v3-sessions.test.ts tests/v3-voice-http.test.ts tests/v2-ledger.test.ts tests/v2-ledger-recovery.test.ts` — 80 passed, zero failed, 38345.2787 ms. Evidence: session2-critical-tests.log.
3. `pnpm exec tsx docs/audit/evidence/audit-probes.cjs` — successful offline observations for scenario contradiction, synthetic secret paraphrase, three-category immediate hang-up, English/Telugu risk parity and evaluator outage. These are diagnostic observations, not an additional test-count claim. An initial audit-script syntax error was corrected; its log is retained and is not an application failure.

Environment: Windows PowerShell, Node 24.12.0, pnpm 11.25.0. No full verify/build/e2e rerun, no new audio release-gate run. This conserves review time and avoids representing historical checks as new results. Unit/route tests meaningfully cover state boundaries, but fixture-controlled browser results cannot establish real provider compatibility. CI runs verify and static audio checking; inspected workflow does not run Playwright. Missing critical coverage is semantic contradiction, realistic multilingual evidence paraphrases, provider-outage UX and actual phone acceptance.

## Conservative ratings

These are reviewer judgments, not calibrated benchmarks. Confidence is high for source-backed architecture/control behavior, medium for product interpretation, and low for untested real voice/mobile quality.

- Concept originality: **7/10** — useful mixed-trust training; impact unvalidated.
- Technical sophistication: **7/10** — owned state, durable accounting and separate model roles; no streaming.
- Software architecture: **7/10** — sensible reuse and boundaries, some version coupling.
- Code quality: **6/10** — strict contracts and tests; dense modules and lexical complexity.
- Voice AI quality: **4/10, low confidence** — runtime exists, real V3 phone evidence missing.
- Conversational intelligence: **5/10** — contextual model path, restrictive guards and fallback dependency.
- Multilingual support: **5/10** — four locales implemented, unequal evidence coverage and unverified fluency.
- Scenario quality: **5/10** — coherent authored concepts, narrow variety and validator contradiction gap.
- Trust or Trap effectiveness: **5/10** — independent checking is real in the simulator; learning effect unmeasured.
- Scoring accuracy/fairness: **6/10** — safe abstention and category independence, limited semantic coverage.
- Educational usefulness: **6/10** — sound boundaries, no demonstrated transfer to real situations.
- Security/privacy: **6/10** — strong ownership controls; redaction/retention gaps.
- API credit protection: **6/10** — durable request caps; no account-wide monetary guarantee.
- UI/UX: **5/10** — implemented mobile layout, mode confusion and failure friction.
- Mobile readiness: **4/10, low confidence** — viewport fixture coverage is not device acceptance.
- Reliability: **5/10** — state/control tests pass; live provider and human journey remain uncertain.
- Portfolio impact: **7/10** — defensible engineering if limitations and evidence are explained honestly.
- Hackathon competitiveness: **5/10, low confidence** — promising differentiation, weak observed demo evidence.
- Demo readiness: **3/10** — private/windowed entry and no accepted V3 phone rehearsal.
- Overall implementation quality: **6/10** — substantial prototype with specific correctable gaps.

Concept potential: **8/10**. Current implementation quality: **6/10**. Competition readiness: **3/10**. These are separate judgments; no contest rubric or competitor field was independently verified.

## Deadline plan and demonstration

P0: F01 clear V3 entry, F05 scenario consistency, F06 credential paraphrase protection, and F02 actual phone rehearsal. These are release gates, not permission to deploy. Estimates are engineer effort, not delivery guarantees; if time is constrained, reduce generated factual freedom and use explicitly labelled authored fallback rather than claim fully adaptive reliability.

P1, ordered by value/cost: F10 neutral STT context; F03 preserve input on outage; F09 language parity; F07 reconciled demo accounting; F08 retention/start controls before broad public exposure; F04 carefully expand benign dialogue acceptance. Update stale README/status prose with one current release status.

P2: streaming/automatic interruption, more scenarios, V3 sharing, broad browser/device coverage and educational pilot. Avoid a platform rewrite before the deadline.

Recommended demo: confirm exact V3 URL/build and authorized access; check a fresh bounded allowance; one short Tamil or Telugu conversation with an original clarification, simulated independent check, End and honest debrief. Explain that checking the notice is not identity authentication. Capture actual audio and disclose any cuts/fallbacks. Keep the preserved V1 available as a clearly labelled fallback. A voice exchange typically needs opening TTS, STT and response TTS plus evaluator/caller model requests; this is request arithmetic, not a credit-price estimate. Allow for retries only within explicit caps.

## Remaining verification and audit status

The requested five-area targeted audit and actionable report are complete within the evidence available. Production readiness remains unverified. Outstanding work: physical Tamil/Telugu V3 acceptance, current deployed access/configuration, live budget reconciliation, V3 recovery rehearsal after changes, broader semantic/privacy cases and any external retention mechanism. No browser access denial occurred in this resumed audit because deployed browser testing was not attempted. Historical dashboard access restrictions are not asserted as current.

Use docs/audit/REMEDIATION_BACKLOG.md for implementation. Preserve this report as pre-remediation evidence and rerun only affected tests plus required release gates after changes.
