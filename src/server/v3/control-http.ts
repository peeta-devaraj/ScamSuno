import type { Client } from "@libsql/client";
import { checkAdmin, adminChallenge } from "../v2/admin-auth";
import { boundedBody } from "../http";
import { pauseV3, v3AdmissionEnabled } from "./control";
import { pruneV3Content } from "./sessions";

const headers = { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, noarchive",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
export function createV3ControlHandlers(database: () => Promise<Client>) {
  return {
    async GET(request: Request) {
      if (!checkAdmin(request)) return adminChallenge();
      try {
        const enabled = await v3AdmissionEnabled(await database());
        return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScamSuno · V3 controls</title>
        <style>body{font:18px/1.6 system-ui;max-width:44rem;margin:8vh auto;padding:24px;background:#fff8f0;color:#392737}button{font:inherit;padding:12px 20px}small{font-weight:700}</style>
        <small>Educational simulation · Private administration</small><h1>Trust or Trap controls</h1><p>Durable V3 control: <strong>${enabled ? "Not paused" : "Paused or unavailable"}</strong>.</p>
        <p>Not paused does not mean live admission is open. Environment flags, provider setup and the shared credit policy still apply.</p>
        <form method="post"><input type="hidden" name="action" value="pause"><button>Pause V3 on this database</button></form>
        <form method="post"><input type="hidden" name="action" value="prune"><button>Remove expired V3 content</button></form>
        <p>Cleanup removes up to 50 sessions that expired at least 24 hours ago, along with their conversation and verification records. Billing records stay in the ledger.</p>
        <p>This stops new V3 model and speech dispatches across deployments using these controls and this database. Already dispatched work may finish and remains accounted for. End and independent verification remain available.</p>
        <p>Classic V2 configuration and credit policy are unchanged. There is no public resume action.</p></html>`, { headers });
      } catch { return new Response("V3 controls are unavailable. Do not enable live traffic.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
    },
    async POST(request: Request) {
      if (!checkAdmin(request)) return adminChallenge();
      if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Invalid origin.", { status: 403 });
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return new Response("Invalid request.", { status: 400 });
      try {
        const body = await boundedBody(request, 100);
        if (!body) return new Response("Invalid request.", { status: 400 });
        const form = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(body));
        const action = form.get("action");
        if (form.size !== 1 || (action !== "pause" && action !== "prune")) return new Response("Invalid request.", { status: 400 });
        if (action === "prune") {
          const removed = await pruneV3Content(await database());
          return Response.json({ removed }, { headers: { "Cache-Control": "no-store" } });
        }
        await pauseV3(await database());
        return new Response(null, { status: 303, headers: { Location: "/admin/v3", "Cache-Control": "no-store" } });
      } catch { return new Response("Could not confirm V3 was paused. Do not enable live traffic.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
    },
  };
}
