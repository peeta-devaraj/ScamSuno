import { ImageResponse } from "next/og";
import { decodeShare, outcomeNames, shareStats } from "@/domain/share";
import { mockMode } from "@/server/gnani/client";

export const runtime = "nodejs";

export function GET(request: Request) {
  const data = decodeShare(new URL(request.url).searchParams.get("t"));
  const stats = data ? shareStats(data) : null;
  const tone = data?.o === "END_SCAMMED" ? "#ffae9a" : "#d6f4bb";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#18162c", color: "#fff9f2", display: "flex",
      flexDirection: "column", justifyContent: "space-between", padding: 58, fontSize: 27 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 39, fontWeight: 800 }}>ScamSuno</div>
        <div style={{ display: "flex", gap: 12 }}>
          {mockMode() && <div style={{ background: "#981837", color: "#fff", padding: "10px 18px", borderRadius: 40 }}>MOCK MODE</div>}
          <div style={{ background: "#fee6a9", color: "#352016", padding: "10px 18px", borderRadius: 40 }}>EDUCATIONAL SIMULATION</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ color: "#ded0f3" }}>KYC FREEZE CALL · TRAINING FEEDBACK</div>
        <div style={{ fontSize: 65, fontWeight: 800, color: tone }}>{data ? outcomeNames[data.o] : "Can you survive a scam call?"}</div>
        <div style={{ color: "#fff9f2" }}>{stats?.possible ? `${stats.earned} of ${stats.possible} tested points` :
          stats ? "No points tested" : "Practise responding to a fictional bank caller."}</div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {stats?.criteria.map(({ name, grade }) => <div key={name} style={{ display: "flex", flexDirection: "column",
          border: "1px solid #6e617f", borderRadius: 17, padding: "13px 20px", flex: 1, fontSize: 20, gap: 5 }}>
          <span style={{ color: "#ded0f3" }}>{name}</span><strong>{grade}</strong>
        </div>)}
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": mockMode() ? "no-store" : "public, max-age=86400" } },
  );
}
