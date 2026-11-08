# V3 progress

## Current checkpoint

- [x] Read the complete V3 specification and inspect both existing worktrees.
- [x] Original main and V2 worktrees were clean. V1 is `b3462ac`; V2 is `83e0d61`. No uncommitted changes were overwritten.
- [x] Created isolated `codex/scamsuno-v3` worktree from V2; frozen dependencies installed without upgrades.
- [x] Saved V2 source ZIP and complete feature-branch Git bundle; bundle verified.
- [x] Preserved local configuration and current Vercel project/deployment metadata using Windows DPAPI CurrentUser encryption; decrypt readback verified. Machine/account-bound backup limitation applies.
- [x] Snapshot all seven V2 database tables in a read transaction; restore to separate in-memory SQLite reproduced every row and schema/index definitions. No live database mutation or provider calls.
- [x] V1 health at 2026-11-08T08:59:32.110Z retained exact commit, four locales and 60 clips.
- [x] Fresh V2 baseline: type checking, 172 tests, production build, all 14 browser journeys (50.8 seconds), audio checks and protected deployed checks passed before application edits.
- [x] Three server-only scenarios and strict public DTO implemented in all four locales; assignment, privacy and deterministic fixture tests passed.
- [x] Scenario controller, independent nonnumeric evaluation, explicit trusted-panel action and ended-only localized debrief integrated with persistence, HTTP and UI.
- [x] Additive V3 persistence implemented with hashed ownership, expected-turn leases, idempotency, End-wins, masked retention and separate verification events. Thirteen focused persistence tests passed, including actual file reopen and unchanged-state recovery after evaluation failure. No remote V3 migration was run.
- [x] Scenario-aware caller/evaluator prompts reuse the V2 gateway interface; evaluator input excludes hidden assignment. Fixture text orchestration covers all three categories in all four locales with unsafe-generation fallback and cancellation checks. These are not real hosted V3 conversations.
- [x] Persistent V3 text API and signed voice routes reuse V2 model/Prisma/Timbre transports with unchanged V2 defaults and V3 atomic storage guards.
- [x] Four-language mobile UI, mode selection, independent verification during/after End, transcript correction and server-localized debrief implemented.
- [x] Scenario-specific pressure/claim tripwires, V3-only durable pause across retained deployments, private administration and ledger-based entry readiness implemented.
- [x] Latest integrated `pnpm verify`: 255 tests, type checking and production build passed. All 23 browser journeys passed; final nine V3 journeys also passed after stronger End visibility assertions. Credential scan passed 251 source/bundle files.
- [ ] Complete private deployment publication and record its exact URL.
- [ ] Live V3 provider trials, Android/iPhone acceptance and pilot/demo recording deferred at the user's request on November 8. Do not represent fixtures as real calls.
- [ ] Production promotion remains unauthorized.

Recovery directory: `../scamsuno-v2-recovery-2026-11-08` beside the V2/V3 worktrees. CHECKPOINT.json records digests and successful database recovery. Retain both old worktrees and all deployments. No V3 live provider requests have been made.

Development is complete; remaining work is deployment publication and later acceptance/demo work. No live V3 provider calls have been made. Private deployment will keep provider admission closed; a disabled screen is intentional until the later live test window.

## Fresh official credit observation

On November 8 around 09:11 UTC, the refreshed official Gnani usage page showed 123 requests (27 STT, 96 TTS), 13.30 credits consumed and latest ledger remaining balance 4,986.70. Against the prior 109-request observation (23 STT, 86 TTS), the increase is 14 requests: four STT and ten TTS, matching recorded V2 attempt totals. This resolves aggregate counts, not individual request-price attribution or a universal price bound. No V2/V3 quota was reopened and no live V3 calls were made. The next live gate still requires an explicit bounded allowance and defensible margin.

## Decisions and risks

Public V2 session serialization includes scenario/phase/assessment data: do not extend it with V3 secrets. V3 needs a public allowlist DTO and server-only scenario registry. V2 transport guards query V2 tables; introduce tested hooks before routing V3 through those transports. Keep the existing expired/closed usage policy until official billing is refreshed. Request caps alone do not prove an exact reserve margin.
