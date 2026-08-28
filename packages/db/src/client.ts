import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your database.",
    );
  }
  return drizzle(new Pool({ connectionString }), { schema });
}

/** Lazily created so importing this module never requires a live database. */
let cached: Database | undefined;
export function db(): Database {
  cached ??= createDb();
  return cached;
}
