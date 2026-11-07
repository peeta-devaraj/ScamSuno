import type { Client } from "@libsql/client";
import { checkAdmin, adminChallenge } from "./admin-auth";
import { setPolicy, usageSummary, type UsageSummary } from "./ledger";

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const stamp = (value: number | undefined) => value === undefined ? "Not reconciled" : new Date(value).toISOString();
const headers = {
  "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, noarchive",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
export function renderUsage(summary: UsageSummary) {
  const p = summary.policy;
  const floor = p?.verifiedCreditFloor;
  const alert = floor === undefined ? "No reconciled balance" :
    floor <= 250 ? "5% threshold" : floor <= 500 ? "10% threshold" : floor <= 1250 ? "25% threshold" : floor <= 2500 ? "50% threshold" : "Above alert thresholds";
  const recent = summary.recent.map((a) => `<tr><td>${escape(stamp(a.reservedAt))}</td><td>${escape(a.kind)}</td><td>${escape(a.model)}</td><td>${escape(a.status)}</td><td>${escape(a.audioSeconds === null ? a.textChars === null ? "—" : `${a.textChars} chars` : `${a.audioSeconds}s`)}</td><td>${escape(a.latencyMs === null ? "—" : `${a.latencyMs} ms`)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScamSuno · Private usage</title>
  <style>body{margin:0;background:#0d1818;color:#e9f2ed;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:28px 20px}a{color:#b7e5be}.badge{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbe998}h1{font-size:clamp(28px,6vw,44px);margin:12px 0}.muted{color:#b7c8bf}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:12px;margin:24px 0}.card{border:1px solid #365044;border-radius:16px;padding:18px;background:#132420}.value{font-size:30px;font-weight:700}.scroll{overflow:auto;border:1px solid #365044;border-radius:12px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #365044;white-space:nowrap}button{background:#e3ed91;color:#16251c;border:0;border-radius:999px;padding:12px 20px;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.5;cursor:default}dt{font-weight:700}dd{margin:0 0 12px}footer{margin-top:28px;font-size:14px}</style>
  <main><div class="badge">Educational simulation · Private administration</div><h1>Voice usage & safeguards</h1><p class="muted">Snapshot ${escape(stamp(summary.asOf))}. No recordings or participant replies appear here.</p>
  <div class="grid"><div class="card">V2 admission<div class="value">${summary.admissionOpen ? "Open" : "Closed"}</div>${p?.killSwitch ? "Kill switch enabled" : "Policy, quotas and provider setup also apply"}</div><div class="card">Last verified credit floor<div class="value">${floor ?? "Unknown"}</div>${escape(stamp(p?.reconciledAt))}</div><div class="card">V1 protected reserve<div class="value">${p?.reserveCredits ?? 1000}</div>Credit policy floor</div><div class="card">Unresolved operations<div class="value">${summary.counters.active}</div>Reserved, dispatched or unknown</div></div>
  <p><strong>${alert}</strong> · Thresholds use the last reconciled balance against the challenge's 5,000-credit allocation; they are not a live balance.</p>
  <form method="post"><input type="hidden" name="action" value="pause"><button ${summary.admissionOpen ? "" : "disabled"}>Pause V2 API traffic</button></form>
  <h2>Request allowance</h2><dl><dt>Gnani since reconciliation / today</dt><dd>${summary.counters.gnani.totalSinceReconciliation} / ${summary.counters.gnani.daily} · limits ${p?.maxGnaniRequests ?? 0} / ${p?.maxGnaniRequestsPerDay ?? 0}</dd><dt>Conversational LLM since reconciliation / today</dt><dd>${summary.counters.llm.totalSinceReconciliation} / ${summary.counters.llm.daily} · limits ${p?.maxLLMRequests ?? 0} / ${p?.maxLLMRequestsPerDay ?? 0}</dd><dt>Credits consumed by tracked requests / cost per session / sessions remaining</dt><dd>Unknown until reconciled. Request quotas do not establish an exact credit conversion. V1 and other dashboard activity share the account balance.</dd><dt>Policy expiry</dt><dd>${escape(stamp(p?.expiresAt))}</dd></dl>
  <h2>Recent attempts</h2><div class="scroll"><table><thead><tr><th>UTC time</th><th>Operation</th><th>Model</th><th>Status</th><th>Input measure</th><th>Latency</th></tr></thead><tbody>${recent || '<tr><td colspan="6">No V2 requests recorded.</td></tr>'}</tbody></table></div>
  <footer class="muted">Keep V2 on free services. No automatic plan upgrades or paid-provider fallback. Delayed or unknown outcomes retain conservative accounting. Production promotion requires explicit approval.</footer></main></html>`;
}

export function createUsageHandlers(database: () => Promise<Client>) {
  return {
    async GET(request: Request) {
      if (!checkAdmin(request)) return adminChallenge();
      try { return new Response(renderUsage(await usageSummary(await database(), Date.now())), { headers }); }
      catch { return new Response("Usage storage is unavailable. V2 admission remains closed.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
    },
    async POST(request: Request) {
      if (!checkAdmin(request)) return adminChallenge();
      const url = new URL(request.url);
      if (request.headers.get("origin") !== url.origin) return new Response("Invalid origin.", { status: 403 });
      try {
        if (Number(request.headers.get("content-length")) > 100) return new Response("Invalid request.", { status: 400 });
        const reader = request.body?.getReader();
        if (!reader) return new Response("Invalid request.", { status: 400 });
        let body = "";
        try {
          for (;;) { const part = await reader.read(); if (part.done) break;
            body += new TextDecoder().decode(part.value); if (body.length > 100) { await reader.cancel(); return new Response("Invalid request.", { status: 400 }); } }
        } finally { reader.releaseLock(); }
        const form = new URLSearchParams(body);
        if (form.size !== 1 || form.get("action") !== "pause") return new Response("Invalid request.", { status: 400 });
        const client = await database(), summary = await usageSummary(client, Date.now());
        if (summary.admissionOpen && summary.policy) await setPolicy(client, { ...summary.policy, enabled: false, killSwitch: true });
        return new Response(null, { status: 303, headers: { Location: "/admin/usage", "Cache-Control": "no-store" } });
      } catch { return new Response("Could not update V2 admission. Do not retry provider calls.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
    },
  };
}
