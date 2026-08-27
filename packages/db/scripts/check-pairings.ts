/**
 * Checks pairing suggestions against a real database.
 *
 *   pnpm check:pairings
 *
 * No model call and no external API involved -- this is pure library
 * matching -- so what's worth asserting is that the DB layer wires the pure
 * `suggestPairings` logic to the right rows: the main recipe is excluded from
 * its own suggestions, cuisine match wins, an owner never sees another
 * owner's recipes, and a signed-in user with nothing that fits gets empty
 * slots rather than an error.
 *
 * Works on its own fixture user and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  emptyDraft,
  ingredientFromLine,
  summarizeMeal,
  type RecipeDraft,
  type RecipeNutrition,
} from "@seconds/core";
import * as schema from "../src/schema.js";
import { createRecipe, setRecipeNutrition, suggestedPairings } from "../src/queries/recipes.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const db = drizzle(neon(url), { schema });

let failures = 0;
const expect = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

const draft = (over: Partial<RecipeDraft>): RecipeDraft => ({
  ...emptyDraft(),
  ingredients: [ingredientFromLine("1 cup flour")],
  steps: [{ n: 1, text: "Mix it.", timerSeconds: null, sourceTimestamp: null }],
  ...over,
});

// --- fixtures ----------------------------------------------------------------
const HANDLE = "pair-cook";
const OTHER_HANDLE = "pair-stranger";

const [user] = await db
  .insert(schema.users)
  .values({ email: `${HANDLE}@localhost`, handle: HANDLE, displayName: "Pairing Test" })
  .onConflictDoUpdate({ target: schema.users.email, set: { handle: HANDLE } })
  .returning({ id: schema.users.id });
const userId = user!.id;
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));

const [other] = await db
  .insert(schema.users)
  .values({ email: `${OTHER_HANDLE}@localhost`, handle: OTHER_HANDLE, displayName: "Pairing Stranger" })
  .onConflictDoUpdate({ target: schema.users.email, set: { handle: OTHER_HANDLE } })
  .returning({ id: schema.users.id });
const otherId = other!.id;
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, otherId));

const mainId = await createRecipe(
  db,
  userId,
  draft({ title: "Tacos al Pastor", cuisine: "mexican", course: "main" }),
);
const sideMex = await createRecipe(
  db,
  userId,
  draft({ title: "Elote", cuisine: "mexican", course: "side" }),
);
const sideOther = await createRecipe(
  db,
  userId,
  draft({ title: "Coleslaw", cuisine: "american", course: "side" }),
);
await createRecipe(db, userId, draft({ title: "Another Main", cuisine: "mexican", course: "main" }));
await createRecipe(db, otherId, draft({ title: "Stranger's Side", cuisine: "mexican", course: "side" }));

// --- checks --------------------------------------------------------------------
console.log("--- pairing suggestions ---");
const result = await suggestedPairings(db, userId, mainId);
expect("suggests the same-cuisine side first", result.side[0]?.id, sideMex);
expect("still offers the other side after it", result.side[1]?.id, sideOther);
expect("excludes the other main course from any slot", result.side.length + result.drink.length + result.dessert.length, 2);
expect("has no drink or dessert candidates in this fixture", result.drink.length + result.dessert.length, 0);

const isolated = await suggestedPairings(db, otherId, await createRecipe(db, otherId, draft({ title: "Stranger's Main", course: "main" })));
expect("never mixes another owner's recipes into someone else's suggestions", isolated.side.some((c) => c.id === sideMex), false);

const empty = await suggestedPairings(db, userId, crypto.randomUUID());
expect("a recipe that doesn't exist (or isn't yours) answers empty, not an error", empty, { side: [], drink: [], dessert: [] });

// --- full-meal totals -----------------------------------------------------------
console.log("\n--- full-meal totals ---");
const sideNutrition: RecipeNutrition = {
  perServing: { calories: 150, proteinGrams: 3, carbGrams: 20, fatGrams: 6, fiberGrams: 2, sodiumMg: 300 },
  perIngredient: [],
  method: "computed",
};
await setRecipeNutrition(db, userId, sideMex, sideNutrition);

const withNutrition = await suggestedPairings(db, userId, mainId);
const sideCandidate = withNutrition.side.find((c) => c.id === sideMex);
expect("a candidate's own nutrition round-trips through the suggestion", sideCandidate?.nutrition?.perServing.calories, 150);

const mainNutrition: RecipeNutrition = {
  perServing: { calories: 400, proteinGrams: 25, carbGrams: 30, fatGrams: 15, fiberGrams: 4, sodiumMg: 600 },
  perIngredient: [],
  method: "computed",
};
const meal = summarizeMeal([mainNutrition, sideCandidate!.nutrition!], 4);
expect("a full meal sums one serving of each dish per guest", meal?.perGuest.calories, 550);
expect("...and scales that by the guest count for the table total", meal?.total.calories, 2200);

// --- cleanup ------------------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, userId));
await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, otherId));
await db.delete(schema.users).where(eq(schema.users.id, userId));
await db.delete(schema.users).where(eq(schema.users.id, otherId));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
