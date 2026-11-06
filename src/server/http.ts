import { createHash } from "node:crypto";

export function reply(body: object, status = 200, requestId = crypto.randomUUID()) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
}

export function failure(code: string, message: string, status: number, retryable = false) {
  return reply({ ok: false, error: { code, message, retryable } }, status);
}

export async function boundedBody(request: Request, max: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    reader.releaseLock();
  }
}

const counters = new Map<string, { expires: number; count: number }>();

export function withinLimit(request: Request, action: string, max: number) {
  const now = Date.now();
  const address = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = createHash("sha256").update(`${action}:${address}`).digest("hex");
  const entry = counters.get(key);
  if (entry && entry.expires > now) {
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  }
  if (counters.size >= 4096) {
    for (const [id, value] of counters) if (value.expires <= now) counters.delete(id);
    if (counters.size >= 4096 && !entry) return false;
  }
  counters.set(key, { count: 1, expires: now + 600_000 });
  return true;
}
