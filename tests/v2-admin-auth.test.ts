import assert from "node:assert/strict";
import test from "node:test";
import { checkAdmin, adminChallenge } from "../src/server/v2/admin-auth";

const password = "fixture-only-secret-for-auth-tests";
const basic = (username = "admin", secret = password) => `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`;
const request = (authorization?: string, url = "https://preview.invalid/admin/usage") => new Request(url, {
  headers: authorization === undefined ? undefined : { Authorization: authorization },
});

function configure(context: { after: (cleanup: () => void) => void }) {
  const names = ["V2_ADMIN_USERNAME", "V2_ADMIN_PASSWORD", "NODE_ENV", "VERCEL", "VERCEL_ENV"];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  context.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  delete process.env.V2_ADMIN_USERNAME;
  process.env.V2_ADMIN_PASSWORD = password;
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
}

test("admin Basic authentication accepts configured HTTPS credentials and a default username", (context) => {
  configure(context);
  assert.equal(checkAdmin(request(basic())), true);
  assert.equal(checkAdmin(request(basic().replace("Basic", "basic"))), true);
  process.env.V2_ADMIN_USERNAME = "operator_1";
  process.env.V2_ADMIN_PASSWORD = password + ":suffix";
  assert.equal(checkAdmin(request(basic("operator_1", password + ":suffix"))), true);
  assert.equal(checkAdmin(request(basic())), false);
});

test("admin authentication rejects wrong, missing, malformed and oversized credentials", (context) => {
  configure(context);
  for (const header of [undefined, "", "Bearer credential", "Basic !!!", "Basic YTpi=", "Basic YTpi====",
    "Basic YTpi YTpi", "Basic  YTpi", "Basic " + "A".repeat(508),
    `Basic ${Buffer.from("missing-separator").toString("base64")}`,
    `Basic ${Buffer.from(":missing-username").toString("base64")}`,
    `Basic ${Buffer.from([0xc3, 0x28, 0x3a, 0x61]).toString("base64")}`,
    basic("other"), basic("admin", "incorrect-secret-long-enough"), basic("admin", "short"),
    basic("admin", "x".repeat(129)), basic("admin", password + "\n"), basic("admin", "密".repeat(24)),
  ]) assert.equal(checkAdmin(request(header)), false);
});

test("admin authentication fails closed for absent or invalid operator configuration", (context) => {
  configure(context);
  for (const secret of [undefined, "", "short", "x".repeat(129), "x".repeat(23) + " ", "密".repeat(24)]) {
    if (secret === undefined) delete process.env.V2_ADMIN_PASSWORD; else process.env.V2_ADMIN_PASSWORD = secret;
    assert.equal(checkAdmin(request(basic())), false);
  }
  process.env.V2_ADMIN_PASSWORD = password;
  for (const username of ["", "admin:other", "admin user", "x".repeat(65)]) {
    process.env.V2_ADMIN_USERNAME = username;
    assert.equal(checkAdmin(request(basic())), false);
  }
});

test("remote HTTP and proxy TLS claims never enable admin authentication", (context) => {
  configure(context);
  const remote = new Request("http://preview.invalid/admin/usage", {
    headers: { Authorization: basic(), "X-Forwarded-Proto": "https" },
  });
  assert.equal(checkAdmin(remote), false);
  assert.equal(checkAdmin(request(basic(), "http://localhost:3101/admin/usage")), false);
});

test("cleartext loopback is allowed only in local development and denied on Vercel previews", (context) => {
  configure(context);
  Object.assign(process.env, { NODE_ENV: "development" });
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(checkAdmin(request(basic(), `http://${host}:3101/admin/usage`)), true);
  }
  assert.equal(checkAdmin(request(basic(), "http://localhost.attacker.invalid/admin/usage")), false);
  process.env.VERCEL_ENV = "preview";
  assert.equal(checkAdmin(request(basic(), "http://localhost:3101/admin/usage")), false);
  delete process.env.VERCEL_ENV;
  process.env.VERCEL = "1";
  assert.equal(checkAdmin(request(basic(), "http://localhost:3101/admin/usage")), false);
  assert.equal(checkAdmin(request(basic())), true);
});

test("admin challenge is a generic uncached UTF-8 Basic response", async () => {
  const response = adminChallenge();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("www-authenticate"), 'Basic realm="ScamSuno usage", charset="UTF-8"');
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});
