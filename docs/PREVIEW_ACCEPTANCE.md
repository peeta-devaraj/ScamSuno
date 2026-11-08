# Isolated Preview checkpoint — November 8, 2026

Verified application commit: `0bb2ffc` on `feature/scamsuno-v2`, pushed to the private repository. Canonical V1 remains `b3462ac0a9eeb809c7e870044baa291d4c1e378e`.

Application Preview: https://scamsuno-v2-preview-8iolgt6tn-peetadevaraj-2614s-projects.vercel.app/v2?l=ta

Deployment: `dpl_C5EEpxC7GugrtGRXA3KFTzUR8ALf`, isolated project `prj_aOSnJ1cGJfTcgKRkYWdq5howq9Wm`. Vercel authentication protection is enabled. Automated checks used the project's automation bypass in memory; its value was not printed or committed. This confirms authenticated routing, not public accessibility.

Vercel required the project's first deployment to occupy its Production slot. The user explicitly approved only an inert static setup page, deployed as `dpl_6pqmg42RZ78vQHRfNLy5a5PcDPC8` at https://scamsuno-v2-preview.vercel.app. It has no application code or provider/database access. The V2 application above is a subsequent Preview deployment. This does not authorize V2 production promotion or alter https://scamsuno.vercel.app.

## Observed checks

- Local type checking, 172 tests and production build passed. Static audio checks passed.
- All 14 local browser journeys passed in 52.2 seconds, using labelled fixtures. Tamil UI screenshots were visually reviewed, including the corrected long-status wrapping.
- Source/browser-bundle credential scan passed. Secrets remain ignored locally and sensitive/encrypted in authorized Preview configuration.
- Hosted build at 08:42 UTC passed 172 tests, zero failures, and compiled successfully.
- Protected health, Tamil page and Telugu page returned 200.
- Private admin returned 401 without application authentication and 200 with valid authentication; admission displayed Closed.
- Start-conversation, V2 STT and legacy STT returned 503 under the closed configuration. These checks made zero provider calls.
- V1 health at `2026-11-08T08:45:09.154Z` retained the exact preserved commit, live STT configuration, four languages and 60 clips. The health check made zero provider calls.

The first application build failed four environment-sensitive fixture tests. Tests now isolate inherited Vercel/Turso settings explicitly; the successful hosted rerun verifies the correction. No production data or provider result was fabricated.

## Remaining release gates

Live admission remains false, killed, and quota-zero. The former reconciliation window has expired. Refresh official billing and resolve its discrepancy with recorded attempts before reopening a small explicitly bounded test window. Request caps alone are not a proven credit-to-request conversion or mathematical reserve guarantee.

Complete deployed voice/typed/scoring and interrupted-call acceptance after that gate. Earlier real Tamil/Telugu synthetic API loopbacks are useful provider evidence, but do not replace a deployed human conversation or Android Chrome/iOS Safari microphone and listening checks. Streaming, barge-in and accuracy benchmarks are not claimed.

V1 recovery remains documented in V1_PRESERVATION.md. No application production promotion is authorized. Recheck preserved deployments/configuration and data recovery before requesting that final approval.
