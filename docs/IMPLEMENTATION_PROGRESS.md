# V2 progress and continuation

## Current state

- **DONE · P0.1 · Lead and recovery audit.** V1 preservation checkpoint is complete. See V1_PRESERVATION.md and the external recovery directory's CHECKPOINT.json. Original main, local environment, Vercel production deployment and environment metadata were verified intact.
- **DONE · P0.2 · recovery audit.** Added scripts/check-v1.mjs and tests/v1-preservation.test.ts. Five focused tests passed. Full pnpm verify passed with 16 tests and production build, followed by audio checksums and a live V1 identity check.
- **DONE for documentation · P1.3 · voice researcher.** Current official speech, streaming, hosting and billing research completed. No V2 latency/entitlement claim has been measured.
- **BLOCKED · P1.1.** Hosted conversational LLM credentials and official Gnani balance reconciliation are pending.
- **TODO · P1.2.** A separate durable V2 budget store and admin authentication must be configured before live V2 traffic.

## Verified recovery evidence

V1 source b3462ac0a9eeb809c7e870044baa291d4c1e378e passed 11 unit/route tests, type checking, production build, all 60 audio checksums and seven isolated browser journeys. The archived source independently rebuilt. Both production and the rolled-back recovery app passed four outcomes, cards and four locale flows using static caller audio and quick replies. The protected recovery preview passed its health check. Gnani requests made by preservation work are zero.

The first parallel baseline browser run had two language-selection failures. The isolated rerun passed without source changes. Preserve that finding when evaluating browser-test stability.

## Guardrails

Worktree is feature/scamsuno-v2. Keep all edits here. Production promotion requires explicit user approval. Live V2 API testing stays disabled until a reconciled balance, protected reserve and durable admission control exist. The original root .env.local is preserved and has not been copied into this worktree.

## Next executable tasks

Define isolated V2 contracts and validate generated-dialogue/evaluator behaviour with explicit fixtures. Live provider tests depend on P1.1 and P1.2. Do not call the original V1 speech endpoints to benchmark V2.

Run pnpm install --frozen-lockfile in this worktree, then pnpm verify, pnpm test:e2e and pnpm check:audio as appropriate. Run pnpm check:v1 after every major milestone to confirm V1's recorded production identity.
