import { and, asc, eq, lte, sql } from "drizzle-orm";
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
      .where(lte(schema.pendingPhotoDeletions.retryAfter, sql`CURRENT_TIMESTAMP`))
      .orderBy(asc(schema.pendingPhotoDeletions.createdAt), asc(schema.pendingPhotoDeletions.key))
      .limit(limit).for("update", { skipLocked: true });
    const result = { completed: 0, failed: 0, blocked: 0 };
    const defer = async (key: string, blocked: boolean) => {
      await tx.update(schema.pendingPhotoDeletions).set({
        attempts: sql`least(${schema.pendingPhotoDeletions.attempts} + 1, 1000000)`,
        lastAttemptAt: sql`statement_timestamp()`,
        // Failure delay: 1,2,4,8,16,32,60 minutes, capped without dropping.
        // Blocked references wait 15 minutes for deliberate operator review.
        retryAfter: blocked
          ? sql`statement_timestamp() + interval '15 minutes'`
          : sql`statement_timestamp() + interval '1 minute' * least(60, power(2, least(${schema.pendingPhotoDeletions.attempts}, 6)))`,
      }).where(eq(schema.pendingPhotoDeletions.key, key));
    };
    for (const entry of pending) {
      const parts = PHOTO_KEY.exec(entry.key);
      if (!parts) { result.blocked++; await defer(entry.key, true); continue; }
      // Lock a surviving recipe while checking it. A corrupt/stale pending
      // entry must not delete a photo still used by that same recipe. Lock
      // contention aborts the transaction, leaving all references retryable.
      const [recipe] = await tx.select({ photos: schema.recipes.photos }).from(schema.recipes)
        .where(and(eq(schema.recipes.ownerId, parts[1]!), eq(schema.recipes.id, parts[2]!)))
        .for("share", { noWait: true });
      if (recipe?.photos.some((photo) => photo.key === entry.key)) {
        result.blocked++; await defer(entry.key, true); continue;
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
      } else {
        // Outside the provider catch, so a deferral-write fault rolls back.
        await defer(entry.key, false);
      }
    }
    return result;
  });
}
