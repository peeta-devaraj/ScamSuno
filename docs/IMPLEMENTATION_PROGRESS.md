# V2 progress and continuation

## Current state

- **DONE · P0.1 · Lead and recovery audit.** V1 preservation checkpoint is complete. See V1_PRESERVATION.md and the external recovery directory's CHECKPOINT.json. Original main, local environment, Vercel production deployment and environment metadata were verified intact.
- **DONE · P0.2 · recovery audit.** Added scripts/check-v1.mjs and tests/v1-preservation.test.ts. Five focused tests passed. Full pnpm verify passed with 16 tests and production build, followed by audio checksums and a live V1 identity check.
- **DONE for documentation · P1.3 · voice researcher.** Current official speech, streaming, hosting and billing research completed. No V2 latency/entitlement claim has been measured.
- **PARTIALLY VERIFIED · P1.1.** Official Gnani dashboard observed at approximately 05:58 UTC: billing displayed 4,988 credits left; usage displayed 11.23 credits and 109 requests. See GNANI_CREDIT_TRACKING.md for precision limits. Hosted conversational LLM credentials remain BLOCKED. User requires free services only; Groq Free setup is prepared.
- **DONE for store setup · P1.2.** User approved the exact $0 Turso Starter plan and completed browser terms acceptance. Provisioned scamsuno-v2-ledger in bom1, connected only to scamsuno-v2-preview Preview/Development. Remote atomic claims, concurrent quota admission, release and readback passed at 11:44:45 UTC with zero provider dispatches. Final policy is disabled, kill switch on, Gnani/LLM allowances zero. Admin credentials generated in an ignored development file; deployed credentials still pending.
- **DONE · P2.1 · Lead.** Added versioned strict contracts, a bounded four-locale controller, expected-turn conflicts, expiration, number-masked memory and evidence-linked scoring. Eight controller tests pass.
- **DONE for fixture/gateway contract · P2.2 · caller owner.** Separate contextual-caller and evaluator prompts/adapters validate structured responses, accept an injected admission-owning gateway, sanitize errors and support cancellation without retries. Eight tests pass. No live transport or credential has been connected.
- **DONE for deterministic guards · P2.3 · safety owner.** Dialogue/evidence schema, locale, phase, repetition and conservative disclosure/verification guards pass sixteen adversarial tests. Lexical guards are defense in depth; real multilingual semantic quality is unverified.
- **DONE for fixtures · P2.4 · Lead.** Multi-turn preparation is now integrated with durable server-owned sessions and the HTTP API. Tests cover four locales, replay, secret ownership, masking, stale operations and cancellation. No live conversation or V2 UI claim.
- **DONE for LLM dispatch · P3.1.** Hosted gateway uses ledger admission and a current session lease in the same write transaction before dispatch. Twenty-two ledger and thirteen gateway tests cover concurrency, persistent idempotency, policy expiry, unknown charges and End races. Speech adapters remain TODO.
- **DONE for local/remote ledger · P4.1.** Additive v2_ tables and closed-by-default quota policy passed real SQLite and remote Turso checks. Numeric per-request credits remain unknown; request quotas do not prove an exact reserve. Unknown charge recovery remains an explicit future operator task.
- **DONE for HTTP/module acceptance · P4.2.** /admin/usage authenticates on the server, shows truthful snapshots/counters/unknown costs, and supports same-origin pausing. Six auth and three usage-route tests pass. No deployed dashboard acceptance yet.

## Verified recovery evidence

V1 source b3462ac0a9eeb809c7e870044baa291d4c1e378e passed 11 unit/route tests, type checking, production build, all 60 audio checksums and seven isolated browser journeys. The archived source independently rebuilt. Both production and the rolled-back recovery app passed four outcomes, cards and four locale flows using static caller audio and quick replies. The protected recovery preview passed its health check. Gnani requests made by preservation work are zero.

The first parallel baseline browser run had two language-selection failures. The isolated rerun passed without source changes. Preserve that finding when evaluating browser-test stability.

## Guardrails

Worktree is feature/scamsuno-v2. Keep all edits here. Production promotion requires explicit user approval. Live V2 API testing stays disabled until a fresh reconciled balance, protected reserve and durable admission control exist. The original root .env.local is preserved and has not been copied into this worktree. A new ignored V2 .env.local contains a blank LLM_API_KEY, Groq defaults, disabled speech and V2_LIVE_ENABLED=false. No provider credential was copied. No purchases or paid upgrades are authorized.

## Next executable tasks

Connect the free Groq credential once the user saves it, run a bounded real text probe against the isolated store, then implement quota-guarded Prisma/Timbre adapters and the V2 UI. The hosted model, voice, public preview and physical devices remain unverified. Do not use original V1 endpoints for V2 benchmarks.

## Latest checkpoint

Full pnpm verify passed **110 tests**, type checking and build. check:audio passed all 60 assets; public V1 identity was unchanged at 11:40:20 UTC. Earlier sandbox build failed only because Next could not create a Windows dependency junction; the permitted build and final full verification passed. Seven existing fixture browser journeys passed with installed Chrome. Review caught and fixed post-hangup extra dispatch, End blocked by disabled mode/rate limits, stale dispatch-time policy checks, and permanently cached DB initialization failures. No V2 live provider calls or production promotion have occurred.

Run pnpm install --frozen-lockfile in this worktree, then pnpm verify, pnpm test:e2e and pnpm check:audio as appropriate. Run pnpm check:v1 after every major milestone to confirm V1's recorded production identity.
