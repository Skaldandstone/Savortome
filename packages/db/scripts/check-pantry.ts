import { connectionOptions } from "../src/connection.js";
/**
 * Checks the pantry query against the same rules the pure matcher implements,
 * on whatever DATABASE_URL points at.
 *
 *   pnpm check:pantry
 *
 * Works on its own fixture user ("pantry-check@localhost") and deletes
 * everything it created, so it is safe to re-run and won't touch real recipes.
 * Unit tests cover the rules; this covers the SQL that has to agree with them.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { matchRecipe, requirementsFor, type Ingredient } from "@seconds/core";
import * as schema from "../src/schema.js";
import { addPantryItems, listPantry, removePantryItems, searchByPantry } from "../src/queries/pantry.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const db = drizzle(new pg.Pool(connectionOptions(url)), { schema });

let failures = 0;
const expect = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

const ing = (canonicalItem: string, optional = false): Ingredient => ({
  raw: canonicalItem,
  quantity: 1,
  quantityMax: null,
  unit: null,
  item: canonicalItem,
  canonicalItem,
  notes: null,
  optional,
  group: null,
});

// --- fixture ----------------------------------------------------------------
const [user] = await db
  .insert(schema.users)
  .values({
    email: "pantry-check@localhost",
    handle: "pantry-check",
    displayName: "Pantry Check",
  })
  .onConflictDoUpdate({ target: schema.users.email, set: { displayName: "Pantry Check" } })
  .returning({ id: schema.users.id });
const userId = user!.id;

// Start clean so re-runs behave identically.
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));
await db.delete(schema.pantryItems).where(eq(schema.pantryItems.userId, userId));

const RECIPES: { title: string; ingredients: Ingredient[]; totalMinutes: number | null; tags: string[]; course: string | null }[] = [
  {
    title: "Chicken and rice",
    ingredients: [ing("chicken thigh"), ing("rice"), ing("salt"), ing("chili crisp", true)],
    totalMinutes: 25,
    tags: ["weeknight"],
    course: "dinner",
  },
  {
    title: "Onion soup",
    ingredients: [ing("yellow onion"), ing("beef stock"), ing("butter")],
    totalMinutes: 90,
    tags: ["make-ahead"],
    course: "dinner",
  },
  {
    title: "Salted flatbread",
    ingredients: [ing("flour"), ing("salt"), ing("olive oil"), ing("water")],
    totalMinutes: 20,
    tags: ["vegetarian"],
    course: "side",
  },
  {
    title: "Peanut noodles",
    ingredients: [ing("noodle"), ing("peanut butter"), ing("soy sauce")],
    totalMinutes: 15,
    tags: ["vegetarian", "weeknight"],
    course: "dinner",
  },
];

const ids = new Map<string, string>();
for (const r of RECIPES) {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId: userId,
      title: r.title,
      ingredients: r.ingredients,
      steps: [],
      totalMinutes: r.totalMinutes,
      tags: r.tags,
      course: r.course,
      sourceKind: "manual",
      extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });

  ids.set(r.title, row!.id);
  await db.insert(schema.recipeIngredients).values(
    r.ingredients.map((i) => ({
      recipeId: row!.id,
      canonicalItem: i.canonicalItem,
      optional: i.optional,
      isStaple: false, // deliberately wrong: the query must not trust this column
    })),
  );
}

const byId = (id: string) => [...ids.entries()].find(([, v]) => v === id)?.[0] ?? id;

// --- pantry CRUD ------------------------------------------------------------
await addPantryItems(db, userId, [
  { canonicalItem: "chicken thigh", displayName: "chicken thighs", quantity: 500, unit: "g", isStaple: false },
  { canonicalItem: "rice", displayName: "rice", quantity: null, unit: null, isStaple: false },
]);
let pantry = await listPantry(db, userId);
expect("pantry stores what was added", pantry.map((p) => p.canonicalItem).sort(), ["chicken thigh", "rice"]);
expect("pantry keeps quantities", pantry.find((p) => p.canonicalItem === "chicken thigh")?.quantity, 500);

await addPantryItems(db, userId, [
  { canonicalItem: "rice", displayName: "basmati rice", quantity: 2, unit: "cup", isStaple: false },
]);
pantry = await listPantry(db, userId);
expect("re-adding updates rather than duplicating", pantry.length, 2);
expect("re-adding overwrites the detail", pantry.find((p) => p.canonicalItem === "rice")?.displayName, "basmati rice");

await removePantryItems(db, userId, ["rice"]);
expect("removing works", (await listPantry(db, userId)).map((p) => p.canonicalItem), ["chicken thigh"]);

// --- matching ---------------------------------------------------------------
const search = (f: Parameters<typeof searchByPantry>[2]) => searchByPantry(db, userId, f);

let results = await search({ ingredients: ["chicken thigh", "rice"] });
const chicken = results.find((r) => r.recipeId === ids.get("Chicken and rice"))!;
expect("staples are assumed, so chicken+rice is cookable", chicken.canMakeNow, true);
expect("the stale is_staple column is ignored", chicken.missing, []);
expect("optional ingredients are reported, not required", chicken.missingOptional, ["chili crisp"]);
expect("cookable recipes rank first", results[0]!.recipeId === chicken.recipeId || results[0]!.canMakeNow, true);

const flatbread = results.find((r) => r.recipeId === ids.get("Salted flatbread"))!;
expect("an all-staple recipe is always cookable", flatbread.canMakeNow, true);
expect("an all-staple recipe scores full coverage", flatbread.coverage, 1);

const soup = results.find((r) => r.recipeId === ids.get("Onion soup"))!;
expect("perishables are never assumed", soup.canMakeNow, false);
expect("missing perishables are listed", soup.missing.slice().sort(), ["beef stock", "butter", "yellow onion"]);

// --- the SQL must agree with the pure matcher -------------------------------
const pantrySet = new Set(["chicken thigh", "rice"]);
for (const r of RECIPES) {
  const id = ids.get(r.title)!;
  const pure = matchRecipe(requirementsFor(id, r.ingredients), { pantry: pantrySet });
  const viaSql = results.find((x) => x.recipeId === id)!;
  expect(`SQL agrees with the rules for "${r.title}" (cookable)`, viaSql.canMakeNow, pure.canMakeNow);
  expect(`SQL agrees with the rules for "${r.title}" (missing)`, viaSql.missing.slice().sort(), pure.missing.slice().sort());
  expect(`SQL agrees with the rules for "${r.title}" (coverage)`, Math.round(viaSql.coverage * 1000), Math.round(pure.coverage * 1000));
}

// --- filters ----------------------------------------------------------------
results = await search({ ingredients: [], tags: ["vegetarian"] });
expect("tag filter narrows the set", results.map((r) => byId(r.recipeId)).sort(), ["Peanut noodles", "Salted flatbread"]);

results = await search({ ingredients: [], maxMinutes: 30 });
expect("time filter drops the slow one", results.map((r) => byId(r.recipeId)).includes("Onion soup"), false);
expect("time filter keeps the quick ones", results.length, 3);

results = await search({ ingredients: [], course: "side" });
expect("course filter works", results.map((r) => byId(r.recipeId)), ["Salted flatbread"]);

results = await search({ ingredients: [], excludeIngredients: ["peanut butter"] });
expect("exclusion removes the recipe entirely", results.map((r) => byId(r.recipeId)).includes("Peanut noodles"), false);

results = await search({ ingredients: ["chicken thigh", "rice"], tags: ["weeknight"], maxMinutes: 30 });
expect("filters combine", results.map((r) => byId(r.recipeId)), ["Chicken and rice", "Peanut noodles"]);

// --- ranking ----------------------------------------------------------------
results = await search({ ingredients: ["noodle", "peanut butter"] });
const order = results.map((r) => byId(r.recipeId));
expect("everything cookable comes before anything that isn't", order.indexOf("Onion soup"), order.length - 1);

// --- empty pantry -----------------------------------------------------------
results = await search({ ingredients: [] });
expect("an empty pantry still returns the all-staple recipe as cookable", results[0]!.canMakeNow, true);
expect("an empty pantry returns everything, ranked", results.length, 4);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));
await db.delete(schema.pantryItems).where(eq(schema.pantryItems.userId, userId));
await db.delete(schema.users).where(eq(schema.users.id, userId));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
