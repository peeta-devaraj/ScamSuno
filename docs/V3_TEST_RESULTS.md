# V3 verification evidence

## Complete development checkpoint

The final integrated `pnpm verify` passed **255 tests**, type checking and production build. All **23 browser journeys** passed (14 preserved V1/V2 journeys and nine V3 journeys); the nine V3 cases passed again after adding stronger checks that End is initially visible in mobile viewports. Tests use explicit fixtures, not live V3 providers. Tamil screenshots were visually reviewed without horizontal overflow. A credential-value scan passed 251 source/browser-bundle files.

Coverage now includes V3 HTTP privacy/ownership, all scenarios, scenario-specific pressure rejection, shared voice adapters, signed voice confirmation, real SQLite persistence, atomic quota/lease/pause guards, V3-only durable rollback, private administration, typed edits, microphone denial, late response/End races, post-End verification, four locales and mobile debrief. The built route list includes `/v3`, `/api/v3/conversation`, `/api/v3/stt`, `/api/v3/tts` and `/admin/v3`.

The user deferred further live-provider and physical-device testing on November 8. No V3 provider call, human microphone result, pilot result or effectiveness benchmark is claimed. Earlier checkpoint details below remain historical evidence.

Before V3 application implementation on November 8, the exact preserved V2 source passed type checking, all 172 tests, production build, 14 browser journeys in 50.8 seconds, and static audio checks. Browser tests use explicit fixtures and generated signal audio; they are not physical-phone or live conversation evidence.

The read-only remote V2 snapshot contained seven tables. A separate in-memory SQLite restoration recreated the tables/indexes and reproduced every row. Source bundle verification and DPAPI encrypt/decrypt readback passed. V1 health retained its exact preserved commit. Protected V2 pages/admin returned expected 200/401 responses and paid endpoints remained 503/closed. These checks consumed zero provider requests.

V3 live voice, deployed journeys and physical-phone acceptance have not been performed. No educational-effectiveness or recognition-accuracy claim is established.

## First implementation checkpoint

The integrated `pnpm verify` run passed type checking, 222 then-present tests and production build. A final persistence fix/test landed during that run; afterward all **51 current V3 tests** passed together, including that new unchanged-state failure-recovery case. Do not describe this as one 223-test run. The preserved 172-test V2 baseline and its 14 browser journeys were independently rerun before implementation.

V3 tests cover all three assignments/four locales, strict hidden-state projection, seeded fixtures, conservative evidence and category-independent feedback, actual SQLite ownership/leases/replay/End races, independent verification after End, file reopen, injected caller/evaluator requests and bounded fixture text conversations. No hosted V3 model or speech response was used. The production build still exposes only the existing routes; V3 HTTP, voice and UI wiring are not implemented yet.

After this milestone, V1 health at `2026-11-08T09:18:25.937Z` retained the exact production commit, four locales and 60 clips, with zero provider calls.
