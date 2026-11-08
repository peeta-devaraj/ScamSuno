# Durable Trust or Trap pause

V3 has an additional database-backed emergency pause, separate from the shared provider ledger and environment feature flags. It does not grant live access by itself.

`initializeSessions` additively creates `v3_runtime_control(singleton,enabled)` and inserts the singleton with `enabled=1` only if absent. An existing `enabled=0` row survives instance startup, redeployment and reinitialization. Environment flags remain off by default and credit admission remains separately gated. Missing/unreadable control state denies V3 admission.

## Private operator workflow

Open `/admin/v3` on an authenticated HTTPS Preview. It requires the existing server-only admin credential. The GET response is uncached and shows only control status, not session content or credentials. Submit the same-origin pause form to persist `enabled=0`. The POST accepts only `action=pause`; repeated pause is safe. There is no browser or public resume endpoint.

The control blocks V3 start/reply and advisory readiness. More importantly, model and speech dispatch read it in the same write transaction that admits the upstream attempt. A pause committed before that transaction prevents dispatch. Work already dispatched may finish and remains conservatively accounted for; pause is not a provider cancellation or refund. Authenticated End and independent verification remain available, including after an ended call.

V2 session state, environment flags and shared request/credit policy are not modified. Classic V2 can retain its own admission state. Restoring V1 does not require changing V3 control or rewriting any data.

## Deployment coverage and recovery

Unlike an environment flag changed by redeployment, the durable pause is observed by all instances and retained deployment URLs **that include these checks and use the same database**. It cannot retrofit older code or control a different database. Before any live V3 window, verify all live-capable V3 URLs use this version; keep older versions without the guard closed and unconfigured for live use. Check the pause on more than one retained instance/URL during deployment acceptance.

After pausing, retain the row while investigating; do not rerun a migration that resets it. Any later operator-only SQL restoration to `enabled=1` is a distinct decision requiring reviewed billing, bounded quotas, valid environment flags and acceptance readiness. It is not performed automatically or exposed by the admin page.

Local SQLite tests cover fail-closed reads, repeated pause, reinitialization, two independent clients observing the same persisted pause, lease revocation, V2 data/policy preservation, authenticated administration and End/verification after pause. These are fixtures, not evidence that production or remote provider behavior was tested.
