import type { Client, Transaction } from "@libsql/client";
import { databaseWrite, StoreError } from "../v2/database";

/** Call within the same write transaction that authorizes provider dispatch. */
export async function v3EnabledInTransaction(tx: Transaction): Promise<boolean> {
  try {
    const result = await tx.execute("SELECT enabled FROM v3_runtime_control WHERE singleton=1");
    return result.rows.length === 1 && result.rows[0].enabled === 1;
  } catch { return false; }
}
export async function v3AdmissionEnabled(client: Client): Promise<boolean> {
  try { return await databaseWrite(client, v3EnabledInTransaction); }
  catch { return false; }
}
/** One-way private operator action. Never modifies V2's shared credit policy. */
export async function pauseV3(client: Client): Promise<void> {
  await databaseWrite(client, async (tx) => {
    const result = await tx.execute("UPDATE v3_runtime_control SET enabled=0 WHERE singleton=1");
    if (result.rowsAffected !== 1) throw new StoreError("STORE_UNAVAILABLE");
  });
}
