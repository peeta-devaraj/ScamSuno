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
- [x] Pure scenario controller, independent nonnumeric evaluation, explicit trusted-panel action and ended-only debrief implemented and tested. Persistence/API/UI integration remains pending.
- [x] Additive V3 persistence implemented with hashed ownership, expected-turn leases, idempotency, End-wins, masked retention and separate verification events. Thirteen focused persistence tests passed, including actual file reopen and unchanged-state recovery after evaluation failure. No remote V3 migration was run.
- [x] Scenario-aware caller/evaluator prompts reuse the V2 gateway interface; evaluator input excludes hidden assignment. Fixture text orchestration covers all three categories in all four locales with unsafe-generation fallback and cancellation checks. These are not real hosted V3 conversations.
- [ ] Persistent V3 text journeys, voice reuse and mobile UI.
- [ ] Fresh billing reconciliation, isolated private Preview, bounded real voice and phone acceptance.
- [ ] Honest pilot/demo evidence; production promotion remains unauthorized.

Recovery directory: `../scamsuno-v2-recovery-2026-11-08` beside the V2/V3 worktrees. CHECKPOINT.json records digests and successful database recovery. Retain both old worktrees and all deployments. No V3 live provider requests have been made.

Implementation checkpoint: integrated regression/typecheck/build passed; final V3-only suite passed 51 tests after the last persistence recovery change. See V3_TEST_RESULTS.md for exact run boundaries. Next executable task is V3 HTTP ownership/DTO integration followed by the shared guarded transport hooks and mobile interface. No playable V3 URL exists yet.

## Fresh official credit observation

On November 8 around 09:11 UTC, the refreshed official Gnani usage page showed 123 requests (27 STT, 96 TTS), 13.30 credits consumed and latest ledger remaining balance 4,986.70. Against the prior 109-request observation (23 STT, 86 TTS), the increase is 14 requests: four STT and ten TTS, matching recorded V2 attempt totals. This resolves aggregate counts, not individual request-price attribution or a universal price bound. No V2/V3 quota was reopened and no live V3 calls were made. The next live gate still requires an explicit bounded allowance and defensible margin.

## Decisions and risks

Public V2 session serialization includes scenario/phase/assessment data: do not extend it with V3 secrets. V3 needs a public allowlist DTO and server-only scenario registry. V2 transport guards query V2 tables; introduce tested hooks before routing V3 through those transports. Keep the existing expired/closed usage policy until official billing is refreshed. Request caps alone do not prove an exact reserve margin.
