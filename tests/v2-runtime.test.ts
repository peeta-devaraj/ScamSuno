import assert from "node:assert/strict";
import test from "node:test";
import { v2Database } from "../src/server/v2/runtime";

test("a failed runtime database initialization can recover and successful initialization is single-flight", async (t) => {
  const keys = ["V2_DATABASE_URL", "V2_DATABASE_AUTH_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  for (const key of keys) delete process.env[key];
  await assert.rejects(v2Database(), { code: "STORE_NOT_CONFIGURED" });
  delete process.env.VERCEL;
  process.env.V2_DATABASE_URL = "file::memory:";
  const first = v2Database(), second = v2Database();
  assert.equal(first, second);
  const client = await first;
  t.after(() => client.close());
  assert.equal(client.closed, false);
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  assert.ok(tables.rows.some((row) => row.name === "v2_sessions"));
  assert.ok(tables.rows.some((row) => row.name === "v2_usage_attempts"));
});
