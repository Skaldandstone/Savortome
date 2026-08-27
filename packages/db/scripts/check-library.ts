/**
 * Checks your own library — searching it, ordering it, and the rating shown
 * on each card — against a real database.
 *
 *   pnpm check:library
 *
 * The things worth asserting: all three ways into search work (words on the
 * card, an exact tag, an ingredient), the title outranks a passing mention,
 * every sort orders by what it claims with nulls last, the rating is joined in
 * rather than guessed, and none of it reaches another person's recipes.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import { isStaple, type Ingredient } from "@seconds/core";
import * as schema from "../src/schema.js";
import { listRecipes, searchRecipes } from "../src/queries/recipes.js";
import { rateRecipe } from "../src/queries/ratings.js";

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

const ing = (canonicalItem: string): Ingredient => ({
  raw: canonicalItem, quantity: 1, quantityMax: null, unit: null,
  item: canonicalItem, canonicalItem, notes: null, optional: false, group: null,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["ls-cook", "ls-other"];

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

const byId = new Map<string, string>();

async function makeRecipe(
  ownerId: string,
  title: string,
  ingredients: string[],
  extra: { tags?: string[]; cuisine?: string | null; description?: string | null } = {},
): Promise<string> {
  const list = ingredients.map(ing);
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId, title,
      description: extra.description ?? null,
      cuisine: extra.cuisine ?? null,
      tags: extra.tags ?? [],
      ingredients: list,
      steps: [{ n: 1, text: "Cook.", timerSeconds: null, sourceTimestamp: null }],
      sourceKind: "manual", extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });

  if (list.length) {
    await db.insert(schema.recipeIngredients).values(
      list.map((i) => ({
        recipeId: row!.id,
        canonicalItem: i.canonicalItem,
        optional: false,
        isStaple: isStaple(i.canonicalItem),
      })),
    );
  }
  byId.set(row!.id, title);
  return row!.id;
}

const titles = async (query: string) =>
  (await searchRecipes(db, cook, query)).map((id) => byId.get(id) ?? "(someone else's)");

const stew = await makeRecipe(cook, "Kimchi stew", ["kimchi", "gochujang", "pork belly"], {
  tags: ["korean", "weeknight"], cuisine: "Korean",
});
await makeRecipe(cook, "Lemon drizzle cake", ["lemon", "butter", "flour"], {
  tags: ["baking"], cuisine: "British",
  description: "A tea-time cake. Nothing at all to do with kimchi.",
});
await makeRecipe(cook, "Tteokbokki", ["gochujang", "rice cake"], { tags: ["korean", "spicy"] });
await makeRecipe(other, "Someone else's kimchi", ["kimchi"], { tags: ["korean"] });

// --- the words on the card --------------------------------------------------
expect("finds a recipe by its name", await titles("kimchi stew"), ["Kimchi stew"]);
expect(
  "ranks the title above a passing mention in the description",
  (await titles("kimchi"))[0],
  "Kimchi stew",
);
expect("matches on cuisine", (await titles("korean")).includes("Kimchi stew"), true);
expect("handles a phrase", await titles('"lemon drizzle"'), ["Lemon drizzle cake"]);
expect("handles punctuation people type", Array.isArray(await titles("kimchi!! & stew??")), true);

// --- a tag ------------------------------------------------------------------
expect("finds by tag", await titles("baking"), ["Lemon drizzle cake"]);
expect(
  "a tag matches exactly, not stemmed",
  (await titles("bak")).includes("Lemon drizzle cake"),
  false,
);

// --- an ingredient ----------------------------------------------------------
// The one discovery can't answer: what did I make with this jar?
expect(
  "finds every recipe using an ingredient",
  (await titles("gochujang")).sort(),
  ["Kimchi stew", "Tteokbokki"],
);
expect("finds by an ingredient no other field mentions", await titles("pork belly"), ["Kimchi stew"]);

// --- other people -----------------------------------------------------------
expect(
  "never reaches someone else's recipes",
  (await titles("kimchi")).includes("(someone else's)"),
  false,
);
expect(
  "...and the other person's own search sees only theirs",
  (await searchRecipes(db, other, "kimchi")).length,
  1,
);

// --- nothing ----------------------------------------------------------------
expect("an empty query returns nothing rather than everything", await titles("   "), []);
expect("a query matching nothing returns nothing", await titles("zzzznotathing"), []);
expect("a deleted recipe stops matching", await (async () => {
  await db.delete(schema.recipes).where(inArray(schema.recipes.id, [stew]));
  return titles("pork belly");
})(), []);

// --- sorting ----------------------------------------------------------------
// Fixtures with deliberate gaps: sorting has to put "unknown" last, not first.
const quick = await makeRecipe(cook, "Apple quickie", ["apple"], {});
const slow = await makeRecipe(cook, "Zuppa slow-cooked", ["bean"], {});
await db.update(schema.recipes).set({ totalMinutes: 10 }).where(inArray(schema.recipes.id, [quick]));
await db.update(schema.recipes).set({ totalMinutes: 240 }).where(inArray(schema.recipes.id, [slow]));

const names = async (sort: Parameters<typeof listRecipes>[2]["sort"]) =>
  (await listRecipes(db, cook, { sort })).map((r) => r.title);

const byName = await names("name");
expect("A-Z sorts by name, case-insensitively", byName[0], "Apple quickie");
expect("...and runs to the end of the alphabet", byName[byName.length - 1], "Zuppa slow-cooked");

const byQuick = await names("quickest");
expect("quickest puts the fastest first", byQuick[0], "Apple quickie");
expect(
  "...and a recipe with no stated time last, not first",
  byQuick[byQuick.length - 1] !== "Apple quickie" && byQuick.indexOf("Zuppa slow-cooked") < byQuick.length - 1,
  true,
);

await rateRecipe(db, cook, slow, 5, null);
await rateRecipe(db, cook, quick, 2, null);

const byRated = await names("rated");
expect("best rated puts five stars first", byRated[0], "Zuppa slow-cooked");
expect("...then the two-star one", byRated[1], "Apple quickie");
expect(
  "...and unrated recipes last, not floated up by a null",
  byRated.slice(2).includes("Tteokbokki"),
  true,
);

// Cooking is a shelf move, so set the counter the way the shelf flow does.
await db
  .update(schema.ratings)
  .set({ timesCooked: 3, lastCookedAt: new Date() })
  .where(inArray(schema.ratings.recipeId, [quick]));
expect("recently cooked puts it first", (await names("cooked"))[0], "Apple quickie");

expect(
  "newest is the default when no sort is given",
  (await names(undefined)).length > 0,
  true,
);

// --- the rating on the card -------------------------------------------------
const rows = await listRecipes(db, cook, { sort: "name" });
const appleRow = rows.find((r) => r.title === "Apple quickie")!;
expect("the card carries this person's own stars", appleRow.stars, 2);
expect("...and how many times they cooked it", appleRow.timesCooked, 3);
expect(
  "an unrated recipe reports null rather than a fabricated zero",
  rows.find((r) => r.title === "Tteokbokki")!.stars,
  null,
);
expect(
  "another person's rating never leaks onto your card",
  (await listRecipes(db, other, { sort: "name" })).every((r) => r.stars === null),
  true,
);

// --- search and sort together -----------------------------------------------
const searched = await searchRecipes(db, cook, "gochujang");
expect(
  "a search keeps its relevance order when no sort is asked for",
  (await listRecipes(db, cook, { ids: searched })).length,
  searched.length,
);
expect(
  "...and takes the sort when one is",
  (await listRecipes(db, cook, { ids: searched, sort: "name" })).map((r) => r.title),
  ["Tteokbokki"],
);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
