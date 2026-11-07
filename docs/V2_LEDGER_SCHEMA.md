# V2 usage ledger

The ledger is an isolated admission component, not a billing API, live provider adapter, or public launch authorization. It accepts identifiers and size measurements only. No participant text, recordings, prompts, credentials, or provider error bodies belong in its inputs or tables.

## Additive schema

`initializeLedger(client)` creates only `v2_usage_policy`, `v2_usage_policy_history`, and `v2_usage_attempts`, plus `v2_` indexes. It does not alter V1 tables or automatically configure a policy. The current policy is a validated JSON document; each operator update also appends an audit revision. Attempts retain UUID attempt/operation/session identifiers, a server-selected model identifier, one of `gnani_stt`, `gnani_tts`, `caller`, `evaluator`, optional STT seconds or TTS character count, policy reconciliation time, lifecycle timestamps/status, and optional measured latency. `actual_credits` is constrained to NULL. No per-request price has been verified.

The server owns all policy, time, model, and size values. Public requests must not supply policies or call settlement directly. Production requires an independently verified remote durable database; a local SQLite file is for development/testing only. SDK failures become code-only `V2_STORE_UNAVAILABLE` errors.

## Policy and ceilings

Admission is closed without a policy. An enabled policy requires a timestamped operator-reconciled integer credit floor strictly greater than its reserve (at least 1,000 credits), an expiry within 24 hours of reconciliation, and no kill switch. Hard ceilings are 20 Gnani attempts total and per UTC day, 20 LLM attempts total and per UTC day, 40 attempts per session, two concurrent outstanding attempts, 20 STT seconds, and 420 TTS characters. Operators may only lower these ceilings. A killed, expired, missing, or invalid policy fails closed. Dispatch rechecks policy and quotas, including limits reduced after reservation.

These quotas bound traffic, **not exact credit spending**. The ledger cannot see V1, dashboard, or other account traffic. A second API key does not create a separate credit pool. A fresh reconciled floor and small allowance do not mathematically prove preservation of the credit reserve without a verified charge bound. Keep public live admission closed until account usage and cloud storage are verified; reconcile external traffic before increasing or refreshing allowances. LLM and Gnani counts remain separate, with no invented conversion to credits or sessions remaining.

## Reservation and idempotency

`reserveUsage(client, attempt, now?)` uses `databaseWrite` and a database write transaction to check limits and insert a reservation atomically. `now` defaults to the server clock. `operationId` uniquely identifies one paid upstream stage; STT, caller, evaluator, and TTS need distinct IDs. Redelivery of the same operation with the same immutable metadata returns the existing attempt with `admitted:false`, even if the caller supplies another attempt ID. Metadata conflicts fail closed. An intentional paid retry needs a new operation ID and its own allowance; there are no automatic retries.

Only a committed `markDispatched(client, attemptId, now?)` result with `dispatch:true` authorizes one actual upstream attempt. Repeated dispatch claims return false, including after restart. Persist the dispatch claim before sending. A crash after the claim may leave an attempt charged conservatively even if no request reached the provider; never redispatch that attempt to guess what happened.

`settleUsage(client, attemptId, status, {latencyMs?,providerRequestId?,statusCode?}?, now?)` accepts `succeeded`, `failed`, `unknown`, or `released`. The optional provider ID is restricted to 128 identifier characters, and HTTP status to 100–599; never pass an error body. Only a known undispatched `reserved` attempt may become `released`, restoring quota once. Duplicate settlement is idempotent. Dispatched failures consume allowance. Cancellation/timeouts after dispatch must be `unknown`, never `released`. Conflicting terminal reports and outcomes without a dispatch record become `unknown`. Unknown is sticky in this API and retains both allowance and its concurrency slot; it needs a future explicit operator recovery procedure, not an automatic expiry/refund.

## Counting and recovery

All non-released attempts consume session allowance for the session's lifetime. Daily counters use the reservation's UTC day and do not reset on policy edits. Total counters include attempts reserved since reconciliation **plus every older reserved/dispatched/unknown hold**. A newer balance snapshot does not erase unresolved attempts. Settled attempts before a newer reconciliation may leave that total window because the operator's new floor must already account for them. The audit and attempt rows remain intact.

`usageSummary(client, now)` returns policy state, counters, status/kind counts, and up to 50 recent metadata-only attempts. Its `admissionOpen` describes policy eligibility; individual requests still require transactional quota checks. Credits remain NULL. Do not delete rows to regain allowance. V1 rollback requires no ledger rollback because its existing code and schema are untouched; retain the V2 ledger if disabling or reverting V2 so uncertain consumption is recoverable.

Single-client queuing reduces contention; the database transaction and uniqueness constraints provide the cross-client boundary. Cross-client SQLite busy/SDK failures deny admission instead of retrying upstream calls. Real local SQLite tests cover parallel clients, restart persistence, expiry/kill switch, duplicate dispatch/settlement, quota accounting, and transaction rollback. They do not establish remote-store concurrency, provider billing, or production readiness.

## Observed validation

On November 7, 2026, `pnpm exec tsx --test tests/v2-ledger.test.ts` passed all 18 tests (38.892 seconds). Concurrency, dispatch-once across clients, restart, and rollback cases used actual SQLite files; other cases used actual in-memory SQLite. `pnpm typecheck` also passed. An earlier all-file run passed the same 18 cases before the additional cross-client dispatch assertion, but took 216.038 seconds because of local file I/O. No cloud storage, speech, LLM, or billing calls were made by this workstream.
