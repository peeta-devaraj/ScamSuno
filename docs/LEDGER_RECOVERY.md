# V2 unknown-charge recovery

`unknown` means the application cannot verify the provider outcome. It consumes
request allowance and holds concurrency. A cancelled browser request or elapsed
timer is not evidence that a provider stopped processing or charging.

Only an authenticated operator may call `reconcileUnknownUsage`. The HTTP/admin
caller must enforce authentication and same-origin request protection; the ledger
does not authenticate a human. Never expose this operation through a public caller
route or run it as an automatic cancellation cleanup.

1. Keep admission closed while reviewing uncertainty. Inspect official provider
   billing and request records. Verify that the new credit floor already includes
   **all uncertain charges**, including charges still processing or delayed in the
   dashboard. If that cannot be established, retain the holds and wait.
2. Wait at least five minutes after the latest reservation, dispatch or settlement
   timestamp for each selected unknown attempt. This is a minimum cooldown, **not
   proof that provider work has stopped**. It does not replace step 1.
3. Supply a fresh UUID `reconciliationId`, the official snapshot's `verifiedAt`
   timestamp in integer Unix milliseconds, integer `verifiedCreditFloor`, 1–50
   unique unknown `attemptIds`, and `providerReviewConfirmed: true`. Verification
   must be no older than 24 hours, no later than the current time, and no earlier
   than the current policy's reconciliation timestamp. Do not supply notes,
   transcripts, audio, credentials or fabricated per-request costs.
4. The single transaction records the acknowledgement and snapshot and saves a
   disabled, killed policy with zero Gnani and LLM request quotas. It never opens
   traffic. A zero or below-reserve floor is permitted only with admission disabled
   and killed. Any subsequent reopening is a separate operator policy action with
   a verified floor above the reserve and bounded request ceilings.

An acknowledged attempt remains `unknown`; original timestamps, provider metadata
and `actualCredits: null` stay intact. The acknowledgement removes its concurrency
hold. Daily and per-session spending stay consumed. An older acknowledged unknown
can leave the new reconciliation window because the verified floor includes its
liability. Unacknowledged older unknowns and every reserved/dispatched attempt
continue consuming the window allowance. Reconciliation cannot acknowledge a
reserved, dispatched, released, succeeded or failed attempt.

Reuse the same reconciliation ID and exact metadata for retries. UUID casing and
attempt-ID order are canonicalized. An exact replay returns `alreadyApplied: true`
and the original closed policy snapshot without modifying the current policy; a
changed request with the same ID is rejected. Refresh `usageSummary` to inspect
the current policy. Previously acknowledged attempts cannot be acknowledged by a
different action.

`initializeLedger` adds only `v2_usage_reconciliations` and
`v2_usage_unknown_acknowledgements` with `CREATE TABLE IF NOT EXISTS`; run it for an
existing V2 store before using this version. It leaves V1 schemas and data alone.
The append-only application audit records identifiers, timestamps, floor, explicit
review confirmation and the applied numeric/boolean policy. The operation never
changes provider outcomes, refunds recorded daily/session spend, deletes attempts
or contacts a provider. SQL/store failures roll back all writes and return only a
fixed error code.

`tests/v2-ledger-recovery.test.ts` uses real in-memory SQLite and explicitly marked
fixture records. It covers cooldown, validation, idempotency, preserved spending,
closure, low balances, additive initialization and atomic failure recovery; no
provider response or billing result is claimed by those fixtures.
