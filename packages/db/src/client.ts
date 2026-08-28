import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

/**
 * RDS presents a cert chained to Amazon's own CA, which isn't in Node's
 * default trust store — encrypt the connection without validating the
 * chain, rather than shipping and maintaining the RDS CA bundle. Exported so
 * every script that opens its own connection (the app never does — see
 * `db()` below) uses the same config instead of a hand-copied one that's
 * easy to drop by accident.
 */
export const RDS_SSL_CONFIG = { rejectUnauthorized: false };

/**
 * A cap, not just a default: this is a single dedicated database on a
 * shared RDS instance, and the app itself already holds its own pool via
 * `db()` below — a one-shot script doesn't need pg's library default of 10.
 */
export const SCRIPT_POOL_MAX = 5;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your database.",
    );
  }
  return drizzle(new Pool({ connectionString, ssl: RDS_SSL_CONFIG, max: SCRIPT_POOL_MAX }), { schema });
}

/** Lazily created so importing this module never requires a live database. */
let cached: Database | undefined;
export function db(): Database {
  cached ??= createDb();
  return cached;
}
