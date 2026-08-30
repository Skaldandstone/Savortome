import { connectionOptions } from "../src/connection.js";
/**
 * Checks saved meals — creating, sharing, and copying one — against a real
 * database.
 *
 *   pnpm check:templates
 *
 * The point of this one is the layered access control: a template's own
 * visibility gates whether a stranger can see it at all, but each recipe
 * inside it is still gated by its own visibility on top of that, so a public
 * template can never leak a recipe its owner kept private. Unit tests cover
 * `canView` itself; this covers the query that applies it twice.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import type { Ingredient, Visibility } from "@seconds/core";
import * as schema from "../src/schema.js";
import {
  createTemplate,
  deleteTemplate,
  getSharedTemplate,
  listTemplates,
  saveSharedTemplate,
  setTemplateVisibility,
} from "../src/queries/templates.js";

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

const ing = (canonicalItem: string): Ingredient => ({
  raw: canonicalItem,
  quantity: 1,
  quantityMax: null,
  unit: null,
  item: canonicalItem,
  canonicalItem,
  notes: null,
  optional: false,
  group: null,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["tmpl-owner", "tmpl-stranger"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle })
    .onConflictDoUpdate({ target: schema.users.email, set: { displayName: handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [ownerId, strangerId] = await Promise.all(HANDLES.map(makeUser));

await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, strangerId!]));

async function makeRecipe(owner: string, title: string, visibility: Visibility): Promise<string> {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId: owner,
      title,
      ingredients: [ing("corn tortilla")],
      steps: [{ n: 1, text: "Warm it.", timerSeconds: null, sourceTimestamp: null }],
      visibility,
      sourceKind: "manual",
      extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

const mainId = await makeRecipe(ownerId!, "Tacos al Pastor", "public");
const sideId = await makeRecipe(ownerId!, "Elote", "private");
const strangersRecipe = await makeRecipe(strangerId!, "Someone else's dish", "public");

// --- creating -----------------------------------------------------------------
console.log("--- creating ---");
let rejected: string | null = null;
try {
  await createTemplate(db, ownerId!, "Not mine", [{ role: "main", recipeId: strangersRecipe }]);
} catch (err) {
  rejected = err instanceof Error ? err.message : "unknown";
}
expect("a template can't be built from a recipe you don't own", rejected !== null, true);

const templateId = await createTemplate(db, ownerId!, "Taco Night", [
  { role: "main", recipeId: mainId },
  { role: "side", recipeId: sideId },
]);

const mine = await listTemplates(db, ownerId!);
expect("the template shows up in the owner's list", mine.some((t) => t.id === templateId), true);
expect(
  "...with both dishes attached",
  mine.find((t) => t.id === templateId)?.items.length,
  2,
);

// --- a template's own visibility gates seeing it at all ------------------------
console.log("\n--- template visibility ---");
expect("a stranger can't see a private template", await getSharedTemplate(db, templateId, strangerId!), null);
expect("nor signed out", await getSharedTemplate(db, templateId, null), null);

await setTemplateVisibility(db, ownerId!, templateId, "public");
const seenPublic = await getSharedTemplate(db, templateId, strangerId!);
expect("a stranger can see a public template", Boolean(seenPublic), true);

// --- but each recipe is still gated by its own visibility ----------------------
console.log("\n--- per-recipe gating inside a public template ---");
expect(
  "the public main is visible inside a public template",
  seenPublic?.items.some((i) => i.recipeId === mainId),
  true,
);
expect(
  "the still-private side is left out, even though the template itself is public",
  seenPublic?.items.some((i) => i.recipeId === sideId),
  false,
);

const asOwner = await getSharedTemplate(db, templateId, ownerId!);
expect("the owner sees every dish in their own template, private or not", asOwner?.items.length, 2);
expect("the owner is not offered a save of their own template", asOwner?.canSave, false);

// --- saving a copy --------------------------------------------------------------
console.log("\n--- saving a copy ---");
const copyId = await saveSharedTemplate(db, strangerId!, templateId);
const copyItems = (await listTemplates(db, strangerId!)).find((t) => t.id === copyId);
expect("the copy has exactly the dishes the stranger could actually see", copyItems?.items.length, 1);
expect("the copy is named after the original", copyItems?.name, "Taco Night");

const copiedMain = await db.query.recipes.findFirst({
  where: eq(schema.recipes.id, copyItems!.items[0]!.recipeId),
});
expect("the copied dish belongs to whoever saved the template", copiedMain?.ownerId, strangerId!);
expect("...and records where it came from", copiedMain?.copiedFromId, mainId);

let refusedOwn: string | null = null;
try {
  await saveSharedTemplate(db, ownerId!, templateId);
} catch (err) {
  refusedOwn = err instanceof Error ? err.message : "unknown";
}
expect("saving your own template is refused", refusedOwn !== null, true);

// --- deleting --------------------------------------------------------------------
console.log("\n--- deleting ---");
const notMine = await deleteTemplate(db, strangerId!, templateId);
expect("a stranger cannot delete someone else's template", notMine, false);

const deleted = await deleteTemplate(db, ownerId!, templateId);
expect("the owner can delete their own template", deleted, true);
expect("...and it's gone", await getSharedTemplate(db, templateId, ownerId!), null);

// --- cleanup ------------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, strangerId!]));
await db.delete(schema.mealTemplates).where(inArray(schema.mealTemplates.ownerId, [ownerId!, strangerId!]));
await db.delete(schema.users).where(inArray(schema.users.id, [ownerId!, strangerId!]));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
