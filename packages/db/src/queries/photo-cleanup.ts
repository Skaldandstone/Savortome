import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_KEY = new RegExp(`^recipes/(${UUID})/(${UUID})/${UUID}\\.(jpg|png|webp)$`);

/** Server/operator-only, on demand. No route, scheduler or storage client here.
 * The supplied eraser must be idempotent and honor AbortSignal. Never pass the
 * best-effort helper that suppresses errors: resolution means confirmed erasure.
 * A failed acknowledgement rolls back this batch; already-erased keys may retry.
 */
export async function processPendingPhotoDeletions(
  database: Database,
  erase: (key: string, signal: AbortSignal) => Promise<void>,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ completed: number; failed: number; blocked: number }> {
  const limit = options.limit ?? 5;
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10
      || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3000) {
    throw new Error("Invalid photo cleanup batch limits.");
  }
  return database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
    await tx.execute(sql`SET LOCAL lock_timeout = '1s'`);
    const pending = await tx.select().from(schema.pendingPhotoDeletions)
      .orderBy(asc(schema.pendingPhotoDeletions.createdAt), asc(schema.pendingPhotoDeletions.key))
      .limit(limit).for("update", { skipLocked: true });
    const result = { completed: 0, failed: 0, blocked: 0 };
    for (const entry of pending) {
      const parts = PHOTO_KEY.exec(entry.key);
      if (!parts) { result.blocked++; continue; }
      // Lock a surviving recipe while checking it. A corrupt/stale pending
      // entry must not delete a photo still used by that same recipe. Lock
      // contention aborts the transaction, leaving all references retryable.
      const [recipe] = await tx.select({ photos: schema.recipes.photos }).from(schema.recipes)
        .where(and(eq(schema.recipes.ownerId, parts[1]!), eq(schema.recipes.id, parts[2]!)))
        .for("share", { noWait: true });
      if (recipe?.photos.some((photo) => photo.key === entry.key)) {
        result.blocked++; continue;
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let erased = false;
      try {
        await Promise.race([
          Promise.resolve().then(() => erase(entry.key, controller.signal)),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Photo cleanup deadline exceeded."));
            }, timeoutMs);
          }),
        ]);
        erased = true;
      } catch {
        result.failed++;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        controller.abort();
      }
      if (erased) {
        // Outside the provider-error catch: DB acknowledgement failure must
        // roll back, never be mistaken for a successful batch completion.
        await tx.delete(schema.pendingPhotoDeletions).where(eq(schema.pendingPhotoDeletions.key, entry.key));
        result.completed++;
      }
    }
    return result;
  });
}
