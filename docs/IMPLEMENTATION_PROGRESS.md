# V2 progress and continuation

## Current state

- **DONE · P0.1 · Lead and recovery audit.** V1 preservation checkpoint is complete. See V1_PRESERVATION.md and the external recovery directory's CHECKPOINT.json. Original main, local environment, Vercel production deployment and environment metadata were verified intact.
- **DONE · P0.2 · recovery audit.** Added scripts/check-v1.mjs and tests/v1-preservation.test.ts. Five focused tests passed. Full pnpm verify passed with 16 tests and production build, followed by audio checksums and a live V1 identity check.
- **DONE for documentation · P1.3 · voice researcher.** Current official speech, streaming, hosting and billing research completed. No V2 latency/entitlement claim has been measured.
- **PARTIALLY VERIFIED · P1.1.** Official Gnani dashboard observed at approximately 05:58 UTC: billing displayed 4,988 credits left; usage displayed 11.23 credits and 109 requests. See GNANI_CREDIT_TRACKING.md for precision limits. Hosted conversational LLM credentials remain BLOCKED. User requires free services only; Groq Free setup is prepared.
- **TODO · P1.2.** A separate durable V2 budget store and admin authentication must be configured before live V2 traffic.
- **DONE · P2.1 · Lead.** Added versioned strict contracts, a bounded four-locale controller, expected-turn conflicts, expiration, number-masked memory and evidence-linked scoring. Eight controller tests pass.
- **DONE for fixture/gateway contract · P2.2 · caller owner.** Separate contextual-caller and evaluator prompts/adapters validate structured responses, accept an injected admission-owning gateway, sanitize errors and support cancellation without retries. Eight tests pass. No live transport or credential has been connected.
- **DONE for deterministic guards · P2.3 · safety owner.** Dialogue/evidence schema, locale, phase, repetition and conservative disclosure/verification guards pass sixteen adversarial tests. Lexical guards are defense in depth; real multilingual semantic quality is unverified.
- **DONE for fixtures · P2.4 · Lead.** prepareConversationTurn integrates the components; four tests cover ta/te/en/hi multi-turn input, early rejection, provider errors, safe fallback and cancellation. This prepares state only: durable persistence, leases, live providers and a V2 UI remain TODO.

## Verified recovery evidence

V1 source b3462ac0a9eeb809c7e870044baa291d4c1e378e passed 11 unit/route tests, type checking, production build, all 60 audio checksums and seven isolated browser journeys. The archived source independently rebuilt. Both production and the rolled-back recovery app passed four outcomes, cards and four locale flows using static caller audio and quick replies. The protected recovery preview passed its health check. Gnani requests made by preservation work are zero.

The first parallel baseline browser run had two language-selection failures. The isolated rerun passed without source changes. Preserve that finding when evaluating browser-test stability.

## Guardrails

Worktree is feature/scamsuno-v2. Keep all edits here. Production promotion requires explicit user approval. Live V2 API testing stays disabled until a fresh reconciled balance, protected reserve and durable admission control exist. The original root .env.local is preserved and has not been copied into this worktree. A new ignored V2 .env.local contains a blank LLM_API_KEY, Groq defaults, disabled speech and V2_LIVE_ENABLED=false. No provider credential was copied. No purchases or paid upgrades are authorized.

## Next executable tasks

Implement a separate durable session/usage store with atomic leases, operation idempotency and quotas, then connect a fail-closed hosted gateway. Preserve prepared-turn compare-and-set semantics across cancellation and concurrent End Call. Live provider tests depend on credentials and durable admission; user is creating a free Groq key. Do not call the original V1 speech endpoints to benchmark V2.

Run pnpm install --frozen-lockfile in this worktree, then pnpm verify, pnpm test:e2e and pnpm check:audio as appropriate. Run pnpm check:v1 after every major milestone to confirm V1's recorded production identity.
