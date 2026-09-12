import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { connectionOptions } from './connection.js';

export type Database = ReturnType<typeof createDb>;

/**
 * RDS presents a cert chained to Amazon's own CA, which isn't in Node's
 * default trust store. The container includes the RDS CA bundle through
 * NODE_EXTRA_CA_CERTS; certificate validation remains enabled.
 * @deprecated Use connectionOptions for URL connections: pg URL parameters
 * can override a separately supplied TLS object. Retained for compatibility.
 */
export const RDS_SSL_CONFIG = { rejectUnauthorized: true };

/**
 * A cap, not just a default: this is a single dedicated database on a
 * shared RDS instance, and the app itself already holds its own pool via
 * `db()` below: a one-shot script does not need pg's library default of 10.
 * @deprecated connectionOptions now supplies this limit for apps and scripts.
 */
export const SCRIPT_POOL_MAX = 5;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your database.",
    );
  }
  return drizzle(new Pool(connectionOptions(connectionString)), { schema });
}

/** Lazily created so importing this module never requires a live database. */
let cached: Database | undefined;
export function db(): Database {
  cached ??= createDb();
  return cached;
}
