# V3 voice acceptance and release runbook

The protected-preview procedure below preserves its original controls. For the current canonical host, see the [bounded Production rollout, ledger and pause/rollback controls](../release/PUBLIC_VOICE_ROLLOUT.md). [Classic](https://scamsuno-classic.vercel.app) is the public scripted fallback.

## Recovery points

- V1 is `b3462ac0a9eeb809c7e870044baa291d4c1e378e` at preserved deployment `dpl_6ZwzMVyH7GML842n8DsPUheBshBX`. The checkpoint health check matched the immutable `v1-stable` source and reported 60 clips across four languages. [Preservation record](../V1_PRESERVATION.md)
- The previously tested V3 application is `3e7ab99172327851536e923dbb98550ac46911e7` at `dpl_4StB9xtdBiA3yd7BGcQybE52tx8j`. Annotated tag `v3-voice-release-base-2026-11-09`, a verified complete Git bundle and a source ZIP preserve it. The sibling `scamsuno-v3-release-recovery-2026-11-09` directory also contains encrypted configuration, deployment metadata and a read-only snapshot of 11 tables. A separate in-memory restoration reproduced the recorded data. DPAPI recovery requires the original Windows account and machine. [Test record](V3_RELEASE_STRESS_REPORT.md)

## Collect current Gnani evidence

1. Open [Gnani Usage](https://app.gnani.ai/voice/usage) and sign in. Under **Usage Analytics**, choose **All Services**, **All Sources** and **All API Keys**.
2. Choose a date range covering November 8, 2026 through the current day. Record the selected range and the time you read it in IST. Use the same filters and range after testing.
3. Copy **Credits Consumed**, **Total Requests**, and the **STT** and **TTS** counts beside Total Requests. Also copy the available balance shown in the bottom-left badge. If the badge is rounded, look in **Billing** for an exact available balance and state which display it came from. Keep any rounded value verbatim.
4. Share only these figures. The operator will compare them with earlier observations, current ledger counters and active attempts. V1 and other consumers can contribute to the account totals. A difference by itself does not identify a specific request or charge.

The last V3 ledger shows six TTS, zero STT and 24 model attempts. Both prior ledgers were closed and had zero active attempts or unknown holds at the readback. The current provider balance is unknown. [Read-only ledger and deployment inventory](evidence/v3-phone-isolation.json)

## Isolation before opening

Earlier immutable V3 previews keep their original credentials and code. Changing Preview variables applies to new deployments. The original dedicated V3 previews share the original ledger, so reopening that ledger would restore eligibility on older builds with live flags. Older V2 routes can use the same original ledger and do not use the V3-only pause. The historical V2 project has its own closed store. A protected Preview restricts access to a project, with authorized users still able to reach old deployments. [Vercel environment behavior](https://vercel.com/docs/environment-variables/managing-environment-variables) · [Deployment protection](https://vercel.com/docs/deployment-protection)

The isolated Turso resource is `scamsuno-v3-phone-ledger`, `store_Auu20hZJnWcdErdW`, on the existing $0 Starter plan in Mumbai. Its distinct database credentials are bound under a separate prefix in V3 Preview only. The phone profile is explicitly selected on one deployment. Missing or shared credentials and a non-Preview environment fail closed. Existing deployments continue to use their original credentials.

The new store contains a verified copy of the original closed policy and all 30 accounting attempts. It contains zero copied participant sessions. The old stores keep their policies, usage and holds. Further deployments should use the default closed profile unless intentionally designated for a new isolated test. [Store readback](evidence/v3-phone-store.json) · [Isolation regressions](evidence/v3-phone-ledger.log)

## Activate and close one supervised window

Phone candidate `d40652f`, deployment `dpl_ChCFLVcKR3TAFQJV3F5pWHPqt4S6`, is Ready. The authorized V2 and V3 pages returned 200, the signed-out request redirected to access protection, and the closed V3 start returned 503. The deployed read initialized session schema only on the new store, with zero participant sessions and unchanged accounting. All three ledgers remained closed. [Tamil Preview](https://scamsuno-v3-2zha20741-peetadevaraj-2614s-projects.vercel.app/v3?l=ta) · [Telugu Preview](https://scamsuno-v3-2zha20741-peetadevaraj-2614s-projects.vercel.app/v3?l=te) · [HTTP evidence](evidence/v3-phone-preview.json) · [Store readback](evidence/v3-phone-boundary.json)

Live admission stays closed while balance reconciliation is pending. Local verification passed type checking, 277 unit and route tests, the production build, 27 fixture browser journeys and the audio check. V1 matched its preserved build after publication. Preparation used zero provider calls. [Verification](evidence/v3-phone-verify.log) · [Browser log](evidence/v3-phone-browser.log) · [V1 health](evidence/v3-phone-v1.log)

- Preflight the exact Preview with Vercel Authentication, verify its separate store and confirm both prior stores remain closed. Check for zero in-flight or unresolved attempts. Reconcile fresh provider evidence and all known same-day usage. Preserve the prior reserve of at least 2,000 credits. Verify sufficient headroom for the bounded provider cost before applying the plan.
- The plan is one 20-minute window on the same UTC date as the balance reading, with six additional speech attempts and four additional model attempts. The two planned exchanges each use opening TTS, STT, evaluation, caller generation and reply TTS. Cap each session at five provider attempts and allow one concurrent attempt. Keep recording and TTS ceilings at 15 seconds and 420 characters. The caps include failed dispatches and there is no retry allowance. The operator planner rejects missing or stale evidence, insufficient verified headroom, unresolved attempts and excess same-day totals. The planner computes a policy without writing it. [Operator code](../../scripts/v3-phone-ledger.ts)
- Apply the recorded plan only to the verified isolated store when the tester is ready. Read back the exact cap and expiry in IST. Stop if a required stage fails. End remains available for a debrief. After the two exchanges or first material failure, use the isolated preview's authenticated `/admin/v3` pause or the isolated ledger kill switch and confirm admission closed. Expiry closes admission automatically. Review provider totals and the ledger after already dispatched work settles. Record failures or unknown outcomes with their original status.
- The account balance may also be used by V1. Attempt caps and a reserve margin limit exposure. Without a documented provider cost bound they do not prove an exact monetary ceiling. Keep an operator present and do not extend or recycle the window.

### If reconciliation is unavailable

Use the protected, closed Preview to verify Android sign-in, locale selection and V2-to-V3 navigation. Use the existing local fixture suite to rehearse the reply, End and debrief flow. This costs zero speech credits and leaves pronunciation, microphone behavior on the deployed call and real recognition unverified. A live alternative would need a separately funded provider allowance with a verified balance and enforceable spending cap. An additional API key on the same Gnani account would still draw from the shared account. The existing ledger requires a verified floor, so the operator does not substitute a fabricated balance.

## Phone acceptance

In Android Chrome, sign into the Vercel account with Preview access. After the window opens, use the Tamil link, answer, listen, record one short fictional reply, compare the original transcript, confirm/send once, listen to the reply, then End. Repeat once in Telugu. Report phone model, browser, whether the original transcript matched, opening and reply audio clarity, any error and whether debrief worked. Edited transcripts count as typed input. No audio recording upload is needed. [Detailed checklist](V3_DEVICE_ACCEPTANCE.md)

After the results arrive, reproduce any failure in the affected stage and test the fix. Record the candidate commit and any targeted live retest separately. Keep successful results tied to the exact deployment and environment.

## Public access, budget and rollback

1. Prepare a V3 Production environment in the dedicated V3 project with a separately scoped store and server credentials. Keep the Preview-only profile out of Production. Reconcile the shared provider balance again and define public start, request, concurrency and expiry limits with an operator pause. Production also needs a retention cleanup cadence and a documented support owner.
2. Record the candidate source, environment metadata, backup and restore evidence, exact V3 alias and the previous eligible V3 Production deployment. Vercel rebuilds a Preview promotion with Production variables. Verify the configuration and obtain explicit approval for that deployment. After launch, verify signed-out access, the scoped policy, V1 health and the capped public voice journey. [Vercel promotion](https://vercel.com/docs/deployments/promote-preview-to-production)
3. On incident, pause the affected V3 store first. Retain billing rows, outstanding holds and participant data according to the retention policy. Route testers to the preserved V1 fallback. Verify the linked project and eligible target before any V3 rollback. The current V3 Production rollback reference is static bootstrap `dpl_GdXrhZSY2nKZs7WXneprxHfbevYs`. On Hobby, check that it is the immediately previous Production deployment after an approved first release. Rollback restores routing and the previous deployment configuration. Reconciliation and database recovery remain separate operations. [Vercel rollback](https://vercel.com/docs/instant-rollback)
