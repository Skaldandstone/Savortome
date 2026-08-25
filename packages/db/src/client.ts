import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Neon branch.",
    );
  }
  return drizzle(neon(connectionString), { schema });
}

/** Lazily created so importing this module never requires a live database. */
let cached: Database | undefined;
export function db(): Database {
  cached ??= createDb();
  return cached;
}
