# Voice transport research

Reviewed: November 7, 2026. This is a design input, not a provider benchmark or an implementation-completion report. Tamil (`ta-IN`) and Telugu (`te-IN`) are release priorities alongside English (`en-IN`) and Hindi (`hi-IN`).

## Evidence and recommendation

**Documented** means an official source describes a capability. **Observed** means this research task directly inspected it. **Unverified** means it still needs an account-specific or device test.

Observed: the baseline repository contains a Next.js application, a Prisma REST adapter, a native browser PCM recorder, static Timbre audio, and four locale implementations. This task made **zero speech or LLM inference calls**. Existing probe results belong to their original evidence records; they do not verify streaming, dynamic dialogue, current balances, or mobile performance.

**Recommendation (engineering judgment):** first complete the existing recorder -> Prisma REST -> contextual LLM -> whole-response safety validation -> runtime Timbre REST -> playback loop. This minimizes infrastructure changes while making the conversation dynamic. Then test Timbre SSE; add streaming STT and interruption only after the complete loop and durable budget gate work. No latency or cost advantage is claimed without measurement. The [Gnani index](https://docs.gnani.ai/llms.txt) links the [REST transcription](https://docs.gnani.ai/api/STT/speech-to-text) and [REST synthesis](https://docs.gnani.ai/api/TTS/tts-inference) references.

## Documented transport capabilities

### Prisma WebSocket STT

Endpoint: `wss://api.vachana.ai/stt/v3/stream`. Authentication uses the server-side `x-api-key-id` upgrade header. Current configuration names include `language_code`, `model`, and `format`; legacy header spellings remain accepted. Prisma v3.0 accepts one to four language hints, so selected-language plus English hints are possible for Tamil and Telugu. Stream mono signed 16-bit little-endian PCM, not successive WAV files. The documented 16 kHz example sends 1,024-byte frames every 32 ms. VAD emits speech-boundary/transcript events; `commit` can finalize buffered audio. Sessions have a 15-minute limit, a configurable idle limit, and an organization-specific concurrency cap. These are documented capabilities; this account's entitlement, cap, recognition quality, and latency remain unverified. [Gnani STT streaming reference](https://docs.gnani.ai/api/STT/stt-websocket)

### Timbre SSE and WebSocket TTS

SSE uses `POST https://api.vachana.ai/api/v1/tts/sse` with `X-API-Key-ID` and JSON. Events include `start`, base64 audio `chunk`, `complete`, and `error`; completion can contain empty audio. Raw PCM and MP3 are documented. OGG arrives as one complete chunk, so it cannot demonstrate progressive delivery. A server-side streaming POST and browser `fetch` stream suit this interface; test audio decoding, event fragmentation, ordering, and cancellation before claiming progressive playback. [Gnani SSE reference](https://docs.gnani.ai/api/TTS/tts-sse)

WebSocket synthesis uses `wss://api.vachana.ai/api/v1/tts`, an API-key upgrade header, JSON synthesis requests, and base64 audio messages ending with `is_final`. Send one synthesis request at a time. Timbre v3.0 documents Tamil, Telugu, English, and Hindi among ten supported languages, with every v3.0 voice supporting all ten. Use the chosen locale explicitly; speech quality and voice preference need listening tests. [Gnani realtime TTS reference](https://docs.gnani.ai/api/TTS/tts-websocket)

### LiveKit and Pipecat

`livekit-plugins-gnani` provides Prisma REST/WebSocket and Timbre REST/SSE/WebSocket adapters for LiveKit Agents, requiring Python 3.10+. The Gnani key authenticates speech calls; the application's room transport, agent hosting, and LLM remain separate concerns. This would introduce an additional service beyond the existing Next.js app. [Gnani LiveKit plugin](https://docs.gnani.ai/livekit/introduction)

`pipecat-gnani` provides REST and WebSocket STT plus REST, SSE, and interruptible WebSocket TTS service classes. Its documented requirements are Python 3.11+ and Pipecat 1.x (`>=1.5,<2`), using `gnani-vachana>=0.9`. It adds pipeline/transport lifecycle work. Neither framework integration has been installed or tested here. Consider either after evidence shows it solves a measured interruption or transport problem. [Gnani Pipecat plugin](https://docs.gnani.ai/pipecat/introduction)

### Vercel compatibility

Vercel's October 20, 2026 changelog announces WebSocket general availability. Its knowledge-base page still says beta, so official descriptions are inconsistent. The substantive guide documents native Fluid Compute WebSockets, connection pinning to one invocation, duration limits, and external shared state. Reconnects must tolerate another instance; memory-only quotas are insufficient. [GA announcement](https://vercel.com/changelog/websocket-support-is-now-generally-available), [connection and limit guide](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)

The Next.js example currently uses `experimental_upgradeWebSocket` from `@vercel/functions` with `ws`, and requires `vercel dev` for local upgrade testing. Validate the installed framework/adapter combination in an isolated preview before adopting it. Platform support is not proof that this application already supports streaming. [Official Next.js example](https://vercel.com/kb/guide/real-time-chat-websockets)

## Billing, credentials, and unresolved gates

No supported Gnani balance, per-request charge, or streaming-billing endpoint was found in the reviewed [public documentation index](https://docs.gnani.ai/llms.txt). This is a search result, not proof that no API exists. The [official challenge page](https://www.gnani.ai/internship) directs participants to the [API dashboard](https://app.gnani.ai) to track credits. Treat the brief's 4,989-credit figure as provisional until reconciled. Count real attempts in a durable ledger; do not invent a credit conversion.

Needed before live V2 admission: a server-only Gnani credential with verified endpoint access; a separately authorized hosted-LLM credential and chosen model; a durable quota store; admin authentication; and a timestamped balance reconciliation plus conservative limits protecting V1's reserve. Provider charges and LLM charges must remain separate. Neither this research nor vendor throughput claims establish Tamil/Telugu conversation quality.

**Blocked for live V2:** account-specific endpoint access, authorized LLM credentials, and the current official balance were not verified by this task. Request quotas bound traffic but cannot prove a numeric credit reserve without a verified charge bound or reconciled consumption. Keep credit estimates unknown until that evidence exists.

Start with no provider credentials in V2 preview and explicit development fixtures. Exercise schema rejection, quotations/refusals, cancellation, timeouts, and concurrent quota admission without paid calls. Production must reject fixture mode. Before a bounded live probe, reserve its allowance atomically, establish the current balance, and record timings/statuses without recordings or reply text. Never present fixtures as API evidence.
