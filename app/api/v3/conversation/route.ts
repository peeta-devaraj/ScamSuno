import { createConversationHandler } from "@/server/v3/conversation-http";
import { liveTrustOrTrapMode } from "@/server/v3/config";
import { v3Database } from "@/server/v3/runtime";
import { hasActiveTurnLease } from "@/server/v3/sessions";
import { createHostedGateway } from "@/server/v2/hosted";

export const runtime = "nodejs";
export const maxDuration = 30;
export const POST = createConversationHandler({ mode: liveTrustOrTrapMode, database: v3Database,
  gateway: (client, context) => createHostedGateway(client, context, fetch, { hasActiveTurnLease, enabled: () => Boolean(liveTrustOrTrapMode()) }),
});
