# V1/V2 recovery before V3

The original main and V2 worktrees were clean and were not reset, stashed or overwritten. V3 uses a separate worktree and branch. V1 retains its immutable `v1-stable` release and previously tested separate-deployment rollback; see V1_PRESERVATION.md.

V2 source is `83e0d61d15f17f844eb9287b65fc69bd10bf6637`, with remote annotated tag `v2-verified-2026-11-08`. The tag complements, rather than replaces, these recovery artifacts:

- Recovery directory beside the worktrees: `scamsuno-v2-recovery-2026-11-08`.
- `source-83e0d61.zip` and verified complete feature-branch `source.bundle`.
- `CHECKPOINT.json` with source-state identifiers, plaintext digests, table row counts and successful recovery evidence.
- DPAPI-encrypted local environment files and Vercel project/deployment metadata, decrypted and checked in memory.
- DPAPI-encrypted consistent read-transaction snapshot of all seven database tables, table definitions and indexes. Restore into separate in-memory SQLite recreated every stored row. The live database was not modified.

DPAPI CurrentUser encryption depends on the same Windows account and machine. This is not a portable off-machine disaster backup. Preserve that limitation; do not publish the encrypted artifacts or turn decrypted content into source/logs.

## Recovery procedure and tested scope

1. Close V3 admission and retain its data. Do not delete V3/V2 tables, tags or deployments.
2. Use the unchanged verified V2 Preview at `dpl_C5EEpxC7GugrtGRXA3KFTzUR8ALf`. Canonical V1 remains `dpl_6ZwzMVyH7GML842n8DsPUheBshBX`; V3 work does not move its alias.
3. If source recovery is necessary, verify `source.bundle`, create a separate checkout at `83e0d61`, and restore configuration only into that isolated target after decrypting and checking CHECKPOINT digests. Never overwrite the original checkout or environment as a shortcut.
4. If database recovery is necessary, restore the snapshot into a separate empty database, recreate tables then rows then indexes, and verify schema/row comparisons before connecting any deployment. The snapshot restoration was tested in memory; an actual external-database replacement or production data rollback has not been performed and needs an explicit non-destructive plan.
5. Run V2 verification and authenticated Preview checks, plus the zero-credit V1 monitor. Preserve original unknown-charge accounting and closed quotas. Restoring an old data snapshot must never silently erase later provider spending: reconcile the ledger before enabling anything.

V3 feature flag configuration defaults off. The config-level off gate is tested; end-to-end rollback of future V3 routes must be tested once those routes exist. Do not claim that future rollback acceptance is already complete. Existing V2 and V1 deployments remain available while V3 is developed.
