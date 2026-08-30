import { connectionOptions } from "../src/connection.js";
/**
 * Checks writing and correcting recipes against a real database.
 *
 *   pnpm check:editor
 *
 * The things worth asserting: a hand-written recipe is indexed for pantry
 * search the same as an imported one, an edit rebuilds that index rather than
 * leaving it answering from the old card, editing marks a card checked without
 * rewriting where it came from, and none of it reaches across to someone
 * else's recipes.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { emptyDraft, ingredientFromLine, type RecipeDraft } from "@seconds/core";
import * as schema from "../src/schema.js";
import { createRecipe, deleteRecipe, getRecipe, updateRecipe } from "../src/queries/recipes.js";

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

const rejects = async (label: string, run: () => Promise<unknown>, expectedFragment: string) => {
  try {
    await run();
    failures++;
    console.log(`FAIL  ${label}\n        it was accepted`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const ok = message.toLowerCase().includes(expectedFragment.toLowerCase());
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        got "${message}"`));
  }
};

/** What's in the ingredient index for a recipe, which is what pantry search joins on. */
const indexed = async (recipeId: string) =>
  (
    await db.query.recipeIngredients.findMany({
      where: eq(schema.recipeIngredients.recipeId, recipeId),
    })
  )
    .map((row) => `${row.canonicalItem}${row.isStaple ? " (staple)" : ""}`)
    .sort();

const draft = (patch: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  title: "Weeknight dal",
  ingredients: [
    ingredientFromLine("1 cup red lentils"),
    ingredientFromLine("1 tsp ground turmeric"),
    ingredientFromLine("salt"),
  ],
  steps: [
    { n: 1, text: "Rinse the lentils.", timerSeconds: null, sourceTimestamp: null },
    { n: 2, text: "Simmer until soft.", timerSeconds: null, sourceTimestamp: null },
  ],
  ...patch,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["ed-cook", "ed-other"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [cook, other] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));

// --- writing one by hand ----------------------------------------------------
const dalId = await createRecipe(db, cook, draft());
const dal = (await getRecipe(db, cook, dalId))!;

expect("a hand-written recipe saves", dal.title, "Weeknight dal");
expect("...with no source to attribute", [dal.sourceKind, dal.sourceUrl], ["manual", null]);
expect("...and nothing was inferred", [dal.extractionMethod, dal.confidence], ["manual", 1]);
expect("...so it starts out checked", dal.verifiedAt !== null, true);
expect("...and pantry search can find it", await indexed(dalId), [
  "red lentil",
  "salt (staple)",
  "turmeric",
]);

const secondDal = await createRecipe(db, cook, draft());
expect(
  "two hand-written recipes don't collide on the one-per-source rule",
  secondDal !== dalId,
  true,
);
await deleteRecipe(db, cook, secondDal);

// --- what a recipe has to have ----------------------------------------------
await rejects("a recipe needs a name", () => createRecipe(db, cook, draft({ title: "  " })), "name");
await rejects(
  "a recipe needs an ingredient",
  () => createRecipe(db, cook, draft({ ingredients: [] })),
  "ingredient",
);
await rejects("a recipe needs a step", () => createRecipe(db, cook, draft({ steps: [] })), "step");
await rejects(
  "times can't be negative",
  () => createRecipe(db, cook, draft({ prepMinutes: -10 })),
  "negative",
);
expect(
  "and none of those wrote anything",
  (await db.query.recipes.findMany({ where: eq(schema.recipes.ownerId, cook) })).length,
  1,
);

// --- correcting an import ---------------------------------------------------
const [imported] = await db
  .insert(schema.recipes)
  .values({
    ownerId: cook,
    title: "Kimchi jjigae",
    ingredients: [ingredientFromLine("200g pork belly"), ingredientFromLine("1 cup kimchi")],
    steps: [{ n: 1, text: "Fry the pork.", timerSeconds: null, sourceTimestamp: null }],
    sourceKind: "youtube",
    sourceUrl: "https://example.test/watch?v=abc",
    sourceAuthor: "Someone",
    extractionMethod: "transcript-llm",
    confidence: 0.6,
    extractionNotes: ["Guessed the simmer time."],
    visibility: "public",
    sharedAt: new Date(),
  })
  .returning({ id: schema.recipes.id });
const importedId = imported!.id;

await db.insert(schema.recipeIngredients).values([
  { recipeId: importedId, canonicalItem: "pork belly", optional: false, isStaple: false },
  { recipeId: importedId, canonicalItem: "kimchi", optional: false, isStaple: false },
]);

const before = (await getRecipe(db, cook, importedId))!;
expect("an imported card starts unchecked", before.verifiedAt, null);

const corrected = await updateRecipe(db, cook, importedId, {
  ...emptyDraft(),
  title: "Kimchi jjigae",
  servings: 4,
  ingredients: [
    // The transcript misheard this one.
    ingredientFromLine("200g pork shoulder"),
    ingredientFromLine("1 cup kimchi"),
    ingredientFromLine("1 block firm tofu"),
  ],
  steps: [
    { n: 1, text: "Fry the pork.", timerSeconds: null, sourceTimestamp: null },
    { n: 9, text: "Add the kimchi.", timerSeconds: null, sourceTimestamp: null },
  ],
  tags: ["Korean", "korean", " weeknight "],
});
const after = (await getRecipe(db, cook, importedId))!;

expect("the edit saved", corrected, true);
expect("...the correction stuck", after.ingredients[0]!.item, "pork shoulder");
expect("...pantry search follows the correction", await indexed(importedId), [
  "firm tofu",
  "kimchi",
  "pork shoulder",
]);
expect(
  "...steps are renumbered by position",
  after.steps.map((s) => s.n),
  [1, 2],
);
expect("...tags are tidied and deduplicated", after.tags, ["korean", "weeknight"]);
expect("...and it counts as checked now", after.verifiedAt !== null, true);
expect(
  "...but where it came from is untouched",
  [after.sourceKind, after.sourceUrl, after.sourceAuthor, after.extractionMethod],
  [before.sourceKind, before.sourceUrl, before.sourceAuthor, before.extractionMethod],
);
expect(
  "...as is what we admit we guessed",
  [after.confidence, after.extractionNotes],
  [0.6, ["Guessed the simmer time."]],
);
expect("...and who can see it", [after.visibility, after.sharedAt !== null], ["public", true]);

await rejects(
  "an edit is validated too",
  () => updateRecipe(db, cook, importedId, draft({ title: "" })),
  "name",
);
expect(
  "...and a rejected edit changes nothing",
  (await getRecipe(db, cook, importedId))!.title,
  "Kimchi jjigae",
);

// --- other people's recipes -------------------------------------------------
expect(
  "you can't edit someone else's recipe",
  await updateRecipe(db, other, importedId, draft({ title: "Mine now" })),
  false,
);
expect(
  "...and it really didn't change",
  (await getRecipe(db, cook, importedId))!.title,
  "Kimchi jjigae",
);
expect("you can't delete someone else's recipe", await deleteRecipe(db, other, importedId), false);
expect(
  "editing a recipe that doesn't exist is a no-op, not an error",
  await updateRecipe(db, cook, "00000000-0000-0000-0000-000000000000", draft()),
  false,
);

// --- deleting ---------------------------------------------------------------
expect("you can delete your own", await deleteRecipe(db, cook, importedId), true);
expect("...it's gone", await getRecipe(db, cook, importedId), undefined);
expect("...and it took its search index with it", await indexed(importedId), []);
expect("deleting it twice is harmless", await deleteRecipe(db, cook, importedId), false);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
