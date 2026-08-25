/**
 * Apply pending migrations.
 *
 *   pnpm db:migrate
 *
 * This is the path that runs against anything with data in it. `db:push`
 * diffs the schema straight into the database, which is fine while iterating
 * locally but keeps no history and can't be reviewed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  for (const candidate of [".env", "../../apps/web/.env.local", "../../.env.local"]) {
    try {
      const contents = readFileSync(resolve(process.cwd(), candidate), "utf8");
      const match = /^\s*DATABASE_URL\s*=\s*(.+)\s*$/m.exec(contents);
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // Not there; try the next location.
    }
  }

  throw new Error(
    "DATABASE_URL is not set. Put it in apps/web/.env.local (see .env.example) " +
      "or export it before running this command.",
  );
}

const url = databaseUrl();
const sql = neon(url);

// The schema declares a pgvector column, and the extension has to exist before
// the first migration runs. Creating it here keeps setup to one command.
await sql`CREATE EXTENSION IF NOT EXISTS vector`;

const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).host;
console.log(`Migrating ${host}…`);

await migrate(drizzle(sql), { migrationsFolder: "./migrations" });

console.log("Migrations applied.");
