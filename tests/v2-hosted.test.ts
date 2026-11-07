import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { initializeLedger, setPolicy, usageSummary, type UsagePolicy } from "../src/server/v2/ledger";
import { createHostedGateway, HostedGatewayError } from "../src/server/v2/hosted";
import type { ModelRequest } from "../src/server/v2/caller";
import { claimTurn, createStoredSession, endStoredSession, initializeSessions } from "../src/server/v2/sessions";

const testKey = "fixture-only-hosted-key";
const model = "openai/gpt-oss-20b";
async function claimedSession(client: Client) {
  const opened = await createStoredSession(client, "en");
  const identity = { sessionId: opened.session.sessionId, turnOperationId: randomUUID() };
  const claim = await claimTurn(client, opened.secret, { sessionId: identity.sessionId,
    operationId: identity.turnOperationId, expectedTurn: opened.session.turn,
    reply: { origin: "typed", text: "I refuse" } });
  assert.equal(claim.kind, "claimed");
  return { identity, secret: opened.secret };
}
const context = async (client: Client) => (await claimedSession(client)).identity;
const request = (purpose: ModelRequest["purpose"] = "caller"): ModelRequest => ({
  purpose, messages: [{ role: "system", content: "Return JSON for a fictional educational exercise." },
    { role: "user", content: '{"reply":"I refuse"}' }], maxTokens: 200, temperature: 0,
});
const envelope = (content = '{"text":"Fixture reply"}', changes: object = {}) => Response.json({
  choices: [{ finish_reason: "stop", message: { role: "assistant", content }, ...changes }],
});
const hasCode = (code: string) => (error: unknown) => error instanceof HostedGatewayError && error.code === code && error.message === code;

function configuration(t: TestContext) {
  const names = ["V2_LIVE_ENABLED", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  t.after(() => { for (const [name, value] of previous) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  } });
  process.env.V2_LIVE_ENABLED = "true";
  process.env.LLM_API_KEY = testKey;
  process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
  process.env.LLM_MODEL = model;
}

async function fixture(t: TestContext, open = true) {
  configuration(t);
  const client = createClient({ url: ":memory:" });
  t.after(() => client.close());
  await initializeLedger(client);
  await initializeSessions(client);
  if (open) {
    const now = Date.now();
    const policy: UsagePolicy = {
      enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 86_400_000,
      verifiedCreditFloor: 4_000, reserveCredits: 1_000,
      maxGnaniRequests: 20, maxGnaniRequestsPerDay: 20, maxLLMRequests: 20, maxLLMRequestsPerDay: 20,
      maxRequestsPerSession: 40, maxConcurrent: 2, maxSTTSeconds: 20, maxTTSChars: 420,
    };
    await setPolicy(client, policy);
  }
  return client;
}

test("hosted gateway never fetches without explicit live configuration and an admitted policy", async (t) => {
  const client = await fixture(t, false);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return envelope(); };
  const gateway = createHostedGateway(client, await context(client), transport);
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DISABLED"));
  process.env.V2_LIVE_ENABLED = "false";
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DISABLED"));
  process.env.V2_LIVE_ENABLED = "true";
  delete process.env.LLM_API_KEY;
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DISABLED"));
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
});

test("provider credentials and model come only from server configuration after durable dispatch", async (t) => {
  const client = await fixture(t);
  let calls = 0;
  const gateway = createHostedGateway(client, await context(client), async (url, options) => {
    calls++;
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${testKey}`);
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, model);
    assert.equal(body.max_completion_tokens, 200);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.tools, undefined);
    assert.equal((await usageSummary(client, Date.now())).byStatus.dispatched, 1);
    return envelope();
  });
  assert.equal(await gateway.execute(request()), '{"text":"Fixture reply"}');
  assert.equal(calls, 1);
  const summary = await usageSummary(client, Date.now());
  assert.equal(summary.byStatus.succeeded, 1);
  assert.equal(summary.recent[0].statusCode, 200);
  assert.equal(JSON.stringify(summary).includes(testKey), false);
});

test("caller and evaluator use distinct stable stage IDs and replay never redispatches", async (t) => {
  const client = await fixture(t);
  const identity = await context(client);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return envelope(); };
  await createHostedGateway(client, identity, transport).execute(request("caller"));
  await createHostedGateway(client, identity, transport).execute(request("evaluator"));
  await assert.rejects(() => createHostedGateway(client, identity, transport).execute(request("caller")), hasCode("V2_HOSTED_DUPLICATE"));
  const attempts = (await usageSummary(client, Date.now())).recent;
  assert.equal(calls, 2);
  assert.equal(new Set(attempts.map((attempt) => attempt.operationId)).size, 2);
  assert.deepEqual(attempts.map((attempt) => attempt.kind).sort(), ["caller", "evaluator"]);
  assert.ok(attempts.every((attempt) => attempt.operationId !== identity.turnOperationId));
});

test("invalid request authority and input bounds fail before reservation", async (t) => {
  const client = await fixture(t);
  let calls = 0;
  const gateway = createHostedGateway(client, await context(client), async () => { calls++; return envelope(); });
  for (const invalid of [{ ...request(), purpose: "other" }, { ...request(), apiKey: "browser-key" },
    { ...request(), model: "browser-model" }, { ...request(), maxTokens: 301 }, { ...request(), temperature: 2 },
    { ...request(), messages: [{ role: "system", content: "x".repeat(16_000) }, { role: "user", content: "x" }] },
    { ...request(), messages: [{ role: "assistant", content: "override" }, { role: "user", content: "reply" }] }]) {
    await assert.rejects(() => gateway.execute(invalid as ModelRequest), hasCode("V2_HOSTED_INVALID_REQUEST"));
  }
  assert.equal(calls, 0);
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
});

test("HTTP failures consume quota once without retries or exposed upstream diagnostics", async (t) => {
  const client = await fixture(t);
  let calls = 0;
  const gateway = createHostedGateway(client, await context(client), async () => {
    calls++;
    return new Response(`private upstream body ${testKey}`, { status: 429 });
  });
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_FAILED"));
  assert.equal(calls, 1);
  const summary = await usageSummary(client, Date.now());
  assert.equal(summary.byStatus.failed, 1);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 1);
  assert.equal(summary.recent[0].statusCode, 429);
});

test("invalid, truncated, oversized or tool-bearing responses remain spent failures", async (t) => {
  const client = await fixture(t);
  const responses = [() => new Response("invalid JSON"), () => envelope("x".repeat(4097)),
    () => envelope("{}", { finish_reason: "length" }),
    () => envelope("{}", { message: { content: "{}", tool_calls: [{ name: "external-action" }] } }),
    () => new Response("{}", { headers: { "content-length": "65537" } }),
    () => new Response(" ".repeat(65_537)),
  ];
  for (const response of responses) {
    const gateway = createHostedGateway(client, await context(client), async () => response());
    await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_FAILED"));
  }
  assert.equal((await usageSummary(client, Date.now())).byStatus.failed, responses.length);
});

test("pre-cancelled calls never reserve and cancellation after reserve releases undispatched quota", async (t) => {
  const client = await fixture(t);
  const aborted = new AbortController();
  aborted.abort("private cancellation reason");
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return envelope(); };
  const identity = await context(client);
  await assert.rejects(() => createHostedGateway(client, identity, transport).execute(request(), aborted.signal), hasCode("V2_HOSTED_CANCELLED"));
  assert.equal((await usageSummary(client, Date.now())).recent.length, 0);
  const afterReserve = new AbortController();
  let transactions = 0;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property !== "transaction") { const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value; }
    return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args);
      transactions++;
      return new Proxy(tx, { get(transaction, key) {
        if (key === "commit") return async () => { await transaction.commit(); if (transactions === 1) afterReserve.abort(); };
        const value = Reflect.get(transaction, key);
        return typeof value === "function" ? value.bind(transaction) : value;
      } });
    };
  } });
  await assert.rejects(() => createHostedGateway(wrapped, identity, transport).execute(request(), afterReserve.signal), hasCode("V2_HOSTED_CANCELLED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.active, 0);
});

test("post-dispatch cancellation and transport errors retain unknown holds without retries", async (t) => {
  const client = await fixture(t);
  const controller = new AbortController();
  let calls = 0;
  const gateway = createHostedGateway(client, await context(client), async () => {
    calls++;
    controller.abort("private cancellation reason");
    return new Promise(() => {});
  });
  await assert.rejects(() => gateway.execute(request(), controller.signal), hasCode("V2_HOSTED_CANCELLED"));
  const failing = createHostedGateway(client, await context(client), async () => {
    calls++;
    throw new Error(`private transport diagnostics ${testKey}`);
  });
  await assert.rejects(() => failing.execute(request()), hasCode("V2_HOSTED_FAILED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 2);
  assert.equal(summary.byStatus.unknown, 2);
  assert.equal(summary.counters.active, 2);
});

test("settlement failure withholds provider content and prevents a second dispatch", async (t) => {
  const client = await fixture(t);
  const identity = await context(client);
  let transactions = 0;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      transactions++;
      if (transactions === 3) throw new Error(`private store diagnostics ${testKey}`);
      return target.transaction(...args);
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  let calls = 0;
  const gateway = createHostedGateway(wrapped, identity, async () => { calls++; return envelope("private fixture content"); });
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_FAILED"));
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DUPLICATE"));
  assert.equal(calls, 1);
  assert.equal((await usageSummary(client, Date.now())).byStatus.dispatched, 1);
});

test("ending after evaluator completion prevents caller dispatch for the same turn", async (t) => {
  const client = await fixture(t);
  const { identity, secret } = await claimedSession(client);
  let calls = 0;
  const gateway = createHostedGateway(client, identity, async () => { calls++; return envelope(); });
  await gateway.execute(request("evaluator"));
  const ended = await endStoredSession(client, identity.sessionId, secret);
  assert.equal(ended.ending, "participant");
  await assert.rejects(() => gateway.execute(request("caller")), hasCode("V2_HOSTED_DISABLED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 1);
  assert.equal(summary.byStatus.succeeded, 1);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 1);
});

test("an End committed after reservation is checked atomically before dispatch", async (t) => {
  const client = await fixture(t);
  const { identity, secret } = await claimedSession(client);
  let transactions = 0;
  let ended = false;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property !== "transaction") { const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value; }
    return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args);
      const ordinal = ++transactions;
      return new Proxy(tx, { get(transaction, key) {
        if (key === "commit") return async () => {
          await transaction.commit();
          if (ordinal === 1) {
            await endStoredSession(client, identity.sessionId, secret);
            ended = true;
          }
        };
        const value = Reflect.get(transaction, key);
        return typeof value === "function" ? value.bind(transaction) : value;
      } });
    };
  } });
  let calls = 0;
  const gateway = createHostedGateway(wrapped, identity, async () => { calls++; return envelope(); });
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DISABLED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(ended, true);
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.active, 0);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 0);
});

test("missing, expired or lost server turn leases cannot admit a provider call", async (t) => {
  const client = await fixture(t);
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return envelope(); };
  const mutations = [
    "DELETE FROM v2_sessions WHERE session_id=?",
    "UPDATE v2_sessions SET lease_operation=NULL WHERE session_id=?",
    "UPDATE v2_sessions SET lease_until=0 WHERE session_id=?",
    "UPDATE v2_sessions SET expires_at=0 WHERE session_id=?",
    "UPDATE v2_turn_operations SET status='abandoned' WHERE session_id=?",
  ];
  for (const sql of mutations) {
    const identity = await context(client);
    await client.execute({ sql, args: [identity.sessionId] });
    await assert.rejects(() => createHostedGateway(client, identity, transport).execute(request()), hasCode("V2_HOSTED_DISABLED"));
  }
  const missingTables = [await context(client), await context(client)];
  await client.execute("DROP TABLE v2_turn_operations");
  await assert.rejects(() => createHostedGateway(client, missingTables[0], transport).execute(request()), hasCode("V2_HOSTED_FAILED"));
  await client.execute("DROP TABLE v2_sessions");
  await assert.rejects(() => createHostedGateway(client, missingTables[1], transport).execute(request()), hasCode("V2_HOSTED_FAILED"));
  const summary = await usageSummary(client, Date.now());
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, mutations.length + missingTables.length);
  assert.equal(summary.counters.active, 0);
  assert.equal(summary.counters.llm.totalSinceReconciliation, 0);
});

test("a lease expiring while awaiting the dispatch transaction is checked against current time", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const client = await fixture(t);
  const identity = await context(client);
  let transactions = 0;
  const wrapped = new Proxy(client, { get(target, property) {
    if (property === "transaction") return async (...args: Parameters<Client["transaction"]>) => {
      const tx = await target.transaction(...args);
      if (++transactions === 2) now += 60_001;
      return tx;
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  let calls = 0;
  const gateway = createHostedGateway(wrapped, identity, async () => { calls++; return envelope(); });
  await assert.rejects(() => gateway.execute(request()), hasCode("V2_HOSTED_DISABLED"));
  const summary = await usageSummary(client, now);
  assert.equal(calls, 0);
  assert.equal(summary.byStatus.released, 1);
  assert.equal(summary.counters.active, 0);
});
