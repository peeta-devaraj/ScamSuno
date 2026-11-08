# Repository coverage inventory

Audit target: codex/scamsuno-v3 at 9bb000bf1c8eda58f4ea74e246c66e59618c376a. V1 main b3462ac and V2 feature/scamsuno-v2 83e0d61 are separate worktrees, not audit edit targets.

## Architecture

- Next App Router, React, strict TypeScript, Zod request/state contracts.
- V1: `/`, `/play`, `/api/turn`, `/api/stt`, deterministic domain engine, static caller audio and share cards.
- V2: `/v2`, `/api/v2/*`, private `/admin/usage`; shared model/speech adapters, libSQL ledger and leases.
- V3: `/v3`, `/api/v3/*`, private `/admin/v3`; server-only scenario registry, controller, evaluator, owned persistence, public projection, readiness and pause control.
- Browser recorder: src/client/audio.ts. V3 UI: src/components/v3-call.tsx. Shared speech transport: src/server/v2/speech.ts; provider HTTP client: src/server/gnani/client.ts.
- Persistent infrastructure: src/server/v2/database.ts and ledger.ts, src/server/v3/sessions.ts/control.ts. Configuration selects the dedicated store; separate databases still use the same provider account.
- Dependency lockfile resolves Next 16.4.5, React 19.3.1, libSQL 0.18.0, Zod 4.6.7, Playwright 1.64.1. No vulnerability advisory scan performed.

## Initial inspected material

AGENTS.md; README.md; package.json; vercel.json; next.config.ts; tsconfig.json; .gitignore; playwright.config.ts; selected lockfile entries; docs/V3_ISOLATION.md; docs/V3_TEST_RESULTS.md; docs/V3_RECOVERY.md (some bulk output truncated); src/server/v3/runtime.ts, config.ts, readiness.ts, conversation.ts; app/api/v3/conversation/route.ts; V3 UI and legacy turn route inspected in preceding diagnosis; evaluation/privacy tests and retained run log.

## Documentation inventory

DECISIONS, DEMO, DEVICE_TESTS, DYNAMIC_VOICE_ARCHITECTURE, GNANI_CREDIT_TRACKING, IMPLEMENTATION_PLAN, IMPLEMENTATION_PROGRESS, LEDGER_RECOVERY, PREVIEW_ACCEPTANCE, PROGRESS, REALTIME_VOICE_RESEARCH, TEST_RESULTS, V1_PRESERVATION, V2_LEDGER_SCHEMA, V3_DEMO_PLAN, V3_DEPLOYMENT, V3_EVALUATION_RUBRIC, V3_IMPLEMENTATION_PLAN, V3_ISOLATION, V3_PROGRESS, V3_RECOVERY, V3_RUNTIME_CONTROL, V3_SCENARIO_DESIGN, V3_TEST_RESULTS (all under docs, .md). MVP.md is the older specification; headings inventoried, not fully re-audited. Original V3 attachment remains a specification source for targeted comparison.

## Test inventory

tests contains domain/routes/V1 preservation tests, V2 admin/caller/controller/conversation/config/HTTP/ledger/recovery/runtime/safety/session/share/speech/usage/proof tests, and V3 caller/config/control/controller/conversation/evaluation/HTTP/privacy/readiness/scenario/session/speech/voice HTTP tests. Browser files: call.spec.ts, v2.spec.ts, v3.spec.ts. Exact file manifest will accompany final evidence.

Commands: `pnpm verify` (typecheck + all tests + build), `pnpm test:e2e`, `pnpm check:audio`, `pnpm check:v1`. Live probe/audio generation scripts incur provider calls and must not be run as ordinary tests. Only the documented selective offline run is independently executed so far.

## Outstanding coverage

Deep races/auth/cookie/proof/dispatch checks; adversarial semantic and language cases; phone voice acceptance; deployed runtime; dependency advisories; actual provider billing reconciliation; physical accessibility and performance. Final report must distinguish uncovered areas from defects.

## Resumed coverage update

Critical modules inspected: src/server/v3/scenarios.ts, controller.ts, public-session.ts, caller.ts, evaluation.ts, privacy.ts, conversation-http.ts, sessions.ts (creation/ownership/lease portions plus executed suite), speech.ts, voice-http.ts, control.ts, control-http.ts. Shared src/server/v2/hosted.ts, speech.ts (execution, payloads, validation/timeouts), database.ts, admin-auth.ts, ledger.ts (counters/admission/dispatch/settlement references), voice-http.ts (selected ownership/proof/current-session checks). UI src/components/v3-call.tsx (recording/confirmation/navigation/error paths); src/client/audio.ts selected recording path; tests/browser/v3.spec.ts fixtures; config/gnani.json; .github/workflows/verify.yml.

The original Gnani client was inspected by targeted search to distinguish legacy and V3 runtime paths. Source inventory does not establish hidden deployment settings. No general whole-repository secret scan was done; actual ignored credential files were not opened.

80 additional critical tests executed successfully; detailed commands/results in progress and final report. Synthetic audit probes add direct contradiction/privacy/language/outage evidence. Broader browser/phone/provider/performance/advisory/recovery checks remain unexecuted. `evidence/file-manifest.txt` is the exact discovered tracked-file list for tests/docs/API/server areas, not a full coverage claim.
