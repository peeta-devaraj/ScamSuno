# V2 credit admission

Live V2 calls are currently closed. The preservation checkpoint consumed zero Gnani requests, and recovery deployments have speech disabled with no provider key.

At approximately **2026-11-07 05:58 UTC**, the signed-in official Gnani dashboard was inspected through its visible UI. Usage (all services, sources and keys, October 7–November 7) displayed **11.23 credits consumed**, **109 requests**, **23 STT** and **86 TTS**. Billing displayed **4,988 credits left** as an integer. The sidebar displayed 4.9k / 5k. Visible recent ledger entries included a remaining balance of 4,988.77, matching the arithmetic 5,000 − 11.23; this is not an independently fetched exact live balance. Use the conservative displayed **4,988** for this reconciliation snapshot and refresh before admitting live V2 traffic. This read made no inference requests and changed no account settings.

No supported public Gnani balance endpoint was found in the documentation review. Request counts and provider credits must be recorded separately. This dashboard observation does not prove a billing upper bound for every model, failure or streaming request.

Reserve at least 1,000 reconciled credits for V1. Separate API keys do not necessarily separate the underlying account balance. Before any shared-account V2 test, use a strict request quota, one concurrent operation and an explicit session cap. Unknown per-request cost cannot be represented as a measured credit estimate.

A production ledger requires durable storage, atomic admission reservations, idempotent operation IDs and one recorded attempt per upstream retry. A timeout or cancellation keeps a conservative reservation until reconciled. Store duration/character counts, model, status, timestamps and request ID. Exclude raw audio, transcripts, credentials and personal information.

The admin usage view needs server authentication. A preview must fail closed when the store, quota or authentication configuration is missing. The original V1 credential and production environment remain in the preserved V1 project.

Acceptance includes concurrent admission, duplicate/retry accounting, reserve boundaries, cancellation, reconciliation and the kill switch. This module remains TODO until those behaviours are implemented and tested.

## Free-service constraint

The user requires no API purchases or paid subscriptions. Use the existing Gnani challenge allocation and a Groq Free account for conversational-model testing, subject to actual account access and rate limits. Never upgrade a plan, add a payment method, purchase credits or automatically switch to a paid provider. Hosted model credentials remain pending. Check account limits before any probe; all live dispatch still depends on durable admission, including free-tier requests.
