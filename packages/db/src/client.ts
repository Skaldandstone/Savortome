import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createNeonDb>;

/** Neon's serverless driver only speaks to Neon's proxy; everything else
 * (RDS, plain Postgres, localhost) goes through node-postgres. */
export function isNeonUrl(connectionString: string): boolean {
  try {
    return /\.neon\.tech$/i.test(new URL(connectionString.replace(/^postgres(ql)?:/, "http:")).hostname);
  } catch {
    return false;
  }
}

function createNeonDb(connectionString: string) {
  return drizzleNeon(neon(connectionString), { schema });
}

function createPgDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5 });
  const instance = drizzlePg(pool, { schema }) as unknown as Database;
  // neon-http exposes batch(); the node-postgres flavor does not. The query
  // modules only rely on "run these and hand back the results in order", so
  // emulate it by awaiting each builder sequentially. Neon's batch is atomic
  // and this shim is not - the call sites are small delete+insert pairs that
  // tolerate it, and a true transaction would need tx-bound builders anyway.
  (instance as { batch?: unknown }).batch = async (queries: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const q of queries) results.push(await q);
    return results;
  };
  return instance;
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your database.",
    );
  }
  return isNeonUrl(connectionString) ? createNeonDb(connectionString) : createPgDb(connectionString);
}

/** Lazily created so importing this module never requires a live database. */
let cached: Database | undefined;
export function db(): Database {
  cached ??= createDb();
  return cached;
}
