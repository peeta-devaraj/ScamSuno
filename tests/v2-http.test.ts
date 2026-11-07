import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createConversationHandler } from "../src/server/v2/conversation-http";
import { initializeSessions } from "../src/server/v2/sessions";
import { withinLimit } from "../src/server/http";

const base = "https://preview.invalid";
function post(body: unknown, cookie?: string, origin = base) {
  return new Request(`${base}/api/v2/conversation`, { method: "POST", headers: {
    origin, "content-type": "application/json", ...(cookie ? { cookie } : {}),
  }, body: JSON.stringify(body) });
}
async function fixture(t: { after: (fn: () => void) => void }) {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeSessions(client);
  let calls = 0;
  const handler = createConversationHandler({ mode: () => "fixture", database: async () => client,
    gateway: () => ({ async execute(request) {
      calls++;
      const data = JSON.parse(request.messages[1].content);
      return JSON.stringify(request.purpose === "evaluator" ?
        { intent: "QUESTION", verify: false, confidence: 0.99, evidence: data.participant_reply.text } :
        { locale: data.locale, text: "You have questions. What concerns you about this call?", action: "continue" });
    } }),
  });
  return { client, handler, calls: () => calls };
}

test("fixture HTTP journey owns sessions on the server and replays without model dispatch", async (t) => {
  const f = await fixture(t);
  const start = await f.handler(post({ action: "start", locale: "en" }));
  assert.equal(start.status, 200);
  assert.match(start.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict.*Secure/);
  const cookie = start.headers.get("set-cookie")!.split(";")[0];
  const body = await start.json();
  assert.equal(body.mode, "fixture");
  assert.equal(body.educationalSimulation, true);
  assert.equal(JSON.stringify(body).includes(cookie.split(".").at(-1)!), false);
  const operation = { sessionId: body.session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0,
    reply: { origin: "typed", text: "Who are you?" } };
  const next = await f.handler(post({ action: "reply", operation }, cookie));
  assert.equal(next.status, 200);
  assert.equal((await next.json()).session.turn, 1);
  assert.equal(f.calls(), 2);
  assert.equal((await f.handler(post({ action: "reply", operation }, cookie))).status, 200);
  assert.equal(f.calls(), 2);
  const end = await f.handler(post({ action: "end", sessionId: operation.sessionId }, cookie));
  assert.equal((await end.json()).session.ending, "participant");
  assert.equal(f.calls(), 2);
});

test("HTTP rejects cross-origin, forged session state and claimed voice provenance", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.handler(post({ action: "start", locale: "en" }, undefined, "https://untrusted.invalid"))).status, 403);
  const start = await f.handler(post({ action: "start", locale: "ta" }));
  const cookie = start.headers.get("set-cookie")!.split(";")[0], body = await start.json();
  const op = { sessionId: body.session.sessionId, operationId: crypto.randomUUID(), expectedTurn: 0,
    reply: { origin: "button", id: "continue" } };
  assert.equal((await f.handler(post({ action: "reply", operation: op }))).status, 401);
  assert.equal((await f.handler(post({ action: "reply", operation: op, session: body.session }, cookie))).status, 400);
  assert.equal((await f.handler(post({ action: "reply", operation: { ...op, reply: { origin: "voice", text: "typed claim", transcription: {
    provider: "gnani", model: "prisma-v3.0", requestId: "fictional", confirmed: true,
  } } } }, cookie))).status, 400);
  assert.equal(f.calls(), 0);
});

test("closed/production fixture mode never touches a database or provider", async (t) => {
  const original = process.env.VERCEL_ENV;
  t.after(() => { if (original === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original; });
  let calls = 0;
  const deps = { database: async () => { calls++; throw new Error("private DB credential diagnostic"); },
    gateway: () => { throw new Error("must not dispatch"); } };
  const closed = createConversationHandler({ ...deps, mode: () => null });
  assert.equal((await closed(post({ action: "start", locale: "en" }))).status, 503);
  process.env.VERCEL_ENV = "production";
  assert.equal((await createConversationHandler({ ...deps, mode: () => "fixture" })(post({ action: "start", locale: "en" }))).status, 503);
  assert.equal(calls, 0);
  process.env.VERCEL_ENV = "preview";
  const failed = await createConversationHandler({ ...deps, mode: () => "live" })(post({ action: "start", locale: "en" }));
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("credential"));
});

test("End remains available after inference is disabled and the generic limiter is exhausted", async (t) => {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeSessions(client);
  let mode: "fixture" | null = "fixture";
  const handler = createConversationHandler({ mode: () => mode, database: async () => client,
    gateway: () => { throw new Error("End must not use a gateway"); } });
  const start = await handler(post({ action: "start", locale: "te" }));
  const cookie = start.headers.get("set-cookie")!.split(";")[0], { session } = await start.json();
  while (withinLimit(post({}), "v2", 80)) { /* Fill only this test process's fixed public-action counter. */ }
  mode = null;
  const ended = await handler(post({ action: "end", sessionId: session.sessionId }, cookie));
  assert.equal(ended.status, 200);
  assert.equal((await ended.json()).session.ending, "participant");
});

test("a pending evaluation cannot start a caller request after authenticated End", async (t) => {
  const client = createClient({ url: "file::memory:" }); t.after(() => client.close());
  await initializeSessions(client);
  let entered!: () => void, finish!: (value: unknown) => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const requests: string[] = [];
  const handler = createConversationHandler({ mode: () => "fixture", database: async () => client, gateway: () => ({
    async execute(request) {
      requests.push(request.purpose); entered();
      if (request.purpose === "evaluator") return new Promise((resolve) => { finish = resolve; });
      throw new Error("must never ask caller after hangup");
    },
  }) });
  // A separate trusted platform address isolates this fixture from the limiter test above.
  const localPost = (body: unknown, cookie?: string) => {
    const request = post(body, cookie); request.headers.set("x-vercel-forwarded-for", "http-race-fixture"); return request;
  };
  const start = await handler(localPost({ action: "start", locale: "en" }));
  const cookie = start.headers.get("set-cookie")!.split(";")[0], { session } = await start.json();
  const pending = handler(localPost({ action: "reply", operation: { sessionId: session.sessionId,
    operationId: crypto.randomUUID(), expectedTurn: 0, reply: { origin: "typed", text: "Who are you?" } } }, cookie));
  await started;
  assert.equal((await handler(localPost({ action: "end", sessionId: session.sessionId }, cookie))).status, 200);
  finish(JSON.stringify({ intent: "QUESTION", verify: false, confidence: 0.99, evidence: "Who are you?" }));
  assert.equal((await pending).status, 409);
  assert.deepEqual(requests, ["evaluator"]);
});
