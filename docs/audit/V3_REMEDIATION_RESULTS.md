# V3 P0 remediation results — November 8, 2026

Branch: `codex/scamsuno-v3-p0`, separate `scamsuno-v3-remediation` worktree. Source baseline: `e23a3a5` (application 9bb000b plus preserved audit). Recovery tag: `v3-pre-p0-2026-11-08`; complete bundle: sibling `scamsuno-v3-recovery-2026-11-08/pre-p0.bundle`. Earlier source/environment/database recovery artifacts and V1/V2 worktrees are preserved. The tag/bundle is additional source preservation, not a new production/database backup.

## Private candidate

**[Open the remediated private V3 Preview](https://scamsuno-v3-gy6v04bmg-peetadevaraj-2614s-projects.vercel.app/v3?l=ta)**. Application commit: `7fbf6f6`; deployment: `dpl_HkW2XC38QdT4YCwKM5dKS54V4MBM`, target Preview, observed Ready. All required local checks passed. This is the P0 candidate; do not substitute historical URLs. Canonical V1 remains https://scamsuno.vercel.app and is explicitly labelled as the scripted fallback.

Authenticated deployed checks at `2026-11-08T15:57:27.373Z`: root returned 307 to `/v3?l=te`; V3 page returned 200 with generation/fallback labels; malformed conversation input returned 400 before inference. Evidence: evidence/p0-preview.json. V1 remained at its exact preserved commit after publication at `2026-11-08T15:57:28.226Z`, with 60 caller clips/four locales and zero provider calls (p0-v1-after-preview.log). These are HTTP checks, not physical-browser or phone acceptance. Production V3 remains the static bootstrap; no production promotion occurred.

Live provider testing is **closed**. A read-only ledger observation at `2026-11-08T15:53:11.270Z` found admission false, six of six speech attempts and 24 of 24 model attempts consumed, zero active operations, and policy expiry `2026-11-08T13:42:50.703Z`. The current provider balance is **unknown**; no fresh Gnani dashboard reconciliation occurred. No policy was reset or extended and no provider call was made during remediation. Evidence: evidence/p0-budget.json.

## Findings

- **F05 — fixed with bounded caller response selection.** `src/server/v3/approved-dialogue.ts` owns reviewed responses per scenario/locale; `caller.ts` asks the model to select an exact response; `controller.ts` rejects all unreviewed generated wording before captions/synthesis. The original contradiction probe now returns authored_fallback. New `tests/v3-facts.test.ts` checks contradictions, negations, invented evidence, other-category continuations, added suffixes and malformed envelopes across all three categories/four languages. Approved responses retain their actual hosted/fixture origin. Scenario facts and debrief are server-owned. Tradeoff: users can reply freely, but the caller selects bounded reviewed wording; this is not unrestricted generated dialogue. No streaming or new scenarios were added.
- **F06 — fixed for bounded multilingual credential-reference coverage.** `privacy.ts` withholds credential-bearing utterances by default after normalization; only whole, value-free reviewed refusals/questions pass unchanged. `tests/v3-privacy.test.ts` exercises multilingual/transliterated synthetic paraphrases, value tails, payloads and actual SQLite storage. The audit paraphrase now reports syntheticValueSentToModel=false. Withheld discussion remains uncertain/unscored, never automatic compliance. Unknown vocabulary/obfuscation and noncredential PII remain limitations; unsupported benign credential discussion may also be withheld. No actual credentials were used in tests.
- **F01 — code/navigation fixed; human entry acceptance pending.** `app/page.tsx` redirects to `/v3` only with explicit V3 flag, preserving valid locales. V3 branding stays on `/v3`; `v3-call.tsx`/`ui-copy.ts` label V3, V2 and V1 scripted fallback. README makes this candidate record the primary entry reference. `tests/v3-entry.test.ts` covers flag-on/flag-off and locale behavior; browser tests cover mode labels and brand destination. The V1/V2 deployments are not changed by these code edits.
- **F02 — prepared, not performed.** `V3_DEVICE_ACCEPTANCE.md` provides exact Android Chrome Tamil/Telugu steps and an outcome form. `V3_RELEASE_CHECKLIST.md` provides demo/deployment/promotion/rollback gates. Actual human microphone, native-language recognition/clarity and public judge access remain unverified. Phone testing needs a freshly reconciled bounded provider window first.

## Executed verification

- `pnpm verify`: typecheck, **269 tests passed / zero failed**, production build succeeded. Unit-test runner duration 78415.9283 ms; not a voice-latency measurement. Evidence: evidence/p0-verify.log.
- `pnpm exec tsx --test tests/v3-facts.test.ts tests/v3-privacy.test.ts tests/v3-entry.test.ts`: **10 passed / zero failed**, 1201.0393 ms. Evidence: evidence/p0-regressions.log.
- `pnpm check:audio`: passed static manifest/caption/checksum gate. Evidence: evidence/p0-audio.log. This does not verify runtime Timbre speech.
- `pnpm check:v1`: passed exact preserved production build/locale/audio-health checks, zero Gnani calls. Evidence: evidence/p0-v1.log.
- `pnpm exec tsx docs/audit/evidence/audit-probes.cjs`: original F05/F06 probes now safely fall back/withhold. Evidence: evidence/p0-audit-probes.log. Old audit output is preserved unchanged. The P1 English/Telugu channel-trust mismatch and evaluator-outage observations remain outside this P0 scope.
- `pnpm test:e2e`: **24 browser journeys passed**, 56.3 seconds. Evidence: evidence/p0-e2e.log. It uses explicit fixtures, not provider/physical-device evidence.

Initial focused tests exposed old expectations that arbitrary generated factual text would pass. Regressions were corrected to enforce reviewed responses; no old audit evidence was deleted. Environment: Node 24.12.0, pnpm 11.25.0, Windows; Chrome desktop executable with mobile viewports and fake capture for browser testing.

## Exact remaining human/external gates

1. Fresh nonsecret Gnani usage/balance observation is needed to open a new bounded voice window. Local request counts do not establish remaining credits; shared V1 consumption remains outside this ledger. Never paste keys into chat.
2. Participant signs into Vercel on Android Chrome and performs one actual Tamil and one actual Telugu exchange using V3_DEVICE_ACCEPTANCE.md after the operator opens the reconciled window. Report original recognition, audible speech, contextual response, errors, End and debrief. No phone success is claimed here.
3. Public application promotion requires explicit user approval after acceptance evidence and recovery preflight. This work authorizes only the private preview. Public V3 setup page and V1 production remain unchanged.

P1 findings F03/F04/F07/F08/F09/F10 remain tracked in REMEDIATION_BACKLOG.md; no new feature development was started. Request caps/unknown-charge/concurrency tests remain passing. See the release checklist for the exact demo sequence and promotion/rollback conditions.
