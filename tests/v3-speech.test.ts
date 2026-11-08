import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { encodeWav } from "../src/domain/wav";
import { initializeLedger, setPolicy, usageSummary } from "../src/server/v2/ledger";
import { createHostedGateway } from "../src/server/v2/hosted";
import { claimTurn, createStoredSession, endStoredSession, hasActiveTurnLease, initializeSessions } from "../src/server/v3/sessions";
import { createV3SpeechGateway, liveV3VoiceMode } from "../src/server/v3/speech";
import { liveTrustOrTrapMode } from "../src/server/v3/config";
import { pauseV3 } from "../src/server/v3/control";
import { createSpeechGateway } from "../src/server/v2/speech";
import { createStoredSession as createV2Session, initializeSessions as initializeV2Sessions } from "../src/server/v2/sessions";

const wav = () => encodeWav(new Float32Array(16000).fill(0.05), 16000);
async function fixture(t: TestContext, policy = true) {
  const values = { V2_LIVE_ENABLED: "true", V3_TRUST_OR_TRAP_ENABLED: "true", GNANI_API_KEY: "explicit-synthetic-key", GNANI_MODE: "live", STT_ENABLED: "true",
    LLM_API_KEY: "explicit-model-fixture", LLM_BASE_URL: "https://api.groq.com/openai/v1", LLM_MODEL: "openai/gpt-oss-20b", V2_VOICE_PROOF_SECRET: "c".repeat(64) };
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const key of Object.keys(values)) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; });
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeLedger(client); await initializeSessions(client);
  const now = Date.now();
  if (policy) await setPolicy(client, { enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 86400000, verifiedCreditFloor: 4000, reserveCredits: 1000,
    maxGnaniRequests: 10, maxGnaniRequestsPerDay: 10, maxLLMRequests: 10, maxLLMRequestsPerDay: 10, maxRequestsPerSession: 20, maxConcurrent: 2, maxSTTSeconds: 15, maxTTSChars: 420 });
  const created = await createStoredSession(client, "ta", now, () => 0);
  return { client, ...created, context: { sessionId: created.session.sessionId, expectedTurn: 0, operationId: crypto.randomUUID() } };
}
function afterCommit(client: Client, ordinal: number, action: () => Promise<void> | void): Client {
  let count = 0;
  return new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args), current = ++count;
      return new Proxy(tx, { get(transaction, key) {
        if (key === "commit") return async () => { await transaction.commit(); if (current === ordinal) await action(); };
        const value = Reflect.get(transaction, key); return typeof value === "function" ? value.bind(transaction) : value;
      } });
    };
    const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
  } });
}

test("V3 reuses Prisma/Timbre transport with its own server-owned session and the shared durable ledger", async (t) => {
  const f = await fixture(t); let calls = 0;
  const gateway = createV3SpeechGateway(f.client, f.context, async (url, options) => {
    calls++;
    if (String(url).endsWith("/stt/v3")) return Response.json({ success: true, transcript: "நான் தனியாகச் சரிபார்ப்பேன்", model: "prisma-v3.0", request_id: "explicit-synthetic-response" });
    const body = JSON.parse(String(options?.body));
    assert.equal(body.text, f.session.lastCaller); assert.equal(body.language, "ta-IN");
    assert.ok(!JSON.stringify(body).includes("routine_update"));
    return new Response(wav(), { headers: { "content-type": "audio/wav" } });
  });
  assert.equal((await gateway.transcribe(wav())).requestId, "explicit-synthetic-response");
  assert.equal((await gateway.synthesize()).contentType, "audio/wav");
  await assert.rejects(() => gateway.synthesize(), { code: "V2_SPEECH_DUPLICATE" });
  assert.equal(calls, 2);
  const usage = await usageSummary(f.client, Date.now());
  assert.equal(usage.byKind.gnani_stt, 1); assert.equal(usage.byKind.gnani_tts, 1); assert.equal(usage.counters.active, 0);
  assert.equal((await f.client.execute("SELECT name FROM sqlite_master WHERE name='v2_sessions'")).rows.length, 0);
});

test("V2 live flag alone, disabled V3, missing proof/STT or unreconciled quota never admit V3 speech", async (t) => {
  const f = await fixture(t, false); let calls = 0;
  const gateway = createV3SpeechGateway(f.client, f.context, async () => { calls++; throw Error("must not call"); });
  await assert.rejects(() => gateway.transcribe(wav()), { code: "V2_SPEECH_DISABLED" });
  for (const key of ["V3_TRUST_OR_TRAP_ENABLED", "STT_ENABLED", "V2_VOICE_PROOF_SECRET"]) {
    const prior = process.env[key]; process.env[key] = "";
    assert.equal(liveV3VoiceMode(), null);
    await assert.rejects(() => gateway.synthesize(), { code: "V2_SPEECH_DISABLED" }); process.env[key] = prior;
  }
  assert.equal(calls, 0); assert.equal((await usageSummary(f.client, Date.now())).recent.length, 0);
});

test("V3 End or feature-off between reservation and atomic speech dispatch releases undispatched allowance", async (t) => {
  for (const stop of ["end", "flag"] as const) {
    const f = await fixture(t); let calls = 0;
    const proxy = afterCommit(f.client, 2, async () => { if (stop === "end") await endStoredSession(f.client, f.session.sessionId, f.secret); else process.env.V3_TRUST_OR_TRAP_ENABLED = "false"; });
    const gateway = createV3SpeechGateway(proxy, f.context, async () => { calls++; throw Error("must not call"); });
    await assert.rejects(() => gateway.synthesize());
    assert.equal(calls, 0); const usage = await usageSummary(f.client, Date.now());
    assert.equal(usage.byStatus.released, 1); assert.equal(usage.counters.active, 0);
    process.env.V3_TRUST_OR_TRAP_ENABLED = "true";
  }
});

test("V3 model leases block concurrent speech and shared hosted transport dispatches only under a V3 lease", async (t) => {
  const f = await fixture(t), op = { ...f.context, operationId: crypto.randomUUID(), reply: { origin: "typed" as const, text: "Who are you?" } };
  await claimTurn(f.client, f.secret, op);
  let speechCalls = 0;
  await assert.rejects(() => createV3SpeechGateway(f.client, f.context, async () => { speechCalls++; throw Error("not called"); }).synthesize(), { code: "V2_SPEECH_SESSION_INACTIVE" });
  assert.equal(speechCalls, 0);
  let calls = 0;
  const gateway = createHostedGateway(f.client, { sessionId: f.session.sessionId, turnOperationId: op.operationId }, async () => {
    calls++; return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"fixture":true}' } }] });
  }, { hasActiveTurnLease, enabled: () => Boolean(liveTrustOrTrapMode()) });
  const request = { purpose: "caller" as const, messages: [{ role: "system" as const, content: "Explicit synthetic fixture" }, { role: "user" as const, content: "Synthetic reply" }], maxTokens: 100, temperature: 0 };
  assert.equal(await gateway.execute(request), '{"fixture":true}'); assert.equal(calls, 1);
  await endStoredSession(f.client, f.session.sessionId, f.secret);
  await assert.rejects(() => gateway.execute({ ...request, purpose: "evaluator" }));
  assert.equal(calls, 1);
});

test("shared hosted gateway checks mode again inside atomic dispatch, not only before reservation", async (t) => {
  const f = await fixture(t), op = { ...f.context, operationId: crypto.randomUUID(), reply: { origin: "typed" as const, text: "Who are you?" } };
  await claimTurn(f.client, f.secret, op); let checks = 0, calls = 0;
  const gateway = createHostedGateway(f.client, { sessionId: f.session.sessionId, turnOperationId: op.operationId }, async () => { calls++; throw Error("not called"); },
    { hasActiveTurnLease, enabled: () => ++checks < 3 });
  await assert.rejects(() => gateway.execute({ purpose: "caller", messages: [{ role: "system", content: "Explicit fixture" }, { role: "user", content: "Synthetic reply" }], maxTokens: 100, temperature: 0 }));
  assert.equal(checks, 3); assert.equal(calls, 0);
  const usage = await usageSummary(f.client, Date.now()); assert.equal(usage.byStatus.released, 1); assert.equal(usage.counters.active, 0);
});

test("durable V3 pause after speech reservation blocks dispatch without changing V2 policy or blocking V2 speech", async (t) => {
  const f = await fixture(t), before = await usageSummary(f.client, Date.now()); let v3Calls = 0;
  const proxy = afterCommit(f.client, 2, () => pauseV3(f.client));
  const gateway = createV3SpeechGateway(proxy, f.context, async () => { v3Calls++; throw Error("not called"); });
  await assert.rejects(() => gateway.synthesize());
  assert.equal(v3Calls, 0);
  const paused = await usageSummary(f.client, Date.now());
  assert.deepEqual(paused.policy, before.policy);
  assert.equal(paused.byStatus.released, 1); assert.equal(paused.counters.active, 0);
  assert.equal(paused.counters.gnani.totalSinceReconciliation, 0);
  await assert.rejects(() => createV3SpeechGateway(f.client, { ...f.context, operationId: crypto.randomUUID() }, async () => { v3Calls++; throw Error("not called"); }).transcribe(wav()));
  assert.equal(v3Calls, 0);
  await initializeV2Sessions(f.client);
  const v2 = await createV2Session(f.client, "en"); let v2Calls = 0;
  const classic = createSpeechGateway(f.client, { sessionId: v2.session.sessionId, expectedTurn: 0, operationId: crypto.randomUUID() }, async () => {
    v2Calls++; return new Response(wav(), { headers: { "content-type": "audio/wav" } });
  });
  assert.equal((await classic.synthesize()).contentType, "audio/wav"); assert.equal(v2Calls, 1);
  assert.deepEqual((await usageSummary(f.client, Date.now())).policy, before.policy);
});
