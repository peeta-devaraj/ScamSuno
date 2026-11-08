import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import config from "../config/gnani.json";
import { encodeWav, readWav } from "../src/domain/wav";
import { initializeLedger, setPolicy, usageSummary, type UsagePolicy } from "../src/server/v2/ledger";
import { claimTurn, createStoredSession, endStoredSession, initializeSessions } from "../src/server/v2/sessions";
import { createSpeechGateway, SpeechError } from "../src/server/v2/speech";
import type { Locale } from "../src/domain/scenario";

const testKey = "fixture-only-never-live-gnani-key";
const wav = (seconds = 1) => encodeWav(new Float32Array(Math.floor(16_000 * seconds)).fill(0.05), 16_000);
const transcript = (changes: object = {}) => Response.json({ success: true, transcript: "நான் மறுக்கிறேன்",
  model: "prisma-v3.0", request_id: "fixture-request", detected_language_code: "ta-IN", truncated: false, ...changes });
const clip = (audio: Uint8Array = wav(), headers: HeadersInit = { "content-type": "audio/wav" }) => new Response(Uint8Array.from(audio), { headers });
const hasCode = (code: string) => (error: unknown) => error instanceof SpeechError && error.code === code && error.message === code;

async function fixture(t: TestContext, locale: Locale = "ta", policy = true) {
  const previous = new Map(["V2_LIVE_ENABLED", "GNANI_API_KEY", "GNANI_MODE", "STT_ENABLED"].map((name) => [name, process.env[name]]));
  t.after(() => { for (const [name, value] of previous) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  } });
  Object.assign(process.env, { V2_LIVE_ENABLED: "true", GNANI_API_KEY: testKey, GNANI_MODE: "live", STT_ENABLED: "true" });
  const client = createClient({ url: ":memory:" });
  t.after(() => client.close());
  await initializeLedger(client);
  await initializeSessions(client);
  if (policy) {
    const now = Date.now();
    const value: UsagePolicy = { enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 86_400_000,
      verifiedCreditFloor: 4_000, reserveCredits: 1_000, maxGnaniRequests: 20, maxGnaniRequestsPerDay: 20,
      maxLLMRequests: 20, maxLLMRequestsPerDay: 20, maxRequestsPerSession: 40, maxConcurrent: 2,
      maxSTTSeconds: 20, maxTTSChars: 420 };
    await setPolicy(client, value);
  }
  const opened = await createStoredSession(client, locale);
  const identity = { sessionId: opened.session.sessionId, expectedTurn: 0, operationId: randomUUID() };
  return { client, identity, session: opened.session, secret: opened.secret };
}

/** The gateway's first transaction reads the session; its second commits the reservation. */
function afterReservation(client: Client, action: () => Promise<void> | void) {
  let transactions = 0;
  return new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args);
      const ordinal = ++transactions;
      return new Proxy(tx, { get(transaction, key) {
        if (key === "commit") return async () => { await transaction.commit(); if (ordinal === 2) await action(); };
        const value = Reflect.get(transaction, key);
        return typeof value === "function" ? value.bind(transaction) : value;
      } });
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}

test("speech refuses missing keys, disabled live mode, mocks and an unreconciled policy without HTTP", async (t) => {
  const { client, identity } = await fixture(t, "ta", false);
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async () => { calls++; return transcript(); });
  await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_DISABLED"));
  for (const [name, value] of [["V2_LIVE_ENABLED", "false"], ["GNANI_API_KEY", ""], ["GNANI_MODE", "mock"], ["STT_ENABLED", "false"]]) {
    const before = process.env[name];
    process.env[name] = value;
    await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_DISABLED"));
    process.env[name] = before;
  }
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
});

test("Prisma sends one server-configured multipart request and retains only bounded provenance", async (t) => {
  const { client, identity } = await fixture(t);
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async (url, options) => {
    calls++;
    assert.equal(url, "https://api.vachana.ai/stt/v3");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("X-API-Key-ID"), testKey);
    assert.match(headers.get("X-API-Request-ID") ?? "", /^[a-f0-9-]{36}$/);
    assert.equal(headers.has("content-type"), false);
    const form = options?.body as FormData;
    assert.equal(form.get("language_code"), "ta-IN,en-IN");
    assert.equal(form.get("model"), config.stt.primaryModel);
    assert.equal(form.get("format"), config.stt.format);
    assert.equal(form.get("keyterms"), JSON.stringify(config.stt.keyterms));
    const file = form.get("audio_file") as File;
    assert.equal(file.name, "reply.wav");
    assert.equal(file.type, "audio/wav");
    assert.equal(readWav(new Uint8Array(await file.arrayBuffer()))?.seconds, 1);
    assert.equal((await usageSummary(client, Date.now())).byStatus.dispatched, 1);
    return transcript({ transcript: 'I refuse to share "482197".' });
  });
  const result = await gateway.transcribe(wav());
  assert.deepEqual(result, { transcript: 'I refuse to share "482197".', model: "prisma-v3.0",
    requestId: "fixture-request", detectedLanguage: "ta-IN" });
  assert.equal(calls, 1);
  const summary = await usageSummary(client, Date.now());
  assert.equal(summary.byStatus.succeeded, 1);
  assert.equal(summary.recent[0].audioSeconds, 1);
  assert.equal(summary.recent[0].providerRequestId, "fixture-request");
  assert.equal(JSON.stringify(summary).includes(result.transcript), false);
  assert.equal(JSON.stringify(summary).includes(testKey), false);
});

test("Timbre speaks only the stored caller caption using WAV PCM and server-owned locale", async (t) => {
  const { client, identity, session } = await fixture(t, "te");
  process.env.STT_ENABLED = "false";
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async (url, options) => {
    calls++;
    assert.equal(url, "https://api.vachana.ai/api/v1/tts/inference");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.text, session.lastCaller);
    assert.equal(body.language, "te-IN");
    assert.equal(body.model, config.tts.model);
    assert.equal(body.voice, config.tts.voice);
    assert.deepEqual(body.audio_config, { container: "wav", sample_rate: 16_000, num_channels: 1,
      sample_width: 2, encoding: "linear_pcm" });
    assert.equal((await usageSummary(client, Date.now())).byStatus.dispatched, 1);
    return clip();
  });
  const result = await gateway.synthesize();
  assert.equal(calls, 1);
  assert.equal(result.model, config.tts.model);
  assert.equal(result.voice, config.tts.voice);
  assert.equal(result.contentType, "audio/wav");
  assert.equal(readWav(result.audio)?.sampleRate, 16_000);
  const summary = await usageSummary(client, Date.now());
  assert.equal(summary.recent[0].textChars, session.lastCaller.length);
  assert.equal(JSON.stringify(summary).includes(session.lastCaller), false);
});

test("all selected locales come from the stored session, with English-only language coding for English", async (t) => {
  const { client } = await fixture(t);
  for (const locale of ["en", "hi", "ta", "te"] as const) {
    const opened = await createStoredSession(client, locale);
    const identity = { sessionId: opened.session.sessionId, expectedTurn: 0, operationId: randomUUID() };
    const gateway = createSpeechGateway(client, identity, async (_url, options) => {
      assert.equal((options?.body as FormData).get("language_code"), locale === "en" ? "en-IN" : `${locale}-IN,en-IN`);
      return transcript({ detected_language_code: `${locale}-IN` });
    });
    assert.equal((await gateway.transcribe(wav())).detectedLanguage, `${locale}-IN`);
  }
});

test("stage identifiers are distinct and durable replays never synthesize or transcribe twice", async (t) => {
  const { client, identity } = await fixture(t);
  let calls = 0;
  const transport: typeof fetch = async (url) => { calls++; return String(url).endsWith("/stt/v3") ? transcript() : clip(); };
  const gateway = createSpeechGateway(client, identity, transport);
  await gateway.transcribe(wav());
  await gateway.synthesize();
  const replay = createSpeechGateway(client, identity, transport);
  await assert.rejects(() => replay.transcribe(wav()), hasCode("V2_SPEECH_DUPLICATE"));
  await assert.rejects(() => replay.synthesize(), hasCode("V2_SPEECH_DUPLICATE"));
  const attempts = (await usageSummary(client, Date.now())).recent;
  assert.equal(calls, 2);
  assert.equal(new Set(attempts.map((attempt) => attempt.operationId)).size, 2);
  assert.ok(attempts.every((attempt) => attempt.operationId !== identity.operationId));
});

test("invalid identities, browser text/locale authority and malformed audio fail before reservation", async (t) => {
  const { client, identity } = await fixture(t);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return transcript(); };
  for (const candidate of [{ ...identity, expectedTurn: 11 }, { ...identity, sessionId: "bad" },
    { ...identity, text: "Unapproved caption" }, { ...identity, locale: "en" }]) {
    assert.throws(() => createSpeechGateway(client, candidate, transport), hasCode("V2_SPEECH_INVALID_REQUEST"));
  }
  const gateway = createSpeechGateway(client, identity, transport);
  const rate = wav();
  const rateView = new DataView(rate.buffer);
  rateView.setUint32(24, 8_000, true); rateView.setUint32(28, 16_000, true);
  const stereo = wav(); new DataView(stereo.buffer).setUint16(22, 2, true);
  const bits = wav(); new DataView(bits.buffer).setUint16(34, 8, true);
  for (const invalid of [new Uint8Array(0), wav(0.49), wav(15.01), new Uint8Array(600_001), rate, stereo, bits, wav().slice(0, -2)]) {
    await assert.rejects(() => gateway.transcribe(invalid), hasCode("V2_SPEECH_INVALID_REQUEST"));
  }
  await assert.rejects(() => gateway.synthesize("browser text" as unknown as AbortSignal), hasCode("V2_SPEECH_INVALID_REQUEST"));
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
});

test("HTTP errors never trigger retries or model fallbacks and remain spent failures", async (t) => {
  const { client, identity } = await fixture(t);
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async () => {
    calls++;
    return new Response(`private provider response ${testKey}`, { status: 429 });
  });
  await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_FAILED"));
  await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_FAILED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 2);
  assert.equal(summary.byStatus.failed, 2);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 2);
  assert.ok(summary.recent.every((attempt) => attempt.statusCode === 429));
});

test("invalid, oversized, truncated or unproven STT responses never become transcripts", async (t) => {
  const { client, identity } = await fixture(t);
  const responses = [() => transcript({ transcript: "x".repeat(501) }), () => transcript({ truncated: true }),
    () => transcript({ success: false }), () => transcript({ model: "unknown-model" }),
    () => transcript({ request_id: "private bad id" }), () => transcript({ detected_language_code: "invalid" }),
    () => new Response("invalid JSON", { headers: { "content-type": "application/json" } }),
    () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "65537" } }),
    () => new Response(" ".repeat(65_537), { headers: { "content-type": "application/json" } }),
  ];
  let calls = 0;
  for (const response of responses) {
    const gateway = createSpeechGateway(client, { ...identity, operationId: randomUUID() }, async () => { calls++; return response(); });
    await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_FAILED"));
  }
  assert.equal(calls, responses.length);
  assert.equal((await usageSummary(client, Date.now())).byStatus.failed, responses.length);
});

test("invalid audio types, corrupt WAVs, sample rates and oversized bodies are spent TTS failures", async (t) => {
  const { client, identity } = await fixture(t);
  const rate = wav(); const view = new DataView(rate.buffer);
  view.setUint32(24, 8_000, true); view.setUint32(28, 16_000, true);
  const responses = [() => clip(wav(), { "content-type": "application/octet-stream" }), () => clip(wav().slice(0, -2)),
    () => clip(rate), () => clip(new Uint8Array(2_000_001)),
    () => clip(wav(), { "content-type": "audio/wav", "content-length": "2000001" })];
  let calls = 0;
  for (const response of responses) {
    const gateway = createSpeechGateway(client, { ...identity, operationId: randomUUID() }, async () => { calls++; return response(); });
    await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_FAILED"));
  }
  assert.equal(calls, responses.length);
  assert.equal((await usageSummary(client, Date.now())).byStatus.failed, responses.length);
});

test("ended, stale and model-leased sessions never make a speech request", async (t) => {
  const { client, identity, secret } = await fixture(t);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return transcript(); };
  const stale = createSpeechGateway(client, { ...identity, expectedTurn: 1 }, transport);
  await assert.rejects(() => stale.transcribe(wav()), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  await claimTurn(client, secret, { sessionId: identity.sessionId, operationId: randomUUID(), expectedTurn: 0,
    reply: { origin: "typed", text: "I refuse" } });
  const leased = createSpeechGateway(client, identity, transport);
  await assert.rejects(() => leased.synthesize(), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  await endStoredSession(client, identity.sessionId, secret);
  await assert.rejects(() => leased.transcribe(wav()), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
});

test("End committed after reservation prevents atomic speech dispatch and releases quota", async (t) => {
  const { client, identity, secret } = await fixture(t);
  const wrapped = afterReservation(client, () => endStoredSession(client, identity.sessionId, secret).then(() => undefined));
  let calls = 0;
  const gateway = createSpeechGateway(wrapped, identity, async () => { calls++; return clip(); });
  await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.gnani.totalSinceReconciliation, 0);
});

test("a captured caption change or turn advance prevents dispatch of stale approved speech", async (t) => {
  const { client } = await fixture(t);
  let calls = 0;
  for (const change of ["caption", "locale", "turn"] as const) {
    const opened = await createStoredSession(client, "ta");
    const identity = { sessionId: opened.session.sessionId, expectedTurn: 0, operationId: randomUUID() };
    const wrapped = afterReservation(client, async () => {
      const current = { ...opened.session, ...(change === "caption" ? { lastCaller: "A changed approved caption." } : {}),
        ...(change === "locale" ? { locale: "te" } : {}) };
      await client.execute({ sql: change === "turn" ? "UPDATE v2_sessions SET turn_number=1 WHERE session_id=?"
        : "UPDATE v2_sessions SET state_json=? WHERE session_id=?",
      args: change === "turn" ? [identity.sessionId] : [JSON.stringify(current), identity.sessionId] });
    });
    const gateway = createSpeechGateway(wrapped, identity, async () => { calls++; return clip(); });
    await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  }
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).byStatus.released, 3);
});

test("pre-cancelled speech never reserves and cancellation after reserve releases quota", async (t) => {
  const { client, identity } = await fixture(t);
  const cancelled = new AbortController(); cancelled.abort("private cancellation reason");
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return transcript(); };
  await assert.rejects(() => createSpeechGateway(client, identity, transport).transcribe(wav(), cancelled.signal), hasCode("V2_SPEECH_CANCELLED"));
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
  const afterReserve = new AbortController();
  const wrapped = afterReservation(client, () => afterReserve.abort("private cancellation reason"));
  await assert.rejects(() => createSpeechGateway(wrapped, identity, transport).transcribe(wav(), afterReserve.signal), hasCode("V2_SPEECH_CANCELLED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.active, 0);
});

test("post-dispatch cancellation and network failures retain unknown holds without retries", async (t) => {
  const { client, identity } = await fixture(t);
  const controller = new AbortController();
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async () => {
    calls++; controller.abort(`private reason ${testKey}`); return new Promise(() => {});
  });
  await assert.rejects(() => gateway.transcribe(wav(), controller.signal), hasCode("V2_SPEECH_CANCELLED"));
  const failing = createSpeechGateway(client, identity, async () => { calls++; throw new Error(`private transport ${testKey}`); });
  await assert.rejects(() => failing.synthesize(), hasCode("V2_SPEECH_FAILED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 2);
  assert.equal(summary.byStatus.unknown, 2);
  assert.equal(summary.counters.active, 2);
});

test("settlement failure withholds transcription and durable dispatch blocks replay", async (t) => {
  const { client, identity } = await fixture(t);
  let transactions = 0;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      if (++transactions === 4) throw new Error(`private store ${testKey}`);
      return target.transaction(...args);
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  let calls = 0;
  const gateway = createSpeechGateway(wrapped, identity, async () => { calls++; return transcript(); });
  await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_FAILED"));
  await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_DUPLICATE"));
  assert.equal(calls, 1);
  assert.equal((await usageSummary(client, Date.now())).byStatus.dispatched, 1);
});

test("each speech stage has its documented deadline and a timed-out attempt retains its hold", async (t) => {
  const { client, identity } = await fixture(t);
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    deadlines.push(milliseconds);
    const controller = new AbortController();
    queueMicrotask(() => controller.abort("fixture deadline"));
    return controller.signal;
  });
  let calls = 0;
  const gateway = createSpeechGateway(client, identity, async () => { calls++; return new Promise(() => {}); });
  await assert.rejects(() => gateway.transcribe(wav()), hasCode("V2_SPEECH_CANCELLED"));
  await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_CANCELLED"));
  assert.deepEqual(deadlines, [15_000, 20_000]);
  assert.equal(calls, 2);
  assert.equal((await usageSummary(client, Date.now())).byStatus.unknown, 2);
});

test("session expiry while waiting for the dispatch transaction releases undispatched speech", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const { client, identity } = await fixture(t);
  let transactions = 0;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args);
      if (++transactions === 3) now += 8 * 60_000 + 1;
      return tx;
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  let calls = 0;
  const gateway = createSpeechGateway(wrapped, identity, async () => { calls++; return clip(); });
  await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_SESSION_INACTIVE"));
  const summary = await usageSummary(client, now);
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.active, 0);
});

test("configuration revocation and missing session storage after reserve fail closed without HTTP", async (t) => {
  const { client, identity } = await fixture(t);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return clip(); };
  const revoked = afterReservation(client, () => { process.env.GNANI_API_KEY = ""; });
  await assert.rejects(() => createSpeechGateway(revoked, identity, transport).synthesize(), hasCode("V2_SPEECH_DISABLED"));
  process.env.GNANI_API_KEY = testKey;
  const unavailable = afterReservation(client, () => client.execute("DROP TABLE v2_sessions").then(() => undefined));
  await assert.rejects(() => createSpeechGateway(unavailable, { ...identity, operationId: randomUUID() }, transport).synthesize(), hasCode("V2_SPEECH_FAILED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 2);
  assert.equal(summary.counters.active, 0);
});

test("the observed canonical Timbre streaming WAV is completed without changing its PCM samples", async (t) => {
  const { client, identity } = await fixture(t);
  // Synthetic PCM matches the observed response length/header; it is not provider audio.
  const regular = encodeWav(new Float32Array((297_004 - 44) / 2).fill(0.05), 16_000);
  assert.equal(regular.byteLength, 297_004);
  const streaming = Uint8Array.from(regular);
  const header = new DataView(streaming.buffer);
  header.setUint32(4, 0xffffffff, true);
  header.setUint32(40, 0xffffffff, true);
  assert.equal(readWav(streaming), null, "input/STT WAV validation remains strict");
  const gateway = createSpeechGateway(client, identity, async () => clip(streaming));
  const result = await gateway.synthesize();
  assert.deepEqual(readWav(result.audio), readWav(regular));
  assert.deepEqual(result.audio, regular);
  assert.deepEqual(result.audio.subarray(44), streaming.subarray(44));
  assert.equal(new DataView(streaming.buffer).getUint32(4, true), 0xffffffff, "provider buffer is never mutated");
  assert.equal((await usageSummary(client, Date.now())).byStatus.succeeded, 1);
  const canonical = createSpeechGateway(client, { ...identity, operationId: randomUUID() }, async () => clip(regular));
  assert.deepEqual((await canonical.synthesize()).audio, regular, "ordinary WAV bytes are unchanged");
});

test("streaming WAV near-matches, single sentinels and malformed PCM remain spent failures", async (t) => {
  const { client, identity } = await fixture(t);
  const streaming = () => {
    const bytes = wav(); const view = new DataView(bytes.buffer);
    view.setUint32(4, 0xffffffff, true); view.setUint32(40, 0xffffffff, true);
    return bytes;
  };
  const mutations = [
    (bytes: Uint8Array, view: DataView) => view.setUint32(4, bytes.byteLength - 8, true),
    (bytes: Uint8Array, view: DataView) => view.setUint32(40, bytes.byteLength - 44, true),
    (_bytes: Uint8Array, view: DataView) => view.setUint32(12, 0x4a554e4b),
    (_bytes: Uint8Array, view: DataView) => view.setUint32(16, 18, true),
    (_bytes: Uint8Array, view: DataView) => view.setUint16(20, 3, true),
    (_bytes: Uint8Array, view: DataView) => view.setUint16(22, 2, true),
    (_bytes: Uint8Array, view: DataView) => { view.setUint32(24, 8_000, true); view.setUint32(28, 16_000, true); },
    (_bytes: Uint8Array, view: DataView) => view.setUint16(34, 8, true),
    (_bytes: Uint8Array, view: DataView) => view.setUint32(36, 0x4c495354),
    (_bytes: Uint8Array, view: DataView) => view.setUint32(28, 32_001, true),
    (_bytes: Uint8Array, view: DataView) => view.setUint16(32, 4, true),
  ];
  const rejected: Uint8Array[] = mutations.map((mutate) => {
    const bytes = streaming(); mutate(bytes, new DataView(bytes.buffer)); return bytes;
  });
  rejected.push(streaming().slice(0, -1), streaming().slice(0, 44));
  let calls = 0;
  for (const bytes of rejected) {
    const gateway = createSpeechGateway(client, { ...identity, operationId: randomUUID() }, async () => { calls++; return clip(bytes); });
    await assert.rejects(() => gateway.synthesize(), hasCode("V2_SPEECH_FAILED"));
  }
  assert.equal(calls, rejected.length);
  assert.equal((await usageSummary(client, Date.now())).byStatus.failed, rejected.length);
});
