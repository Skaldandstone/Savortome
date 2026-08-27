import { desc, eq, ilike } from "drizzle-orm";
import * as schema from "../schema.js";
import type { Database } from "../client.js";

/**
 * Read helpers for the staff-only admin routes (see apps/web/app/api/admin).
 * Kept beside the other query modules so route handlers stay free of raw
 * drizzle, matching the rest of the codebase.
 */

export async function searchUsersByEmail(database: Database, email: string, limit = 20) {
  return database
    .select({
      id: schema.users.id,
      email: schema.users.email,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      tier: schema.users.tier,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(ilike(schema.users.email, `%${email}%`))
    .limit(limit);
}

export async function adminUserById(database: Database, userId: string) {
  return database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      clerkId: true,
      email: true,
      handle: true,
      displayName: true,
      tier: true,
      creditsPurchased: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });
}

export async function recentImportsFor(database: Database, userId: string, limit = 10) {
  return database
    .select({
      id: schema.imports.id,
      url: schema.imports.url,
      status: schema.imports.status,
      error: schema.imports.error,
      trace: schema.imports.trace,
      createdAt: schema.imports.createdAt,
      finishedAt: schema.imports.finishedAt,
    })
    .from(schema.imports)
    .where(eq(schema.imports.userId, userId))
    .orderBy(desc(schema.imports.createdAt))
    .limit(limit);
}
