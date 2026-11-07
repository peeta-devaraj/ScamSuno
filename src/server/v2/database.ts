import { createClient, type Client, type Transaction } from "@libsql/client";

export class StoreError extends Error {
  constructor(readonly code: "STORE_UNAVAILABLE" | "STORE_NOT_CONFIGURED" | "INVALID_STORE_CONFIG") {
    super(code); this.name = "StoreError";
  }
}

/** No file-backed database in Vercel: its local filesystem is not durable storage. */
export function databaseFromEnvironment(): Client {
  const url = process.env.V2_DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.V2_DATABASE_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) throw new StoreError("STORE_NOT_CONFIGURED");
  try {
    const parsed = new URL(url);
    const remote = ["libsql:", "https:"].includes(parsed.protocol);
    if ((remote && (!authToken || parsed.username || parsed.password || parsed.search || parsed.hash)) ||
        (!remote && (parsed.protocol !== "file:" || Boolean(process.env.VERCEL)))) {
      throw new StoreError("INVALID_STORE_CONFIG");
    }
    return createClient({ url, ...(authToken ? { authToken } : {}) });
  } catch { throw new StoreError("INVALID_STORE_CONFIG"); }
}

// This queue avoids needless local lock contention; the database WRITE transaction,
// not this process-local queue, is the cross-instance consistency boundary.
const queues = new WeakMap<Client, Promise<void>>();
export async function databaseWrite<T>(client: Client, action: (tx: Transaction) => Promise<T>): Promise<T> {
  const previous = queues.get(client) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queues.set(client, current);
  await previous;
  let tx: Transaction | undefined;
  try {
    tx = await client.transaction("write");
    const result = await action(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (tx && !tx.closed) {
      try { await tx.rollback(); } catch { /* A failed/unknown transaction must not admit a provider call. */ }
    }
    // Domain errors deliberately use a code-only message. Never forward SQL errors,
    // statements, connection strings, bound participant data or auth values.
    if (error instanceof Error && /^V2_[A-Z_]+$/.test(error.message)) throw error;
    throw new StoreError("STORE_UNAVAILABLE");
  } finally {
    try { tx?.close(); } catch { /* Never forward SDK teardown diagnostics. */ }
    release();
    if (queues.get(client) === current) queues.delete(client);
  }
}
