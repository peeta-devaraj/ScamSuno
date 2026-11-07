# Preservation and V2 preparation results

On November 7, 2026 the exact V1 source at b3462ac0a9eeb809c7e870044baa291d4c1e378e passed type checking, 11 unit/route tests, a production build and all 60 audio checksums. The seven existing Chromium journeys passed in an isolated rerun. The initial parallel build/browser run had two language-selection failures and remains a stability finding.

The source ZIP was rebuilt independently from its extraction using the frozen lockfile. The build, 11 tests and audio checks passed. The downloaded immutable release ZIP matched its published digest.

Both the original application and the isolated recovery app after B-to-A rollback passed four outcomes, cards and four locale browser journeys. The retained recovery preview passed authenticated health checks. No Gnani calls were made by this checkpoint.

The isolated preparation branch passed pnpm verify with 16 tests, production build and type checking, followed by pnpm check:audio and pnpm check:v1. The latter confirmed the exact V1 source revision, live mode, enabled STT and all four locales with zero Gnani calls. Five tests cover monitor drift/failure behaviour and import safety.

V2 conversation, runtime synthesis, durable budgets, admin authentication, streaming and physical-device acceptance remain unverified. Their completion requires observed results in the implementation progress record.
