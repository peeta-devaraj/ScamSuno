# Technical decisions

## Scope and priority

The first release covers the KYC freeze scenario in English and Hindi. The first executable vendor gate was a small bilingual Timbre-to-Prisma REST round trip. It verified both Prisma versions and Timbre v3.0 with Avinash in both languages. Longer recordings, concurrency, tags, noisy conditions and human listening remain separate checks.

The repository uses one Next.js application with Node.js routes, stateless sessions, a TypeScript dialogue graph, Zod validation and static audio. CSS and native Node tests keep the dependency list short. A focused Playwright suite covers high-value browser journeys. The large audio evaluation and additional scenarios are deferred until the provider and device gates pass.

## Dialogue and safety

- The digit rule in MVP.md D6 and §8.1 is superseded. Only a whole, unquoted 4–8 digit reply can short-circuit during an OTP demand. The shortcut accepts separated digits and supported number words. A contextual run of four or more digits cannot produce model-based compliance. This deliberately abstains on some real disclosures expressed in a longer sentence.
- An explicit commitment without a contextual code can still count as compliance if the model meets the confidence and evidence checks. Replies with clear negation that the model labels compliance become unclear. A speech recognizer can drop verbal context, so the confirmation step shows the transcript before the participant sends it.
- Missing provider configuration and provider errors leave the graph at the current turn. The user can choose an explicit quick reply. Ordinary unclear replies reprompt and can eventually end the call without scoring the unresolved behaviour.
- A code request counts toward the protection criterion when a resolved reply follows it. An ending caused by uncertainty cannot itself earn or lose exit points. Acknowledging a request, ending the call, asking a question, or refusing are resolved actions.
- Voice confirmation includes a short-lived, server-generated HMAC covering the transcript, locale and Prisma metadata. The per-session snapshot is bounded and schema-validated. It remains browser-owned and self-reported. Result links contain grades and outcomes, and carry no identity or proof of completion.
- Caller audio is loaded sequentially from the Timbre manifest. Missing or failed playback is labelled and captions remain readable. The build can be previewed with captions, and production requires a complete set of generated audio.
- Official safety links and short quotes are used in the debrief, separately from fictional caller dialogue. RBI’s safeguards page and the MHA release were verified on November 6, 2026.

## Operational limits

Prisma and the classifier are separate upstream calls. The route returns safe error messages and never includes raw upstream error strings. STT uses a fixed Gnani host, an overall deadline, bounded retries and a per-instance IP hash limiter. The `STT_ENABLED` switch pauses public voice if credits run low.

The browser uses a single AudioContext for recording and playback. The Answer click resumes it for browsers that require a gesture. AudioWorklet captures mono PCM, and the encoder creates 16 kHz WAV. This path requires secure context, except for localhost development.

The abbreviated live probe is a functional check and cannot support claims about transcription accuracy or latency across users. Fixture-based tests validate application behaviour.
