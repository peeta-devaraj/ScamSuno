import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createUsageHandlers, renderUsage } from "../src/server/v2/usage-http";
import { initializeLedger, markDispatched, reserveUsage, setPolicy, settleUsage, usageSummary, type UsagePolicy } from "../src/server/v2/ledger";

const now = Date.now();
const policy: UsagePolicy = { enabled: true, killSwitch: false, reconciledAt: now - 1000, expiresAt: now + 60_000,
  verifiedCreditFloor: 4988, reserveCredits: 1000, maxGnaniRequests: 10, maxGnaniRequestsPerDay: 10,
  maxLLMRequests: 10, maxLLMRequestsPerDay: 10, maxRequestsPerSession: 10, maxConcurrent: 1, maxSTTSeconds: 20, maxTTSChars: 420 };
function auth(t: { after: (fn: () => void) => void }) {
  const keys = ["V2_ADMIN_USERNAME", "V2_ADMIN_PASSWORD"];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  t.after(() => { for (const k of keys) if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; });
  process.env.V2_ADMIN_USERNAME = "admin"; process.env.V2_ADMIN_PASSWORD = "fictional-test-password-0123456789";
  return `Basic ${Buffer.from(`admin:${process.env.V2_ADMIN_PASSWORD}`).toString("base64")}`;
}

test("private usage view rejects unauthenticated requests before touching storage", async () => {
  let reads = 0;
  const handlers = createUsageHandlers(async () => { reads++; throw new Error("must not connect"); });
  assert.equal((await handlers.GET(new Request("https://preview.invalid/admin/usage"))).status, 401);
  assert.equal((await handlers.POST(new Request("https://preview.invalid/admin/usage", { method: "POST" }))).status, 401);
  assert.equal(reads, 0);
});

test("authenticated usage displays truthful quotas with no participant content or invented credit costs", async (t) => {
  const authorization = auth(t), client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeLedger(client); await setPolicy(client, policy);
  await reserveUsage(client, { attemptId: crypto.randomUUID(), operationId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    kind: "gnani_tts", model: "timbre-v3.0", textChars: 130 });
  const handlers = createUsageHandlers(async () => client);
  const response = await handlers.GET(new Request("https://preview.invalid/admin/usage", { headers: { authorization } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  for (const text of ["Educational simulation", "4,988", "Unknown until reconciled", "gnani_tts", "130 chars"]) {
    assert.ok(html.includes(text.replace(",", "")), text);
  }
  assert.ok(!html.includes(process.env.V2_ADMIN_PASSWORD!));
  const snapshot = await usageSummary(client, Date.now());
  snapshot.recent[0].model = '<script>alert("fixture")</script>';
  assert.ok(!renderUsage(snapshot).includes('<script>'));
  assert.ok(renderUsage(snapshot).includes("&lt;script&gt;"));
});

test("admin pause is same-origin, changes only the V2 policy and makes no provider request", async (t) => {
  const authorization = auth(t), client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeLedger(client); await setPolicy(client, policy);
  const handlers = createUsageHandlers(async () => client);
  const request = (origin: string) => new Request("https://preview.invalid/admin/usage", { method: "POST", headers: {
    authorization, origin, "content-type": "application/x-www-form-urlencoded",
  }, body: "action=pause" });
  assert.equal((await handlers.POST(request("https://untrusted.invalid"))).status, 403);
  assert.equal((await usageSummary(client, Date.now())).admissionOpen, true);
  const paused = await handlers.POST(request("https://preview.invalid"));
  assert.equal(paused.status, 303);
  const summary = await usageSummary(client, Date.now());
  assert.equal(summary.admissionOpen, false);
  assert.equal(summary.policy?.killSwitch, true);
  assert.equal(summary.policy?.verifiedCreditFloor, policy.verifiedCreditFloor);
  assert.equal(summary.recent.length, 0);
});

test("private recovery requires explicit billing review, retains unknown spending and closes all quotas", async (t) => {
  const authorization = auth(t), client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  const then = Date.now() - 600_000;
  await initializeLedger(client); await setPolicy(client, { ...policy, reconciledAt: then }, then);
  const attemptId = crypto.randomUUID();
  await reserveUsage(client, { attemptId, operationId: crypto.randomUUID(), sessionId: crypto.randomUUID(),
    kind: "gnani_stt", model: "explicit-fixture", audioSeconds: 2 }, then);
  await markDispatched(client, attemptId, then + 1);
  await settleUsage(client, attemptId, "unknown", { latencyMs: 100 }, then + 2);
  const handlers = createUsageHandlers(async () => client);
  const form = new URLSearchParams({ action: "reconcile", reconciliationId: crypto.randomUUID(),
    verifiedAt: new Date().toISOString(), verifiedCreditFloor: "4980", attemptId });
  const request = (origin = "https://preview.invalid") => new Request("https://preview.invalid/admin/usage", {
    method: "POST", headers: { authorization, origin, "content-type": "application/x-www-form-urlencoded" }, body: form.toString(),
  });
  assert.equal((await handlers.POST(request())).status, 400, "an unchecked review cannot acknowledge a charge");
  form.set("providerReviewConfirmed", "yes");
  assert.equal((await handlers.POST(request("https://untrusted.invalid"))).status, 403);
  const view = await (await handlers.GET(new Request("https://preview.invalid/admin/usage", { headers: { authorization } }))).text();
  assert.ok(view.includes("five-minute wait alone is not evidence"));
  assert.equal((await handlers.POST(request())).status, 303);
  assert.equal((await handlers.POST(request())).status, 303, "same review can be retried idempotently");
  const after = await usageSummary(client, Date.now());
  assert.equal(after.admissionOpen, false);
  assert.equal(after.policy?.killSwitch, true);
  assert.equal(after.policy?.maxGnaniRequests, 0);
  assert.equal(after.policy?.maxLLMRequests, 0);
  assert.equal(after.counters.active, 0);
  assert.equal(after.counters.gnani.daily, 1);
  assert.equal(after.recent[0].status, "unknown");
  assert.equal(after.recent[0].actualCredits, null);
  assert.equal(after.reconciliations.length, 1);
});
