# V1 preservation checkpoint

**COMPLETE on November 7, 2026, before V2 implementation.**

The exact live V1 commit is `b3462ac0a9eeb809c7e870044baa291d4c1e378e`. Vercel Git provenance identifies it as the source of `dpl_6ZwzMVyH7GML842n8DsPUheBshBX`, served at [ScamSuno](https://scamsuno.vercel.app).

The [private immutable V1 release](https://github.com/peeta-devaraj/ScamSuno/releases/tag/v1-stable) protects the associated `v1-stable` tag and its source archive. GitHub reports `immutable: true`, and `gh release verify v1-stable` verified the signed release attestation. Downloading the archive reproduced SHA256 `5f0e97de681705bcdace0560246bca090c8cd24967f87d2761a06504c54a543a`.

## Preserved state

The original checkout at `C:/Users/peeta/Desktop/ScamSuno` was clean on `main`. It remains at the captured commit. There was no uncommitted source work to stash. Its local environment is byte-identical to the encrypted backup. Production environment variable identifiers, targets, types and modification timestamps match the baseline.

The recovery directory is `C:/Users/peeta/.codex/visualizations/2026/11/06/01a1b12a-e778-7371-9a75-15adbb3d38fd/scamsuno-v1-recovery-2026-11-07`.

It contains the complete source ZIP, downloaded release copy, restricted main-and-tag Git bundle, full Git bundle including original metadata refs, ignored-file inventory, local test fixtures, build/browser reports, rollback evidence, checksums and `CHECKPOINT.json`. All Git objects were scanned in memory against the configured credentials before archiving.

The local environment and raw Vercel deployment/project/environment metadata are encrypted with Windows DPAPI CurrentUser. Decryption was verified in memory. These backups depend on the same Windows user and machine. No credentials were added to the release or documentation.

V1 has no application database or durable server-side participant data. Sessions live in browser tabs, language preferences use local storage and rate counters are process-local. No database migration or production-data restoration was required.

Source engines and the local recovery rehearsal use Node 24. Vercel project/deployment metadata records Node 26. Both settings were captured, and the restored source built locally and on Vercel. This discrepancy should be reviewed before changing runtime settings.

## Verification

- Type checking, 11 unit/route tests, production build and all 60 audio checksums passed.
- Seven existing browser journeys passed in isolation. Two language-selection tests failed in the first parallel build/browser run. The serial rerun passed without source changes. This is retained as a test-stability finding.
- The live V1 passed all four terminal outcomes, PNG cards and four localized browser journeys.
- A fresh extraction of the archive installed the pinned dependencies, passed `pnpm verify` and passed `pnpm check:audio`.
- The separate recovery project deployed V1 as A, then B, then executed an actual B-to-A rollback. The recovered application passed all four outcomes, cards and four locale journeys afterward.
- A protected recovery preview built and its health endpoint was verified with an automation token held only in memory.
- The original production deployment and environment metadata were rechecked after the drill.
- This checkpoint consumed zero Gnani requests. Historical live voice evidence is preserved. Fresh provider/microphone tests remain release gates.

## Recovery deployments

The isolated project is `scamsuno-v1-recovery-20261107`, project ID `prj_uBww53I9mKDBUJVccg3IDFAMeGwU`.

Recovery A is `dpl_FijraootgFoA5DPZQJcazmQjxBhr`. Recovery B is `dpl_AfgyV4up62mLgQTug5KuZvoEfBeV`. The rollback report confirms the recovery project's production alias moved from B back to A.

The retained preview is `dpl_37KGQ3z2MD1QnmDJdzVhWgRPq34P`, at [the recovery preview](https://scamsuno-v1-recovery-preview-20261107.vercel.app). It has its own alias and Vercel authentication. Recovery deployments have voice disabled and contain no Gnani credential.

## Rules for V2

Develop only in `feature/scamsuno-v2` at the separate worktree beside the recovery directory. The original main checkout stays reserved for V1.

Use preview deployments for V2. Production promotion requires explicit user approval after voice, scoring, reserve protection, mobile compatibility and rollback checks. Keep live V2 provider admission closed until the official credit balance is reconciled and a durable budget store is configured.

Vercel currently retains V1 through its live production alias and recent-production retention exceptions. A V2 preview does not displace those. On the current Hobby plan, instant rollback is limited to the immediately previous production deployment. Before any approved promotion, verify that V1 will remain that previous deployment. A second production release requires a fresh recovery audit.

## Production rollback after an approved V2 release

The command below targets the original V1 deployment. It was documented but never executed against the real production project during preservation.

```powershell
npx.cmd --yes vercel@65.12.1 rollback dpl_6ZwzMVyH7GML842n8DsPUheBshBX --yes
npx.cmd --yes vercel@65.12.1 rollback status scamsuno
npx.cmd --yes vercel@65.12.1 inspect https://scamsuno.vercel.app
```

Verify the exact V1 alias mapping and repeat the application smoke checks. Instant rollback restores deployment-time code/environment. Future V2 databases require additive schema changes and a tested data-recovery procedure before production promotion. The V1 archive can also be rebuilt with its recorded settings and recovered server credentials.

## Sources

- [Vercel retention policy](https://vercel.com/docs/deployment-retention)
- [Vercel instant rollback](https://vercel.com/docs/instant-rollback)
- [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
