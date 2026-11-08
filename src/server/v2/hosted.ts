import { createHash, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { z } from "zod";
import type { ConversationGateway, ModelRequest } from "./caller";
import { hostedConfiguration } from "./hosted-config";
import { LedgerError, markDispatched, reserveUsage, settleUsage, type SettlementStatus } from "./ledger";
import { hasActiveTurnLease } from "./sessions";

export type HostedGatewayErrorCode = "V2_HOSTED_DISABLED" | "V2_HOSTED_DUPLICATE" | "V2_HOSTED_FAILED" |
  "V2_HOSTED_CANCELLED" | "V2_HOSTED_INVALID_REQUEST";
export class HostedGatewayError extends Error {
  constructor(readonly code: HostedGatewayErrorCode) { super(code); this.name = "HostedGatewayError"; }
}
const fail = (code: HostedGatewayErrorCode): never => { throw new HostedGatewayError(code); };
const RequestSchema = z.object({
  purpose: z.enum(["caller", "evaluator"]),
  messages: z.tuple([
    z.object({ role: z.literal("system"), content: z.string().min(1).max(16_000) }).strict(),
    z.object({ role: z.literal("user"), content: z.string().min(1).max(16_000) }).strict(),
  ]),
  maxTokens: z.number().int().min(1).max(300), temperature: z.number().min(0).max(1),
}).strict().refine((request) => request.messages.reduce((length, message) => length + message.content.length, 0) <= 16_000);
const ContextSchema = z.object({ sessionId: z.uuid(), turnOperationId: z.uuid() }).strict();
const EnvelopeSchema = z.object({ choices: z.tuple([z.object({
  finish_reason: z.literal("stop"), message: z.object({
    role: z.literal("assistant").optional(), content: z.string().min(1).max(4096),
    tool_calls: z.array(z.unknown()).max(0).optional(), function_call: z.null().optional(), refusal: z.null().optional(),
  }),
})]) });

function stageOperationId(turnOperationId: string, purpose: ModelRequest["purpose"]) {
  const bytes = createHash("sha256").update(`scamsuno-v2-hosted\0${turnOperationId.toLowerCase()}\0${purpose}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // UUID v8 for this application-specific deterministic digest.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function withCancellation<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return fail("V2_HOSTED_CANCELLED");
  let cancel!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(new HostedGatewayError("V2_HOSTED_CANCELLED"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([operation(), aborted]); }
  finally { signal.removeEventListener("abort", cancel); }
}

type ProviderResult = { status: number; content: string | null };
async function providerContent(response: Response, signal: AbortSignal): Promise<ProviderResult> {
  if (response.status !== 200) {
    try { await response.body?.cancel(); } catch { /* Never expose an upstream error body. */ }
    return { status: response.status, content: null };
  }
  const advertised = response.headers.get("content-length");
  if ((advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > 65_536)) || !response.body) {
    try { await response.body?.cancel(); } catch { /* The rejected body is discarded. */ }
    return { status: 200, content: null };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      if (signal.aborted) return fail("V2_HOSTED_CANCELLED");
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 65_536) {
        await reader.cancel();
        return { status: 200, content: null };
      }
      chunks.push(part.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const envelope = EnvelopeSchema.safeParse(body);
    return { status: 200, content: envelope.success ? envelope.data.choices[0].message.content : null };
  } catch { return { status: 200, content: null }; }
}

/** Every call spends at most one admitted provider attempt. Replays cannot redispatch. */
export function createHostedGateway(
  client: Client, context: { sessionId: string; turnOperationId: string }, transport: typeof fetch = fetch,
  storage: { hasActiveTurnLease: typeof hasActiveTurnLease; enabled?: () => boolean } = { hasActiveTurnLease },
): ConversationGateway {
  const identity = ContextSchema.safeParse(context);
  if (!identity.success) return fail("V2_HOSTED_INVALID_REQUEST");
  return {
    async execute(candidate, signal) {
      if (signal?.aborted) return fail("V2_HOSTED_CANCELLED");
      const config = hostedConfiguration();
      if (!config || storage.enabled?.() === false) return fail("V2_HOSTED_DISABLED");
      const parsed = RequestSchema.safeParse(candidate);
      if (!parsed.success) return fail("V2_HOSTED_INVALID_REQUEST");
      const request = parsed.data;
      const attemptId = randomUUID();
      let reservation;
      try {
        reservation = await reserveUsage(client, {
          attemptId, operationId: stageOperationId(identity.data.turnOperationId, request.purpose),
          sessionId: identity.data.sessionId, kind: request.purpose, model: config.model,
        });
      } catch (error) {
        return fail(error instanceof LedgerError && ["V2_ADMISSION_CLOSED", "V2_QUOTA_EXCEEDED"].includes(error.code)
          ? "V2_HOSTED_DISABLED" : "V2_HOSTED_FAILED");
      }
      if (!reservation.admitted) return fail("V2_HOSTED_DUPLICATE");
      async function settle(status: SettlementStatus, statusCode?: number, latencyMs?: number) {
        try {
          await settleUsage(client, attemptId, status, {
            ...(statusCode !== undefined && statusCode >= 100 && statusCode <= 599 ? { statusCode } : {}),
            ...(latencyMs !== undefined ? { latencyMs } : {}),
          });
        } catch { return fail("V2_HOSTED_FAILED"); }
      }
      if (signal?.aborted || !hostedConfiguration() || storage.enabled?.() === false) {
        await settle("released");
        return fail(signal?.aborted ? "V2_HOSTED_CANCELLED" : "V2_HOSTED_DISABLED");
      }
      let dispatch;
      try {
        dispatch = await markDispatched(client, attemptId, undefined,
          async (tx, now) => storage.enabled?.() !== false && storage.hasActiveTurnLease(tx, identity.data, Math.max(now, Date.now())));
      } catch {
        // Only a still-reserved attempt can be released. An uncertain committed
        // dispatch remains held by the ledger even when this cleanup fails.
        await settle("released");
        return fail("V2_HOSTED_FAILED");
      }
      if (!dispatch.dispatch) {
        if (dispatch.attempt.status === "reserved") {
          await settle("released");
          return fail("V2_HOSTED_DISABLED");
        }
        return fail("V2_HOSTED_DUPLICATE");
      }
      const started = performance.now();
      const deadline = AbortSignal.timeout(8_000);
      const providerSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
      let result: ProviderResult;
      try {
        result = await withCancellation(async () => {
          const response = await transport(config.endpoint, {
            method: "POST", cache: "no-store", redirect: "error", signal: providerSignal,
            headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: config.model, messages: request.messages, temperature: request.temperature,
              max_completion_tokens: request.maxTokens, reasoning_effort: "low", response_format: { type: "json_object" },
            }),
          });
          return providerContent(response, providerSignal);
        }, providerSignal);
      } catch {
        await settle("unknown", undefined, Math.min(86_400_000, Math.round(performance.now() - started)));
        return fail(providerSignal.aborted ? "V2_HOSTED_CANCELLED" : "V2_HOSTED_FAILED");
      }
      await settle(result.content === null ? "failed" : "succeeded", result.status,
        Math.min(86_400_000, Math.round(performance.now() - started)));
      if (result.content === null) return fail("V2_HOSTED_FAILED");
      return result.content;
    },
  };
}
