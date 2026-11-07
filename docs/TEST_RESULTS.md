# Preservation and V2 preparation results

On November 7, 2026 the exact V1 source at b3462ac0a9eeb809c7e870044baa291d4c1e378e passed type checking, 11 unit/route tests, a production build and all 60 audio checksums. The seven existing Chromium journeys passed in an isolated rerun. The initial parallel build/browser run had two language-selection failures and remains a stability finding.

The source ZIP was rebuilt independently from its extraction using the frozen lockfile. The build, 11 tests and audio checks passed. The downloaded immutable release ZIP matched its published digest.

Both the original application and the isolated recovery app after B-to-A rollback passed four outcomes, cards and four locale browser journeys. The retained recovery preview passed authenticated health checks. No Gnani calls were made by this checkpoint.

The isolated preparation branch passed pnpm verify with 16 tests, production build and type checking, followed by pnpm check:audio and pnpm check:v1. The latter confirmed the exact V1 source revision, live mode, enabled STT and all four locales with zero Gnani calls. Five tests cover monitor drift/failure behaviour and import safety.

The first V2 engine milestone passed pnpm verify with **52 tests**, type checking and production build, then all 60 audio checksums. The V1 health check could not complete inside the network-restricted sandbox; rerunning that public GET with network access passed at 05:59:46 UTC and confirmed unchanged V1 identity. New coverage comprises eight controller tests, eight caller-adapter tests, sixteen safety tests and four fixture integration tests. All model outputs in these tests are explicit fixtures, with zero provider requests.

Live V2 conversation, runtime synthesis, durable budgets, admin authentication, streaming, a V2 UI and physical-device acceptance remain unverified. The prepared-turn function requires a durable operation lease and expected-turn commit from its future owner; it does not implement distributed idempotency by itself. Lexical safety tests do not establish real-world model accuracy or complete multilingual semantic safety.
