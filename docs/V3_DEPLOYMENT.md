# V3 private deployment and operation

Use Node 24 and the frozen pnpm lockfile. V3 code is on `codex/scamsuno-v3`. Do not merge or promote to production without explicit user approval.

## Isolated Preview

Published application commit: `9da08bbed0490944a997124d6f89493a8a65b96e`.

Private URL: https://scamsuno-v2-preview-ndzi4m344-peetadevaraj-2614s-projects.vercel.app/v3

Deployment: `dpl_9beoLjFqAiVxGbrNr59pxHYso5sk`, environment Preview, READY, Vercel authentication enabled. Hosted build passed 255 tests and compiled successfully at 10:42 UTC on November 8. This records publication, not live-voice acceptance.

Use a new immutable Preview deployment in the existing isolated `scamsuno-v2-preview` project (`prj_aOSnJ1cGJfTcgKRkYWdq5howq9Wm`). This reuses already-authorized encrypted Preview credentials and the $0 Starter database without changing project environment variables or either retained V2/V1 deployment. V3 uses only additive `v3_` tables plus the existing shared usage ledger. Its deployment URL is separate from V2's verified URL; the canonical project alias remains the approved static placeholder.

The V3 publication sets `V3_TRUST_OR_TRAP_ENABLED=true` as a deployment-only override for mode discovery. `V2_LIVE_ENABLED=false` and the killed quota-zero ledger keep provider calls closed. `/v3` intentionally shows unavailable until an approved bounded test window is configured. Production settings and aliases remain unchanged.

## Later live test window

1. Refresh official Gnani usage and record actual remaining floor/time. Preserve daily spending and unknown holds. Do not infer exact cost from request counts or renew a quota merely to bypass its ceiling.
2. Confirm private Vercel authentication, durable V3 control status and an explicit short-lived ledger policy. Keep the V1 reserve and extra demo headroom. V2 and V3 spending share a conservative ledger; separate V3 totals can be queried by V3 session IDs.
3. Create a new Preview with deployment-only flags `V3_TRUST_OR_TRAP_ENABLED=true`, `V2_LIVE_ENABLED=true`, live Gnani and the intended STT setting. Do not update shared project flags as a shortcut. Configured keys alone do not make entry ready: the page checks current ledger headroom and durable control.
4. Use small bounded tests, one concurrent provider operation, no retries or paid fallback. Record actual model/source, statuses, masked evidence and limitations; do not store raw audio.
5. On completion or uncertainty, close the ledger or pause V3. Unknown dispatched charges retain accounting. End and independent verification remain available.

## Pause and rollback

`/admin/v3` uses existing private server admin authentication. Its same-origin pause form persists a V3-only stop in the database without changing V2 sessions or credit policy. This protects retained URLs containing these guards, unlike changing an environment flag alone. See V3_RUNTIME_CONTROL.md for its exact scope and recovery. The environment flag remains an additional default-off gate.

Rollback means pause V3, retain its tables/data, and use the preserved V2 Preview or V1 production. No schema downgrade or table deletion is needed. Tested local database restore and encrypted V2 snapshots are documented in V3_RECOVERY.md. An actual production promotion/data replacement has not been performed.

## Remaining acceptance

Live V3 speech, deployed conversations, real phones, pilot outcomes and demo recording are deferred, not passed. Android Chrome is available with the user for a later Tamil/Telugu check; iPhone availability is unconfirmed. Follow V3_DEMO_PLAN.md then record actual evidence in V3_TEST_RESULTS.md.
