# V2 credit admission

Live V2 calls are currently closed. The preservation checkpoint consumed zero Gnani requests, and recovery deployments have speech disabled with no provider key.

The brief's allocation and remaining-balance figures are provisional. A current official dashboard observation is required before credit admission. No supported public Gnani balance endpoint was found in the documentation review. Request counts and provider credits must be recorded separately.

Reserve at least 1,000 reconciled credits for V1. Separate API keys do not necessarily separate the underlying account balance. Before any shared-account V2 test, use a strict request quota, one concurrent operation and an explicit session cap. Unknown per-request cost cannot be represented as a measured credit estimate.

A production ledger requires durable storage, atomic admission reservations, idempotent operation IDs and one recorded attempt per upstream retry. A timeout or cancellation keeps a conservative reservation until reconciled. Store duration/character counts, model, status, timestamps and request ID. Exclude raw audio, transcripts, credentials and personal information.

The admin usage view needs server authentication. A preview must fail closed when the store, quota or authentication configuration is missing. The original V1 credential and production environment remain in the preserved V1 project.

Acceptance includes concurrent admission, duplicate/retry accounting, reserve boundaries, cancellation, reconciliation and the kill switch. This module remains TODO until those behaviours are implemented and tested.
