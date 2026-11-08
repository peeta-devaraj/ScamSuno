import { createV3ControlHandlers } from "@/server/v3/control-http";
import { v3Database } from "@/server/v3/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export const { GET, POST } = createV3ControlHandlers(v3Database);
