# Preservation and V2 preparation results

On November 7, 2026 the exact V1 source at b3462ac0a9eeb809c7e870044baa291d4c1e378e passed type checking, 11 unit/route tests, a production build and all 60 audio checksums. The seven existing Chromium journeys passed in an isolated rerun. The initial parallel build/browser run had two language-selection failures and remains a stability finding.

The source ZIP was rebuilt independently from its extraction using the frozen lockfile. The build, 11 tests and audio checks passed. The downloaded immutable release ZIP matched its published digest.

Both the original application and the isolated recovery app after B-to-A rollback passed four outcomes, cards and four locale browser journeys. The retained recovery preview passed authenticated health checks. No Gnani calls were made by this checkpoint.

The isolated preparation branch passed pnpm verify with 16 tests, production build and type checking, followed by pnpm check:audio and pnpm check:v1. The latter confirmed the exact V1 source revision, live mode, enabled STT and all four locales with zero Gnani calls. Five tests cover monitor drift/failure behaviour and import safety.

The first V2 engine milestone passed pnpm verify with **52 tests**, type checking and production build, then all 60 audio checksums. The V1 health check could not complete inside the network-restricted sandbox; rerunning that public GET with network access passed at 05:59:46 UTC and confirmed unchanged V1 identity. New coverage comprises eight controller tests, eight caller-adapter tests, sixteen safety tests and four fixture integration tests. All model outputs in these tests are explicit fixtures, with zero provider requests.

Live V2 conversation, runtime synthesis, durable budgets, admin authentication, streaming, a V2 UI and physical-device acceptance remain unverified. The prepared-turn function requires a durable operation lease and expected-turn commit from its future owner; it does not implement distributed idempotency by itself. Lexical safety tests do not establish real-world model accuracy or complete multilingual semantic safety.

The V2 branch's seven existing browser journeys initially failed at launch because Playwright's bundled Chromium headless shell was absent. Setting PLAYWRIGHT_CHROME to the installed Chrome executable and rerunning with loopback permission passed **7/7 in 41.9 seconds**, without source changes or provider requests.

The storage milestone's seven focused session-store tests passed against real SQLite files, including reopen persistence, owner authentication, simultaneous claims, replay, hangup racing completion, expiry, stale leases, masking and transaction rollback. Initial tests exposed a Windows temporary path containing `#` (fixed using pathToFileURL) and transient file cleanup locks (bounded fs.rm retries).

Final storage/gateway checkpoint passed **pnpm verify with 110 tests**, type checking and production build. This includes twenty-two ledger tests, thirteen gateway tests, five conversation HTTP tests, six auth tests, three usage HTTP tests and runtime initialization recovery. Review reproduced extra dispatch after End, blocked End after disabling/limiting inference, and stale admission time after queue waits; regression fixes passed. A sandboxed build failed on Windows junction permissions; the permitted build and final verification passed. All 60 audio checks passed; V1 identity remained b3462ac at 11:40:20 UTC.

The actual isolated Turso store passed remote checks at **11:44:45 UTC**: one of four simultaneous turn claims admitted, exactly two of five bounded reservations admitted, both released before dispatch, authenticated End/readback successful, zero outstanding attempts and admission closed afterward. The test records explicitly identify development fixtures. **Zero Gnani/LLM requests** were made. The deployed preview, live conversational quality, runtime speech and physical-device acceptance remain pending.
