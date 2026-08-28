/**
 * Encrypt grocery tokens that were written before column encryption existed.
 *
 *   pnpm backfill:grocery-encryption
 *
 * Reads every `grocery_connections` row's raw token columns, and for any value
 * still in the clear, rewrites it encrypted in place. Rows that are already
 * encrypted are left untouched, so this is safe to run repeatedly — after a
 * deploy, and again if a later import slipped a plaintext row in before the
 * writer was updated.
 *
 * Needs the same environment the app uses: `DATABASE_URL` and
 * `GROCERY_TOKEN_ENCRYPTION_KEY`. A dry run that only reports what it would do:
 *
 *   pnpm backfill:grocery-encryption -- --dry-run
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/schema.js";
import { encryptSecret, isEncrypted } from "../src/crypto.js";

const dryRun = process.argv.includes("--dry-run");

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL is not set and no apps/web/.env.local was found.");
  process.exit(1);
}

const db = drizzle(new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } }), { schema });

// Reading a token column proves the key is usable before we touch a single row;
// better to fail here than halfway through a table.
if (!dryRun) encryptSecret("preflight");

const rows = await db
  .select({
    userId: schema.groceryConnections.userId,
    provider: schema.groceryConnections.provider,
    accessToken: schema.groceryConnections.accessToken,
    refreshToken: schema.groceryConnections.refreshToken,
  })
  .from(schema.groceryConnections);

let converted = 0;
let alreadyDone = 0;

for (const row of rows) {
  const accessPlain = !isEncrypted(row.accessToken);
  const refreshPlain = row.refreshToken !== null && !isEncrypted(row.refreshToken);

  if (!accessPlain && !refreshPlain) {
    alreadyDone++;
    continue;
  }

  const label = `${row.provider} / ${row.userId}`;
  if (dryRun) {
    console.log(`would encrypt  ${label}`);
    converted++;
    continue;
  }

  await db
    .update(schema.groceryConnections)
    .set({
      accessToken: encryptSecret(row.accessToken),
      refreshToken: row.refreshToken === null ? null : encryptSecret(row.refreshToken),
      // Leave updatedAt alone: this is a storage-format migration, not a change
      // to the connection itself.
    })
    .where(
      and(
        eq(schema.groceryConnections.userId, row.userId),
        eq(schema.groceryConnections.provider, row.provider),
      ),
    );

  console.log(`encrypted      ${label}`);
  converted++;
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${converted} row(s) ${dryRun ? "would be " : ""}encrypted, ` +
    `${alreadyDone} already encrypted, ${rows.length} total.`,
);
