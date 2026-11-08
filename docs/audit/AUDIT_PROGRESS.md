# Independent audit progress

Revision: `9bb000bf1c8eda58f4ea74e246c66e59618c376a`, branch `codex/scamsuno-v3`. Audit date: November 8, 2026. Application code and deployments must remain unchanged.

## Recovery of interrupted Session 1

The three requested Markdown checkpoint files were absent. `evidence/session1-offline-tests.log` survived and records 17 passed, zero failed, duration 1018.5212 ms. Command: `pnpm exec tsx --test tests/v3-evaluation.test.ts tests/v3-privacy.test.ts`. Node v24.12.0, pnpm 11.25.0, Windows PowerShell. Tests used synthetic inputs and local in-memory SQLite, not provider calls. Preserve this log; do not rerun solely to reproduce its count.

Two attempted specialists hit tool-reported model usage limits and supplied no findings. No specialist review is credited. Continuation uses one agent only. Remaining allowance is unknown.

## Completed initial inspection

Repository/worktree revision, package scripts, lockfile versions, Next/security headers, TypeScript strict configuration, Vercel build configuration, Playwright configuration, README, V3 test/isolation documentation and V1/V2 recovery documentation inspected. Documentation inventory discovered 24 files under docs. Prior historical build/browser/live results remain developer-reported, not independently reproduced here. Broad command output was occasionally truncated; undisplayed sections are not claimed inspected.

V3 critical path mapped: UI -> conversation HTTP -> owned session/lease -> evaluator -> caller -> controller validation -> persistent state -> public projection. Voice uses V2 provider transports with V3 session hooks. Budget readiness is advisory; dispatch admission must be checked independently.

## Active continuation

1. Hidden truth, scenario invariants, evidence fairness.
2. Voice/provider execution and fixtures versus physical evidence.
3. Session/auth/privacy/hidden-state boundaries.
4. Durable accounting and shared-credit limits.
5. Demo navigation and operational readiness.

Save findings after each area; produce final report and implementation-ready backlog. No application fixes, deployments, external database writes, or live provider calls are authorized by this audit.

## Resume

Worktree: `C:\Users\peeta\.codex\visualizations\2026\11\06\01a1b12a-e778-7371-9a75-15adbb3d38fd\scamsuno-v3`.
Run `git status --short`, `git rev-parse HEAD`, then read this file, INITIAL_FINDINGS.md and REPOSITORY_INVENTORY.md. Diff any revision changes before reusing findings. Do not assume the old test window or credit balance is current.

## Final targeted-audit checkpoint

The resumed five-area audit is complete within stated access/evidence limits. Final report: `SCAMSUNO_V3_INDEPENDENT_AUDIT.md`. Implementation tasks: `docs/audit/REMEDIATION_BACKLOG.md`. The next step is remediation when requested, not repeating the audit. No application changes or production approval are included.

Additional inspected paths: V3 scenarios/controller/public projection/caller/evaluation/privacy/conversation HTTP/session ownership/control/control HTTP/speech selection; shared V2 hosted provider gateway, speech execution, database transactions, ledger admission/dispatch, admin auth and selected voice HTTP boundaries; V3 browser fixtures and client recording/error/navigation paths; Gnani nonsecret configuration; GitHub CI. Some bulk reads truncated; only displayed portions are credited. See file-manifest.txt for discovered files, not proof every file was read.

New execution: `pnpm exec tsx --test tests/v3-controller.test.ts tests/v3-http.test.ts tests/v3-sessions.test.ts tests/v3-voice-http.test.ts tests/v2-ledger.test.ts tests/v2-ledger-recovery.test.ts` -> 80 pass, 0 fail, 38345.2787 ms. Existing 17-pass log preserved. New probe: `pnpm exec tsx docs/audit/evidence/audit-probes.cjs` -> scenario contradiction acceptance, synthetic credential paraphrase forwarding, English/Telugu evidence mismatch and evaluator outage reproduced. Immediate hang-up correctly leaves all but exit untested. Initial probe syntax failure corrected; no app fault inferred.

Verified priorities: F05 scenario consistency and F06 privacy; F01 demo navigation; F02 actual V3 phone acceptance. Additional F03 outage UX, F04 lexical overrestriction, F07 reserve scope, F08 retention/start limits, F09 language parity, F10 STT topic mismatch. See final report for severity, exact references, reproduction, confidence and proposed correction.

Unresolved: no current deployed UI/authorization/config inspection, no fresh dashboard balance, no live API/physical microphone test, no latency measurement, no educational pilot, no vulnerability advisory scan, no fresh recovery exercise. External database cleanup is not ruled out. Historical provider/build claims remain separately attributed. No blockers require new credentials to read this report; future live acceptance needs an authorized bounded window and the participant's phone.

Coverage goal deliberately narrowed per the user's resume instruction. Full production certification is not claimed. No specialist output used. Application tracked files must remain unchanged; only audit documents/evidence should appear in git status.

## Subsequent authorized P0 remediation checkpoint

The preceding audit-only constraints applied to the audit phase. The user subsequently authorized P0 implementation on an isolated branch. Worktree `scamsuno-v3-remediation`, branch `codex/scamsuno-v3-p0`, preserves pre-P0 e23a3a5 through tag `v3-pre-p0-2026-11-08` and verified complete `pre-p0.bundle` beside existing recovery artifacts. V1 b3462ac and V2 83e0d61 remain in their own worktrees.

Implemented/tested F01/F05/F06; F02 checklist prepared, real-phone test pending. Required verification passed: typecheck, 269 unit/route tests and build; 24 browser fixtures; audio gate; V1 health gate before/after private publication; 10 focused P0 regressions. Read V3_REMEDIATION_RESULTS.md for exact commands/evidence/limitations and current URL. Application commit 7fbf6f6; new private Preview dpl_HkW2XC38QdT4YCwKM5dKS54V4MBM. No production promotion, provider calls or ledger policy resets.

Fresh ledger read confirms old caps fully spent (6 speech/24 model), zero active, expired. Provider balance remains unknown without fresh provider observation. Next action: reconcile provider data, open a small bounded window without erasing spending holds, then participant performs documented Android Tamil/Telugu tests. No further code work or broader feature scope is implied. Preserve original audit evidence as historical; new p0-* evidence records remediation.
