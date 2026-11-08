import type { Client } from "@libsql/client";
import { databaseFromEnvironment } from "../v2/database";
import { initializeLedger } from "../v2/ledger";
import { initializeSessions } from "./sessions";

let database: Promise<Client> | undefined;
/** Additive V3 tables reuse durable storage and the existing conservative ledger. */
export function v3Database(): Promise<Client> {
  if (database) return database;
  const initializing = (async () => {
    const client = databaseFromEnvironment();
    try { await initializeLedger(client); await initializeSessions(client); return client; }
    catch (error) { client.close(); throw error; }
  })().catch((error) => { if (database === initializing) database = undefined; throw error; });
  database = initializing;
  return initializing;
}
