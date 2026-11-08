import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { pauseV3, v3AdmissionEnabled, v3EnabledInTransaction } from "../src/server/v3/control";
import { createV3ControlHandlers } from "../src/server/v3/control-http";
import { initializeSessions, createStoredSession, claimTurn, assertActiveTurn, hasActiveTurnLease } from "../src/server/v3/sessions";
import { createConversationHandler } from "../src/server/v3/conversation-http";
import { databaseWrite } from "../src/server/v2/database";
import { initializeSessions as initializeV2Sessions, createStoredSession as createV2Session } from "../src/server/v2/sessions";
import { initializeLedger, setPolicy, usageSummary } from "../src/server/v2/ledger";
import { v3Database } from "../src/server/v3/runtime";
import { v3Readiness } from "../src/server/v3/readiness";

async function fixture(t: TestContext) {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeSessions(client); return client;
}
function adminAuth(t: TestContext) {
  const keys = ["V2_ADMIN_USERNAME", "V2_ADMIN_PASSWORD"], previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  process.env.V2_ADMIN_USERNAME = "admin"; process.env.V2_ADMIN_PASSWORD = "explicit-control-test-fixture-password";
  return `Basic ${Buffer.from(`admin:${process.env.V2_ADMIN_PASSWORD}`).toString("base64")}`;
}

test("control is extra admission only, fails closed when absent/unreadable and pause survives reinitialization", async (t) => {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  assert.equal(await v3AdmissionEnabled(client), false);
  await initializeSessions(client); assert.equal(await v3AdmissionEnabled(client), true);
  await pauseV3(client); await pauseV3(client); assert.equal(await v3AdmissionEnabled(client), false);
  await initializeSessions(client); assert.equal(await v3AdmissionEnabled(client), false);
  await client.execute("DELETE FROM v3_runtime_control"); assert.equal(await v3AdmissionEnabled(client), false);
  await assert.rejects(pauseV3(client), { code: "STORE_UNAVAILABLE" });
});

test("durable pause revokes a held V3 dispatch lease without altering V2 state or usage policy", async (t) => {
  const client = await fixture(t);
  await initializeLedger(client); await initializeV2Sessions(client);
  const v2 = await createV2Session(client, "en"), beforeV2 = JSON.stringify((await client.execute("SELECT * FROM v2_sessions")).rows);
  const beforeUsage = await usageSummary(client, Date.now());
  const created = await createStoredSession(client, "en"), input = { sessionId: created.session.sessionId, operationId: randomUUID(), expectedTurn: 0, reply: { origin: "typed" as const, text: "Who are you?" } };
  const context = { sessionId: created.session.sessionId, turnOperationId: input.operationId };
  await claimTurn(client, created.secret, input); await assertActiveTurn(client, context);
  await pauseV3(client);
  await databaseWrite(client, async (tx) => { assert.equal(await v3EnabledInTransaction(tx), false); assert.equal(await hasActiveTurnLease(tx, context, Date.now()), false); });
  await assert.rejects(assertActiveTurn(client, context), { code: "V3_LEASE_LOST" });
  assert.equal(JSON.stringify((await client.execute("SELECT * FROM v2_sessions")).rows), beforeV2);
  const afterUsage = await usageSummary(client, Date.now());
  assert.deepEqual(afterUsage.policy, beforeUsage.policy); assert.deepEqual(afterUsage.counters, beforeUsage.counters);
  assert.equal((await client.execute({ sql: "SELECT session_id FROM v2_sessions WHERE session_id=?", args: [v2.session.sessionId] })).rows.length, 1);
});

test("paused V3 rejects start/reply while authenticated End and verification still work", async (t) => {
  const client = await fixture(t), original = process.env.VERCEL;
  const oldEnvironment = process.env.VERCEL_ENV; delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  t.after(() => { if (original === undefined) delete process.env.VERCEL; else process.env.VERCEL = original;
    if (oldEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnvironment; });
  let calls = 0;
  const handler = createConversationHandler({ mode: () => "fixture", database: async () => client, gateway: () => { calls++; throw new Error("must not dispatch"); } });
  const base = "https://preview.invalid", post = (body: object, cookie?: string) => new Request(`${base}/api/v3/conversation`, { method: "POST", headers: {
    origin: base, "content-type": "application/json", "x-vercel-forwarded-for": "v3-control-fixture", ...(cookie ? { cookie } : {}),
  }, body: JSON.stringify(body) });
  const response = await handler(post({ action: "start", locale: "en" })); assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0], { session } = await response.json();
  await pauseV3(client);
  assert.equal((await handler(post({ action: "start", locale: "en" }))).status, 503);
  assert.equal((await handler(post({ action: "reply", operation: { sessionId: session.sessionId, operationId: randomUUID(), expectedTurn: 0, reply: { origin: "typed", text: "Who are you?" } } }, cookie))).status, 503);
  const ended = await handler(post({ action: "end", sessionId: session.sessionId }, cookie)); assert.equal(ended.status, 200);
  const checked = await handler(post({ action: "verify", operation: { sessionId: session.sessionId, operationId: randomUUID(), expectedTurn: 0 } }, cookie));
  const body = await checked.json(); assert.equal(checked.status, 200); assert.equal(body.session.ending, "participant"); assert.equal(body.session.verification.checked, true);
  assert.equal(calls, 0);
});

test("private control authenticates before storage, strictly validates same-origin pause and never exposes credentials", async (t) => {
  const client = await fixture(t), authorization = adminAuth(t), base = "https://preview.invalid";
  let reads = 0;
  const handlers = createV3ControlHandlers(async () => { reads++; return client; });
  const post = (body: string, origin = base, authenticated = true) => new Request(`${base}/admin/v3`, { method: "POST", headers: {
    origin, "content-type": "application/x-www-form-urlencoded", ...(authenticated ? { authorization } : {}),
  }, body });
  assert.equal((await handlers.GET(new Request(`${base}/admin/v3`))).status, 401);
  assert.equal((await handlers.POST(post("action=pause", base, false))).status, 401); assert.equal(reads, 0);
  assert.equal((await handlers.POST(post("action=pause", "https://evil.invalid"))).status, 403);
  for (const body of ["action=enable", "action=pause&action=pause", "action=pause&finding=corroborated", "x".repeat(101)]) {
    assert.equal((await handlers.POST(post(body))).status, 400);
  }
  assert.equal(await v3AdmissionEnabled(client), true);
  const view = await handlers.GET(new Request(`${base}/admin/v3`, { headers: { authorization } }));
  assert.equal(view.status, 200); assert.equal(view.headers.get("cache-control"), "no-store");
  const html = await view.text(); assert.ok(html.includes("Educational simulation")); assert.ok(!html.includes(process.env.V2_ADMIN_PASSWORD!));
  assert.ok(!html.includes('value="enable"'));
  assert.equal((await handlers.POST(post("action=pause"))).status, 303); assert.equal(await v3AdmissionEnabled(client), false);
  assert.equal((await handlers.POST(post("action=pause"))).status, 303);
});

test("independent SQLite clients observe the same persistent pause and initialization cannot reopen it", (t) => {
  const file = join(tmpdir(), `scamsuno-v3-control-${randomUUID()}.db`), url = pathToFileURL(file).href;
  t.after(() => { for (const suffix of ["", "-wal", "-shm"]) { try { unlinkSync(file + suffix); } catch (e) { if (!(e && typeof e === "object" && "code" in e && e.code === "ENOENT")) throw e; } } });
  const script = `import {createClient} from '@libsql/client';
    import {initializeSessions} from './src/server/v3/sessions.ts';
    import {v3AdmissionEnabled,pauseV3} from './src/server/v3/control.ts';
    const a=createClient({url:${JSON.stringify(url)}}),b=createClient({url:${JSON.stringify(url)}});
    await initializeSessions(a); const before=await v3AdmissionEnabled(b); await pauseV3(a);
    const after=await v3AdmissionEnabled(b); await initializeSessions(b); const reinitialized=await v3AdmissionEnabled(a);
    a.close();b.close();console.log(JSON.stringify({before,after,reinitialized}));`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 20_000 })), {
    before: true, after: false, reinitialized: false,
  });
});

test("readiness stays closed after durable pause even with otherwise valid configuration and fixture allowance", async (t) => {
  const names = ["V2_DATABASE_URL", "V2_DATABASE_AUTH_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "V2_LIVE_ENABLED", "V3_TRUST_OR_TRAP_ENABLED", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"];
  const previous = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of names) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  for (const key of names) delete process.env[key];
  process.env.V2_DATABASE_URL = "file::memory:"; process.env.V2_LIVE_ENABLED = "true"; process.env.V3_TRUST_OR_TRAP_ENABLED = "true";
  process.env.LLM_API_KEY = "explicit-readiness-fixture-not-a-provider-key";
  const client = await v3Database(); t.after(() => client.close());
  const now = Date.now();
  await setPolicy(client, { enabled: true, killSwitch: false, reconciledAt: now, expiresAt: now + 60_000,
    verifiedCreditFloor: 4000, reserveCredits: 1000, maxGnaniRequests: 3, maxGnaniRequestsPerDay: 3,
    maxLLMRequests: 2, maxLLMRequestsPerDay: 2, maxRequestsPerSession: 6, maxConcurrent: 1, maxSTTSeconds: 15, maxTTSChars: 420 });
  assert.equal((await v3Readiness()).available, true);
  await pauseV3(client);
  assert.deepEqual(await v3Readiness(), { available: false, voiceAvailable: false });
});
