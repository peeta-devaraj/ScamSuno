import assert from "node:assert/strict";
import test from "node:test";
import { hostedConfiguration } from "../src/server/v2/hosted-config";

test("V2 hosted configuration requires explicit enablement and the free-provider allowlist", (t) => {
  const keys = ["V2_LIVE_ENABLED", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  delete process.env.LLM_API_KEY; process.env.V2_LIVE_ENABLED = "true";
  assert.equal(hostedConfiguration(), null);
  process.env.LLM_API_KEY = "test-only-key"; process.env.V2_LIVE_ENABLED = "false";
  assert.equal(hostedConfiguration(), null);
  process.env.V2_LIVE_ENABLED = "true"; process.env.LLM_MODEL = "openai/gpt-oss-20b";
  for (const base of ["http://api.groq.com/openai/v1", "https://unapproved.invalid/v1",
    "https://api.groq.com.evil.invalid/openai/v1", "https://user:password@api.groq.com/openai/v1",
    "https://api.groq.com/openai/v1?api-key=fixture", "https://api.groq.com:8443/openai/v1",
    "https://api.groq.com/openai/v1#fragment", "https://api.groq.com/other", "not a url"]) {
    process.env.LLM_BASE_URL = base;
    assert.equal(hostedConfiguration(), null);
  }
  process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
  process.env.LLM_MODEL = "a-paid-provider-or-unverified-model";
  assert.equal(hostedConfiguration(), null);
  process.env.LLM_MODEL = "openai/gpt-oss-20b";
  assert.equal(hostedConfiguration()?.endpoint, "https://api.groq.com/openai/v1/chat/completions");
});
