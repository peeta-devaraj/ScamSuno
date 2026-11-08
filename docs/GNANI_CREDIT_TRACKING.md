# V2 credit admission

## V3 fresh observation — November 8, about 09:11 UTC

The refreshed official signed-in usage page at `https://app.gnani.ai/voice/usage` showed 123 requests (27 STT, 96 TTS), 13.30 credits consumed and latest remaining ledger balance 4,986.70. The increase over the earlier 109 requests is four STT and ten TTS, matching the fourteen tracked V2 attempts in aggregate. No V3 calls have been dispatched. This observation does not establish individual request attribution or a contractual worst-case price.

The existing ledger is shared conservatively across V2/V3 session IDs. It must not reset daily spending when moving modes or refreshing a floor. With fourteen recorded Gnani calls on November 8, a policy capped at twenty calls per UTC day can admit at most six more that day. Do not raise or silently reset that ceiling to run a larger scenario matrix. Use fixture tests broadly and a small real voice window, then refresh official records before further testing. Keep V1's reserve and demo headroom.

The [official Prisma page](https://www.gnani.ai/resources/prisma-v3) states usage-based billing by audio duration but does not establish this account's exact credit conversion. Sample debit amounts are observed costs, not a universal bound. Request caps and ample headroom reduce exposure; they are not a mathematical credit guarantee. All live policy changes remain explicit, bounded and logged without secrets.

Live V2 calls are currently closed. The preservation checkpoint consumed zero Gnani requests, and recovery deployments have speech disabled with no provider key. Later bounded V2 tests recorded 14 Gnani attempts and 22 Groq attempts; see [test evidence](TEST_RESULTS.md). Provider attempts and billed credits are separate measurements.

At approximately **2026-11-07 05:58 UTC**, the signed-in official Gnani dashboard was inspected through its visible UI. Usage (all services, sources and keys, October 7–November 7) displayed **11.23 credits consumed**, **109 requests**, **23 STT** and **86 TTS**. Billing displayed **4,988 credits left** as an integer. The sidebar displayed 4.9k / 5k. Visible recent ledger entries included a remaining balance of 4,988.77, matching the arithmetic 5,000 − 11.23; this is not an independently fetched exact live balance. Use the conservative displayed **4,988** for this reconciliation snapshot and refresh before admitting live V2 traffic. This read made no inference requests and changed no account settings.

No supported public Gnani balance endpoint was found in the documentation review. Request counts and provider credits must be recorded separately. This dashboard observation does not prove a billing upper bound for every model, failure or streaming request.

Reserve at least 1,000 reconciled credits for V1. Separate API keys do not necessarily separate the underlying account balance. Before any shared-account V2 test, use a strict request quota, one concurrent operation and an explicit session cap. Unknown per-request cost cannot be represented as a measured credit estimate.

The V2 ledger uses isolated Turso storage, atomic admission reservations, idempotent operation IDs and one recorded attempt per upstream stage. No upstream automatic retries are implemented. A timeout or cancellation keeps a conservative reservation until explicitly reconciled. It stores duration/character counts, model, status, timestamps and request ID; it excludes raw audio, transcripts, credentials and personal information.

The private `/admin/usage` view authenticates on the server and requires same-origin updates. A preview fails closed when store, quota or provider configuration is missing. The original V1 credential and production environment remain in the preserved V1 project. Authorized Gnani, Groq and admin secrets have been transferred as sensitive variables to the isolated V2 project's Preview environment only. The deployed live flag remains false.

Local tests cover concurrent admission, duplicate accounting, reserve boundaries, cancellation, explicit unknown recovery and the kill switch. Remote store concurrency and closed-policy readback have passed. Deployed admin and complete voice acceptance remain pending. A successful ledger test cannot prove an exact credit reserve without a verified provider charge bound.

## November 8 dashboard observation and accounting gap

Around **03:4x UTC on November 8**, the signed-in official dashboard displayed integer **4,988 credits left** and **11.48 credits consumed**, with **110 requests: 23 STT and 87 TTS**. A visible latest Timbre v3 debit at 09:17:05 IST showed 137 characters, 0.25 credit and a remaining balance of 4,988.52. Billing showed ₹0 purchases and no billing history. These are observations at the dashboard's displayed precision, not an exact current balance fetched through an API.

The application has recorded 14 V2 Gnani attempts, while the displayed account request total increased by only one from the earlier 109-request snapshot. The reason and full charge status have not been established. Do not treat those totals as a complete reconciliation, claim a measured V2 credit cost, or silently clear conservative liabilities. Possible delayed reporting is not a verified explanation. Keep V2 admission closed until billing/request records establish a usable current snapshot and bounded test policy.

After additive recovery-table initialization on November 8 around 04:2x UTC, remote readback reported admission closed, kill switch enabled, both request quotas zero and zero active operations. Counters were Gnani 14 total/14 that UTC day and Groq 22 total/4 that day. No actual unknown-charge acknowledgement or balance refresh was performed. The original November 7 reconciliation expires after 24 hours and is not extended by merely reading the dashboard.

## Explicit unknown-charge recovery

An authenticated operator may acknowledge selected unknown attempts only after reviewing official provider records and confirming the new floor includes every uncertain charge. The five-minute minimum cooldown is not evidence that processing or charging has stopped. The operation retains original unknown outcomes, null actual costs and daily/session spend; it appends an audit acknowledgement and saves a killed, zero-quota policy. It never reopens traffic or refunds spend. The admin form requires the official snapshot time, integer floor, selected attempt IDs and explicit review confirmation. See [the exact recovery procedure](LEDGER_RECOVERY.md).

## Free-service constraint

The user requires no API purchases or paid subscriptions. Use the existing Gnani challenge allocation and the verified Groq Free account for conversational-model testing, subject to account rate limits. The isolated Turso Starter store is $0/month in Mumbai and connected to Preview/Development only. Never upgrade a plan, add a payment method, purchase credits or automatically switch to a paid provider. All live dispatch depends on durable admission, including free-tier requests.
