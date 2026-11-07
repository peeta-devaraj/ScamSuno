import { createUsageHandlers } from "@/server/v2/usage-http";
import { v2Database } from "@/server/v2/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export const { GET, POST } = createUsageHandlers(v2Database);
