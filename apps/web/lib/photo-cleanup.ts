import "server-only";
import { processPendingPhotoDeletions, type Database } from "@seconds/db";
import { deleteRecipePhoto, r2Configured } from "./r2";

/** Trusted operator integration only; no route or scheduler calls this.
 * Missing configuration refuses before opening a cleanup transaction.
 * Counts only, with no object keys, identities, URLs or provider error details.
 */
export async function processPendingRecipePhotos(
  database: Database,
  options: { limit?: number; timeoutMs?: number } = {},
) {
  if (!r2Configured()) throw new Error("Photo cleanup storage is unavailable.");
  // Strict single-object helper propagates failure and abort to the SDK.
  // Never substitute the best-effort multi-photo helper here.
  return processPendingPhotoDeletions(database, deleteRecipePhoto, options);
}
