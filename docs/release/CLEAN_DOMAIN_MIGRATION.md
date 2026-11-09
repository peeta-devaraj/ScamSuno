# Clean domain migration · operator plan

**Current routing: [Trust or Trap](https://scamsuno.vercel.app) is the canonical app; [Classic](https://scamsuno-classic.vercel.app) is the separate scripted fallback.** The original paused landing cutover below preceded the [bounded public voice rollout](PUBLIC_VOICE_ROLLOUT.md), which has its own admission and rollback controls.

## Canonical cutover record

On November 9, 2026, the owner directed the main address to Trust or Trap. Project `scamsuno` retained its generated domain and promoted staged deployment `dpl_BRya5L6FwrhLZ2JSUuAZZuU3FgW3`. The base commit is `e4dea96a6a8ef755e7359e5d7a25db92f8705ba3` with the reviewed brand worktree overlays and the V2 fixture environment correction. Source-manifest SHA-256 is `e7d2df6d80c4ca074499b4ae16b3055eb3a268e0d75717e4ec290fcb40e1d7e2`. Vercel passed 278 tests, the audio manifest check and the production build.

Signed-out Chrome reached `/v3?l=en`, selected Telugu and found the Classic fallback. Root redirects preserve a supported locale. Public social art returned 200. The conversation and speech routes returned 503, both admin pages returned 401, and the health response confirmed speech input disabled and scripted classification. The CLI briefly created an automation credential for staged verification. It was revoked before promotion, and the staged URL still required sign-in on recheck. [Public smoke evidence](../audit/evidence/canonical-cutover/public-smoke.json) · [Alias verification](../audit/evidence/canonical-cutover/alias.log)

The original V1 deployment `dpl_6ZwzMVyH7GML842n8DsPUheBshBX` is the rollback target for this cutover. `pnpm check:v1` remains a check for restoring the original V1 build to the main address. Use the Classic smoke evidence for the permanent scripted site.

## Associations before cutover

| Address | Observed Vercel association | Signed-out Chrome |
| --- | --- | --- |
| `scamsuno.vercel.app` | Project `scamsuno` / `prj_lUBquC2oHAsblI972gj4J6PBgJbh`; Production `dpl_6ZwzMVyH7GML842n8DsPUheBshBX` | HTTPS 200, V1 title, no sign-in. Health pinned to `b3462ac0a9eeb809c7e870044baa291d4c1e378e`. |
| `scamsuno-v3.vercel.app` | Project `scamsuno-v3` / `prj_JDp4rXsPImluwK9XLTgHCV2fIPst`; Production `dpl_GdXrhZSY2nKZs7WXneprxHfbevYs` | HTTPS works; `/v3` returns 404 from the bootstrap. This address is already assigned to the project. |
| Verified V3 phone candidate | Same V3 project; Preview `dpl_ChCFLVcKR3TAFQJV3F5pWHPqt4S6`, source `d40652f` | Redirected to Vercel Login. Existing candidate remains private. |
| `scamsuno-classic.vercel.app` | Project `scamsuno-classic` / `prj_QlWNaQhPYP34Tew6SfyqSyQfQOiY`; Production `dpl_9FtUxDFXoPUbsUZSnhCep8cHVmUW` | HTTPS 200 and signed-out scripted journeys passed in English, Tamil, Telugu and Hindi. |
| V1 recovery | Independent protected `dpl_37KGQ3z2MD1QnmDJdzVhWgRPq34P`; voice disabled | Redirected to Vercel Login. Tested recovery reference, not a signed-out replacement address. |

Current A record responses for the clean hostname were `64.29.17.3` and `216.198.79.3`; Chrome validated HTTPS. Both public project hostnames returned HTTP 308 to the same host over HTTPS; the reserved bootstrap root returned 200. Vercel owns the parent DNS and certificate. Record new observations at cutover. The original audit inspected DNS, TLS, deployment protection and aliases. The Classic release added a separate project and address. [V1 checkpoint](../V1_PRESERVATION.md) · [V3 readiness](V3_FINAL_READINESS.md)

## Classic deployment record

On November 9, 2026, the separate Classic project was deployed from the pinned V1 archive `b3462ac0a9eeb809c7e870044baa291d4c1e378e`. SHA-256 `5f0e97de681705bcdace0560246bca090c8cd24967f87d2761a06504c54a543a` matches the preservation checkpoint. The deployment uses shipped audio and scripted choices, with speech recognition and hosted classification disabled. It received no Gnani or classifier credentials. At that checkpoint, the canonical alias still served V1 at `dpl_6ZwzMVyH7GML842n8DsPUheBshBX`; it moved to V3 at the subsequent cutover. [Signed-out Classic smoke results](../audit/evidence/classic/signed-out-smoke.json)

## Recommended release choice

Vercel generates the `.vercel.app` name from the project and allocates those names first come, first served. Its custom-domain transfer procedure is not a guarantee that an occupied generated production alias can be transferred without downtime. The read-only checks establish ownership, not transfer eligibility. Do not detach the alias, rename a project, or delete a deployment to test this. Ask Vercel for confirmation of the exact generated-alias operation and rollback semantics if cross-project routing is required. [Generated domains](https://vercel.com/docs/domains/working-with-domains) · [Transfers](https://vercel.com/docs/domains/working-with-domains/transfer-your-domain) · [Alias conflicts](https://vercel.com/kb/guide/how-to-resolve-alias-errors-on-vercel)

- **Safest launch if the alias cannot be moved:** use the already assigned `scamsuno-v3.vercel.app` in the existing V3 project. It is a short known address, currently a bootstrap, and keeps V1's public address and project isolated. Verify the new root after the approved promotion before linking it anywhere.
- **Preferred clean address if approved:** keep its current project assignment and stage the exact accepted branded build in project `scamsuno`. This avoids releasing the generated name. Only choose this path after confirming staging and same-project rollback support, provisioning a scoped V3 Production environment independently of the preserved V1 deployment, and verifying a distinct public scripted fallback. If the project-level environment change or separate fallback cannot be isolated and approved, use the V3 project alternative.
- **Cross-project generated alias:** only if Vercel explicitly confirms a non-destructive move for these projects with a reliable move-back procedure. Document the provider-supported commands and rollback evidence before asking for approval. The generic delete/re-add procedure is excluded.

## Exact sequence for the selected same-project promotion

1. Record exact branded commit, authorized Production project ID, immutable current deployment ID, selected origin, V1 recovery, environment target inventory, and protected preview state. Verify a fresh signed-out scripted fallback address when replacing the canonical V1 alias. The preserved V1 immutable URL and separate authenticated rollback project remain recovery paths. Never delete either.
2. Keep preview authentication. Prepare Production-specific V3 configuration and isolated admission store, preserving all closed preview ledgers and unknown holds. Map the selected origin using `SCAMSUNO_PUBLIC_ORIGIN` on Production only. The branded app defaults to the verified Classic origin. Set `SCAMSUNO_SCRIPTED_PRACTICE_ORIGIN` only to select a different, signed-out-verified V1 host. The fallback must not point back at the new V3 origin. No provider key belongs in a command argument or repository file.
3. After the gates and explicit authorization, link a clean checkout to the exact approved project. Stage with `vercel deploy --prod --skip-domain` with provider admission closed. Verify the staging deployment uses the approved revision and Production variables and confirm the current public alias still points to its pinned deployment. The unique staging URL may still be protected; do not use it as a final public destination. [Vercel staged production deploy](https://vercel.com/docs/cli/deploy#skip-domain)
4. Confirm the project and ID again. Promote that exact staged deployment with `vercel promote <approved-deployment-id-or-url>` only in the approved project and window. Confirm Standard Protection or an approved equivalent that keeps old generated previews gated and allows the production domain to open. If the judge-facing domain remains protected, stop and seek approval for the narrowest compatible setting. [Promotion](https://vercel.com/docs/cli/promote) · [Deployment Protection](https://vercel.com/docs/deployment-protection)
5. From a fresh Chrome context, verify HTTPS certificate, HTTP-to-HTTPS handling, root redirect to `/v3?l=en`, HTTP 200 for Trust or Trap, English/Tamil/Telugu/Hindi controls, no Vercel Login, stable fallback, canonical and 1200×630 card URLs on the intended host, no unauthenticated admin access, and intact preview protection. Run signed-out clean URL checks on both desktop and Android. Verify scoped ledger state before and after any separately authorized bounded live session. Keep unknown charges and V1 reserve intact.
6. Use the verified public destination in the video end card and posts only after those checks. Keep the three evidence clips from one accepted call.

## Rollback

Pause the scoped V3 policy first and preserve accounting. If using the V1 project, restore traffic to `dpl_6ZwzMVyH7GML842n8DsPUheBshBX` in project `scamsuno` through the reviewed dashboard rollback or `vercel rollback <eligible-deployment>`. If using the separate V3 project, roll back to `dpl_GdXrhZSY2nKZs7WXneprxHfbevYs` and continue directing users to V1. Hobby rollback is limited to the previously assigned eligible Production deployment; verify that exact target before promotion. If ineligible, stop and prepare an explicitly approved redeploy from the pinned source and encrypted recovery records. Verify the restored alias and V1 health in signed-out Chrome. Restore scoped data separately and only from reviewed backup evidence; alias rollback does not roll back a database. [Vercel rollback](https://vercel.com/docs/instant-rollback) · [Recovery](../V3_RECOVERY.md)

