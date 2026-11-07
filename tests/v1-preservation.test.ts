import assert from "node:assert/strict";
import test from "node:test";
import { checkV1Availability, validateV1Health, V1_BUILD, V1_HEALTH_URL } from "../scripts/check-v1.mjs";

const healthy = () => ({
  ok: true, mode: "live", build: V1_BUILD,
  stt: { enabled: true }, tts: { lineCount: 60 }, shipped: { locales: ["en", "hi", "ta", "te"] },
});

test("V1 health validation accepts the preserved production contract", () => {
  const result = validateV1Health(200, healthy());
  assert.equal(result.build, V1_BUILD);
  assert.equal(result.callerClips, 60);
  assert.deepEqual(result.locales, ["en", "hi", "ta", "te"]);
  const reordered = healthy();
  reordered.shipped.locales.reverse();
  assert.doesNotThrow(() => validateV1Health(200, reordered));
});

test("V1 health validation rejects errors, missing fields and production drift", () => {
  for (const status of [201, 301, 401, 429, 500, 503]) {
    assert.throws(() => validateV1Health(status, healthy()), /unexpected HTTP status/);
  }
  for (const body of [null, "upstream secret", {}, [],
    { ...healthy(), ok: false }, { ...healthy(), mode: "mock" },
    { ...healthy(), build: "another-build" }, { ...healthy(), stt: { enabled: false } },
    { ...healthy(), tts: { lineCount: 59 } },
    { ...healthy(), shipped: { locales: ["en", "hi", "ta", "ta"] } },
    { ...healthy(), shipped: { locales: ["en", "hi", "ta", "te", "kn"] } },
    { ...healthy(), shipped: { locales: "en,hi,ta,te" } },
  ]) assert.throws(() => validateV1Health(200, body), /^Error: V1 check failed:/);
});

test("V1 monitor makes one fixed health GET with no authorization or provider calls", async () => {
  let calls = 0;
  const result = await checkV1Availability(async (url, options) => {
    calls++;
    assert.equal(url, V1_HEALTH_URL);
    assert.equal(options?.method, "GET");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.equal(new Headers(options?.headers).has("Authorization"), false);
    assert.equal(options?.body, undefined);
    assert.ok(options?.signal instanceof AbortSignal);
    return Response.json(healthy());
  });
  assert.equal(calls, 1);
  assert.equal(result.gnaniCalls, 0);
});

test("V1 monitor sanitizes network, HTTP and JSON failures", async () => {
  await assert.rejects(() => checkV1Availability(async () => {
    throw new Error("secret credential from upstream");
  }), { message: "V1 check failed: health request could not complete." });
  await assert.rejects(() => checkV1Availability(async () => new Response("secret error body", { status: 503 })),
    { message: "V1 check failed: unexpected HTTP status." });
  await assert.rejects(() => checkV1Availability(async () => new Response("secret invalid JSON", { status: 200 })),
    { message: "V1 check failed: health response is not valid JSON." });
});

test("importing the V1 monitor does not execute a network request", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected import-time request"); });
  const freshModule = new URL("../scripts/check-v1.mjs?import-check", import.meta.url).href;
  await import(freshModule);
  assert.equal(fetchMock.mock.callCount(), 0);
});
