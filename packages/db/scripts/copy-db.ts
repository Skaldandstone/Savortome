/**
 * Copy every row from one database to another (small datasets only - this
 * reads whole tables into memory). Built for the Neon -> RDS move.
 *
 * Env:
 *   SOURCE_DATABASE_URL - where the data lives now (Neon)
 *   DATABASE_URL        - where it's going (schema must already exist)
 *
 * Idempotent: truncates the target tables first.
 */
import { neon } from "@neondatabase/serverless";
import pg from "pg";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  throw new Error("SOURCE_DATABASE_URL and DATABASE_URL are required");
}

// Parent tables before children, matching the FK graph.
const TABLES = [
  "users",
  "recipes",
  "recipe_ingredients",
  "imports",
  "shelves",
  "shelf_recipes",
  "ratings",
  "friendships",
  "pantry_items",
  "shopping_lists",
  "shopping_list_items",
  "meal_plan_entries",
  "grocery_connections",
  "cart_handoffs",
];

const source = neon(sourceUrl);
const target = new pg.Client({ connectionString: targetUrl });
await target.connect();

// Column types on the target drive serialization: json/jsonb values must be
// stringified (a bare JS array would otherwise be sent as a Postgres array).
async function columnTypes(table: string): Promise<Map<string, string>> {
  const res = await target.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Map(res.rows.map((r) => [r.column_name, r.data_type]));
}

await target.query(
  `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
);

for (const table of TABLES) {
  const rows = (await source(`SELECT * FROM "${table}"`)) as Record<string, unknown>[];
  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    continue;
  }
  const types = await columnTypes(table);
  const cols = Object.keys(rows[0]).filter((c) => types.has(c));
  for (const row of rows) {
    const values = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      const t = types.get(c);
      if (t === "json" || t === "jsonb") return JSON.stringify(v);
      return v;
    });
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    await target.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
      values,
    );
  }
  console.log(`${table}: ${rows.length} rows`);
}

await target.end();
console.log("COPY DONE");
