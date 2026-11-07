/** Only the explicitly selected free-provider path is admitted for V2. */
export function hostedConfiguration() {
  const key = process.env.LLM_API_KEY?.trim();
  if (process.env.V2_LIVE_ENABLED !== "true" || !key) return null;
  try {
    const base = new URL(process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1");
    const model = process.env.LLM_MODEL || "openai/gpt-oss-20b";
    if (base.protocol !== "https:" || base.hostname !== "api.groq.com" || base.port || base.username || base.password ||
        base.search || base.hash || !/^\/openai\/v1\/?$/.test(base.pathname) ||
        !["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(model)) return null;
    return { key, model, endpoint: "https://api.groq.com/openai/v1/chat/completions" };
  } catch { return null; }
}
