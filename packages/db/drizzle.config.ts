import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

/**
 * DATABASE_URL lives in the web app's .env.local, so it only has to be set
 * once. drizzle-kit runs as its own process from this package, so read it
 * across rather than making people keep two copies in step.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Relative to this package when run via `pnpm db:push`, and to the repo root
  // if someone runs drizzle-kit from there instead.
  const candidates = [
    ".env",
    "../../apps/web/.env.local",
    "../../.env.local",
    "apps/web/.env.local",
    ".env.local",
  ];

  for (const candidate of candidates) {
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

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
  strict: true,
});
