import { createConversationHandler } from "@/server/v2/conversation-http";
import { trustOrTrapEnabled } from "@/server/v3/config";
import { hostedConfiguration } from "@/server/v2/hosted-config";
import { createHostedGateway } from "@/server/v2/hosted";
import { v2Database } from "@/server/v2/runtime";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createConversationHandler({
  mode: () => !trustOrTrapEnabled() && hostedConfiguration() ? "live" : null,
  database: v2Database,
  gateway: createHostedGateway,
});
