import { health } from "@/server/health";
import { reply } from "@/server/http";

export const runtime = "nodejs";

export function GET() {
  return reply(health());
}
