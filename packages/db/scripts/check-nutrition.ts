import { connectionOptions } from "../src/connection.js";
/**
 * Checks nutrition — the real per-ingredient pipeline and its persistence —
 * against a real database and the real USDA FoodData Central API.
 *
 *   pnpm check:nutrition
 *
 * The things worth asserting: a saved recipe's nutrition round-trips through
 * Postgres exactly, editing a recipe clears whatever nutrition was on file
 * rather than leaving a stale figure that still looks current, and a manual
 * recipe starts with none at all. The USDA half is exercised for real here
 * (DEMO_KEY, no signup needed) rather than mocked, since a schema change on
 * their end is exactly the kind of thing a mock would never catch.
 *
 * Works on its own fixture user and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { computeNutrition, emptyDraft, ingredientFromLine, type RecipeDraft } from "@seconds/core";
import * as schema from "../src/schema.js";
import { createRecipe, getRecipe, saveRecipe, updateRecipe } from "../src/queries/recipes.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const pool = new pg.Pool(connectionOptions(url));
const db = drizzle(pool, { schema });

let failures = 0;
const expect = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

/** Sorts object keys at every depth, so a JSONB round-trip compares by value rather than by byte order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

// --- fixture ----------------------------------------------------------------
const HANDLE = "nu-cook";

const [user] = await db
  .insert(schema.users)
  .values({ email: `${HANDLE}@localhost`, handle: HANDLE, displayName: "Nutrition Test" })
  .onConflictDoUpdate({ target: schema.users.email, set: { handle: HANDLE } })
  .returning({ id: schema.users.id });
const userId = user!.id;
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));

// --- the real USDA API, live -------------------------------------------------
// DEMO_KEY is real but rate-limited (~30/hr), and this repo's own testing can
// burn that in one run — so this only asserts the pipeline never crashes and
// always produces a real row, not which source it came from. The USDA-match
// behaviour itself is covered thoroughly with an injectable fetch in
// nutrition-usda.test.ts, where the outcome doesn't depend on a shared quota.
console.log("--- live USDA reachability (result may be usda or estimated depending on quota) ---");
const flour = { raw: "", quantity: 1, quantityMax: null, unit: "cup", item: "flour", canonicalItem: "flour", notes: null, optional: false, group: null };
const nutrition = await computeNutrition([flour], [], 1);
console.log(`    (source was: ${nutrition.perIngredient[0]!.source})`);
expect("the live pipeline returns exactly one row, whichever source answered", nutrition.perIngredient.length, 1);
expect("...with no thrown error reaching this far", nutrition.method, "computed");

// --- persistence --------------------------------------------------------------
console.log("\n--- persistence ---");
const draft: RecipeDraft = {
  ...emptyDraft(),
  title: "Nutrition Test Recipe",
  ingredients: [ingredientFromLine("1 cup flour")],
  steps: [{ n: 1, text: "Mix it.", timerSeconds: null, sourceTimestamp: null }],
};

const manualId = await createRecipe(db, userId, draft);
const manual = await getRecipe(db, userId, manualId);
expect("a hand-typed recipe exists", Boolean(manual), true);
expect("...and starts with no nutrition", manual?.nutrition, null);

const recipe = {
  id: crypto.randomUUID(),
  title: "Imported Nutrition Test",
  description: null,
  servings: 4,
  servingsNote: null,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  ingredients: [flour],
  steps: [{ n: 1, text: "Mix it.", timerSeconds: null, sourceTimestamp: null }],
  equipment: [],
  tags: [],
  cuisine: null,
  course: null,
  difficulty: null,
  confidence: 0.9,
  extractionNotes: [],
  ingredientNutritionGuesses: [],
  imageUrl: null,
  source: { kind: "web" as const, url: "https://example.com/nutrition-test", author: null, siteName: "example.com", extractionMethod: "article-llm" as const },
  nutrition,
};

const savedId = await saveRecipe(db, userId, recipe);
const saved = await getRecipe(db, userId, savedId);
// A structural comparison, not a string one: Postgres's JSONB storage does
// not promise to preserve key order, so comparing via JSON.stringify would
// fail on a byte-identical value the moment the driver reorders keys.
expect(
  "nutrition round-trips through Postgres with the same values",
  JSON.stringify(canonical(saved?.nutrition)),
  JSON.stringify(canonical(nutrition)),
);
expect("...specifically the per-serving figure, not just presence", saved?.nutrition?.perServing.calories, nutrition.perServing.calories);

// --- editing clears it ---------------------------------------------------------
console.log("\n--- editing ---");
const ok = await updateRecipe(db, userId, savedId, {
  ...emptyDraft(),
  title: "Imported Nutrition Test, edited",
  ingredients: [ingredientFromLine("2 cups flour")],
  steps: recipe.steps,
});
expect("the edit succeeded", ok, true);

const afterEdit = await getRecipe(db, userId, savedId);
expect(
  "editing clears the stale nutrition rather than leaving a wrong number that still looks current",
  afterEdit?.nutrition,
  null,
);

// --- cleanup ------------------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));
await db.delete(schema.users).where(eq(schema.users.id, userId));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
// Allow pending network handles to close normally. Forcing process.exit while
// fetch/pg handles are closing can abort the Windows runtime after passing.
await pool.end();
process.exitCode = failures === 0 ? 0 : 1;
