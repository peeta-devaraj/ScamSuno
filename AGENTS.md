# ScamSuno repository guidance

## V3 isolation

- This worktree is `codex/scamsuno-v3`, based on preserved V2 commit `83e0d61`. The user's V3 specification supersedes the V2-only branch instruction below for this worktree.
- V1/V2 preservation was independently rechecked before V3 application edits. Read docs/V3_PROGRESS.md and docs/V3_RECOVERY.md. Do not change the old worktrees, canonical production or existing V2 deployment/configuration.
- Trust or Trap uses server-only scenario assignment and an explicit public response DTO. Never send hidden truth, answer keys or evaluation rubrics before the debrief.
- V3 live calls stay disabled until billing and bounded admission are verified. Keep the existing V2 transport defaults and regression coverage when introducing adapters.
- Production promotion requires explicit approval; physical-device and educational pilot results must be observed, never inferred from fixtures.

## V2 isolation and release gate

- The V1 preservation checkpoint is complete. Read docs/V1_PRESERVATION.md before development.
- Develop in feature/scamsuno-v2 in this worktree. Production promotion requires explicit user approval.
- Run pnpm check:v1 after every major milestone and preserve v1-stable and all V1 recovery deployments.
- The user's V2 specification authorizes bounded generated caller dialogue for the isolated V2 path. Apply independent validation before synthesis and retain fictional, educational content. This supersedes the scripted-only restriction below for that V2 path.
- Keep V2 live testing closed except for explicitly bounded, reconciled probes behind the durable reserve policy. Credentials belong only in ignored local environment files or authorized server environments; never print their values.
- Use previews for V2 acceptance. Record additive database migrations and tested data recovery before any production promotion.

- Keep Gnani and classifier credentials in server environment variables. Never include credentials in source, browser bundles, logs or errors.
- Report observed provider responses and measured outcomes. Label development fixtures and reject mock mode in Vercel production.
- Preserve the origin of replies as voice, typed or button. Keep caller dialogue scripted and fictional.
- Validate hosted classifier output against the intent contract. Treat uncertainty as unscored and keep untested criteria out of the denominator.
- Display the educational simulation label on every screen and share card. Use fictional data throughout the caller scenario.
- Keep audio in memory and out of server logs and storage. Mask numbers in retained transcripts and keep all reply content off share cards.
- Use `pnpm verify` for type checking, unit and route tests and a production build. Run `pnpm test:e2e` for browser journeys. `pnpm check:audio` is a release gate for the voice-caller experience.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
