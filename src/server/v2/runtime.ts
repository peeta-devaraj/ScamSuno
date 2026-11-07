import type { Client } from "@libsql/client";
import { databaseFromEnvironment } from "./database";
import { initializeLedger } from "./ledger";
import { initializeSessions } from "./sessions";

let database: Promise<Client> | undefined;
/** Every instance connects to the same durable remote database. Missing config is closed. */
export function v2Database(): Promise<Client> {
  if (database) return database;
  const initializing = (async () => {
    const client = databaseFromEnvironment();
    try {
      await initializeLedger(client);
      await initializeSessions(client);
      return client;
    } catch (error) { client.close(); throw error; }
  })().catch((error) => {
    if (database === initializing) database = undefined;
    throw error;
  });
  database = initializing;
  return initializing;
}
