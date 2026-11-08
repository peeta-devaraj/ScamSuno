# Preservation and V2 preparation results

## Integrated local acceptance — November 8

`pnpm verify` passed type checking, **172 tests** and a production build. `pnpm test:e2e` passed **14 browser journeys in 52.2 seconds** after the final UI changes, using installed Chrome, labelled protocol fixtures and generated microphone signal input. Static audio manifest/checksum checks passed. A credential-value scan passed source and browser bundles. V1 health at `2026-11-08T08:35:19.413Z` confirmed the exact preserved commit, live STT configuration, 60 assets and four locales with zero inference calls.

Review found and fixed cookie-only transcript signing: proofs now also require a dedicated server-only key. A regression test rejects a forgery calculated from the owner cookie and signatures made with another server key. The new key was explicitly authorized and stored as sensitive in V2 Preview only. These checks do not establish deployed human voice quality or physical Android/iOS compatibility.

On November 7, 2026 the exact V1 source at b3462ac0a9eeb809c7e870044baa291d4c1e378e passed type checking, 11 unit/route tests, a production build and all 60 audio checksums. The seven existing Chromium journeys passed in an isolated rerun. The initial parallel build/browser run had two language-selection failures and remains a stability finding.

The source ZIP was rebuilt independently from its extraction using the frozen lockfile. The build, 11 tests and audio checks passed. The downloaded immutable release ZIP matched its published digest.

Both the original application and the isolated recovery app after B-to-A rollback passed four outcomes, cards and four locale browser journeys. The retained recovery preview passed authenticated health checks. No Gnani calls were made by this checkpoint.

The isolated preparation branch passed pnpm verify with 16 tests, production build and type checking, followed by pnpm check:audio and pnpm check:v1. The latter confirmed the exact V1 source revision, live mode, enabled STT and all four locales with zero Gnani calls. Five tests cover monitor drift/failure behaviour and import safety.

The first V2 engine milestone passed pnpm verify with **52 tests**, type checking and production build, then all 60 audio checksums. The V1 health check could not complete inside the network-restricted sandbox; rerunning that public GET with network access passed at 05:59:46 UTC and confirmed unchanged V1 identity. New coverage comprises eight controller tests, eight caller-adapter tests, sixteen safety tests and four fixture integration tests. All model outputs in these tests are explicit fixtures, with zero provider requests.

At that first engine checkpoint, live V2 conversation, runtime synthesis, durable budgets, admin authentication and a V2 UI were still pending. Subsequent sections record later evidence. Streaming and physical-device acceptance remain unverified. Lexical safety tests do not establish real-world model accuracy or complete multilingual semantic safety.

The V2 branch's seven existing browser journeys initially failed at launch because Playwright's bundled Chromium headless shell was absent. Setting PLAYWRIGHT_CHROME to the installed Chrome executable and rerunning with loopback permission passed **7/7 in 41.9 seconds**, without source changes or provider requests.

The storage milestone's seven focused session-store tests passed against real SQLite files, including reopen persistence, owner authentication, simultaneous claims, replay, hangup racing completion, expiry, stale leases, masking and transaction rollback. Initial tests exposed a Windows temporary path containing `#` (fixed using pathToFileURL) and transient file cleanup locks (bounded fs.rm retries).

Final storage/gateway checkpoint passed **pnpm verify with 110 tests**, type checking and production build. This includes twenty-two ledger tests, thirteen gateway tests, five conversation HTTP tests, six auth tests, three usage HTTP tests and runtime initialization recovery. Review reproduced extra dispatch after End, blocked End after disabling/limiting inference, and stale admission time after queue waits; regression fixes passed. A sandboxed build failed on Windows junction permissions; the permitted build and final verification passed. All 60 audio checks passed; V1 identity remained b3462ac at 11:40:20 UTC.

The actual isolated Turso store passed remote checks at **11:44:45 UTC**: one of four simultaneous turn claims admitted, exactly two of five bounded reservations admitted, both released before dispatch, authenticated End/readback successful, zero outstanding attempts and admission closed afterward. The test records explicitly identify development fixtures. **Zero Gnani/LLM requests** were made. The deployed preview, live conversational quality, runtime speech and physical-device acceptance remain pending.

## Subsequent real text probes

Eighteen actual Groq requests have now been made under the ledger, with Gnani admission kept at zero. The first two Tamil attempts (four requests) returned HTTP 200 but caller text triggered the credential-content guard; authored fallback was correctly used. The caller prompt was tightened to exclude even benign credential terms. One Tamil and one Telugu single-turn probe then passed with hosted caller output (four requests). Each language subsequently completed three committed turns: two hosted caller replies and a model-recognized hangup (ten requests). All ten returned HTTP 200. These were authored typed development inputs; no human voice transcript, native-language accuracy result or latency benchmark is claimed.

The Tamil second question was labelled ACKNOWLEDGE by the evaluator; verification intent in the hangup replies remained conservatively unscored. These observations are retained as quality limitations. The resulting generated replies and actual statuses are in ignored local probe evidence. Every probe closed/killed admission afterward. At the end of the typed-probe milestone, V2 had not yet run Gnani inference.

## Real runtime speech and owned voice confirmation

The first two actual Timbre requests returned HTTP 200 with complete PCM WAV bodies whose RIFF and data lengths were both `0xFFFFFFFF`. The strict validator rejected them; those attempts remain spent. A diagnostic response was 297,004 bytes, PCM format 1, mono, 16 kHz, 16-bit with a canonical 44-byte header. The implementation now normalizes only this complete, bounded, canonical unknown-size form, filling lengths from the actual body without changing PCM. Other malformed formats remain rejected. Participant/STT input validation was not relaxed.

After that fix, Tamil and Telugu real Timbre → Prisma synthetic loopbacks succeeded. The complete voice-handler journey was recorded at **2026-11-08T03:52:21.044Z**. For each locale, real Timbre generated an explicitly authored fictional participant question; the owned session supplied its opening audio; real Prisma v3.0 transcribed the synthetic question; the signed unchanged transcript was accepted as `voice`; the real Groq caller/evaluator produced a validated hosted response; real runtime Timbre returned valid response audio; and the participant End action returned an educational score. All audio remained in memory. No human microphone or physical listening result is claimed.

The actual masked Prisma transcripts were Tamil “நீங்கள் யார், எதற்காக அவசரமாக அழைக்கிறீர்கள்?” and Telugu “మీరు ఎవరు? ఇంత తొందర ఎందుకు?” These are observed synthetic loopback outputs, not invented human transcripts or an accuracy dataset. Each ended result marked secret protection `NOT_TESTED`, independent verification `PARTIAL` and safe exit `PASS`. Untested secret protection was excluded from the denominator. The caller output was hosted in both cases. These two selected questions do not establish native-language fluency, broad recognition accuracy or multi-turn human usability.

The final voice checkpoint reported **14 Gnani attempts**, **22 Groq attempts**, **zero active operations** and **admission closed**. Totals include failed/rejected attempts; exact provider credits remain unknown. The official dashboard's later visible 110-request total does not fully account for the application attempt ledger, so full billing reconciliation remains pending. No benchmark or per-session cost is inferred.

## Focused integration checks after the 110-test checkpoint

Focused speech/voice checks passed 33 speech and HTTP cases, six signed-proof cases and six conversation HTTP cases, including changed transcripts losing voice provenance. Ledger recovery passed eleven new cases plus the existing twenty-two ledger cases. Versioned-share checks preserved V1 compatibility and passed fourteen combined domain/share cases. Actual localized card rendering returned valid 1200 × 630 PNGs for all four locales. These focused results are separate from the complete verification checkpoint and are not added into an invented overall test total.

The new mobile UI and its fixture browser journeys are under verification. A current full `pnpm verify`, all browser journeys, audio manifest gate, V1 identity check, protected Preview acceptance and physical Android/iOS checks remain release gates. Browser fixtures and synthetic microphone audio must remain labelled as such.
