/**
 * Checks discovery against a real database.
 *
 *   pnpm check:discover
 *
 * The things worth asserting: discovery only ever shows public recipes, never
 * your own, full-text ranks the title above a passing mention, and "similar"
 * is driven by real ingredient overlap rather than returning whatever row
 * came next.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import { isStaple, type Ingredient, type Visibility } from "@nomnom/core";
import * as schema from "../src/schema.js";
import {
  discoverFeed,
  popularTags,
  searchDiscover,
  similarRecipes,
} from "../src/queries/discover.js";

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

/**
 * Discovery searches every public recipe, so a populated database returns
 * plenty this script didn't create. Exact-set assertions are scoped to the
 * fixtures by **id** — a marker tag would have worked too, right up until it
 * made every fixture "similar" to every other one, since tags are part of what
 * similarity is computed from.
 */
const fixtureIds = new Set<string>();
const titles = (cards: { recipeId: string; title: string }[]) =>
  cards.filter((c) => fixtureIds.has(c.recipeId)).map((c) => c.title).sort();
const anyTitles = (cards: { title: string }[]) => cards.map((c) => c.title).sort();

const ing = (canonicalItem: string): Ingredient => ({
  raw: canonicalItem, quantity: 1, quantityMax: null, unit: null,
  item: canonicalItem, canonicalItem, notes: null, optional: false, group: null,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["dv-cook", "dv-viewer"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [cook, viewer] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, viewer]));

async function makeRecipe(
  ownerId: string,
  title: string,
  visibility: Visibility,
  ingredients: string[],
  extra: { tags?: string[]; cuisine?: string | null; description?: string | null; totalMinutes?: number | null } = {},
) {
  const list = ingredients.map(ing);
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId, title, visibility,
      description: extra.description ?? null,
      cuisine: extra.cuisine ?? null,
      tags: extra.tags ?? [],
      totalMinutes: extra.totalMinutes ?? null,
      ingredients: list,
      steps: [{ n: 1, text: "Cook.", timerSeconds: null, sourceTimestamp: null }],
      sharedAt: visibility === "private" ? null : new Date(),
      sourceKind: "manual", extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });

  await db.insert(schema.recipeIngredients).values(
    list.map((i) => ({
      recipeId: row!.id,
      canonicalItem: i.canonicalItem,
      optional: false,
      isStaple: isStaple(i.canonicalItem),
    })),
  );
  fixtureIds.add(row!.id);
  return row!.id;
}

const kimchiStew = await makeRecipe(cook, "Kimchi stew", "public",
  ["kimchi", "gochujang", "pork belly", "tofu", "salt"],
  { tags: ["korean", "weeknight"], cuisine: "Korean", totalMinutes: 40 });

const tteokbokki = await makeRecipe(cook, "Tteokbokki", "public",
  ["gochujang", "rice cake", "fish cake", "salt"],
  { tags: ["korean", "spicy"], cuisine: "Korean", totalMinutes: 25 });

const lemonCake = await makeRecipe(cook, "Lemon drizzle cake", "public",
  ["lemon", "butter", "flour"],
  { tags: ["baking"], cuisine: "British",
    description: "A tea-time cake. Nothing to do with kimchi.", totalMinutes: 70 });

const privateOne = await makeRecipe(cook, "Kimchi secret", "private", ["kimchi"], { tags: ["korean"] });
const friendsOne = await makeRecipe(cook, "Kimchi for friends", "friends", ["kimchi"], { tags: ["korean"] });
const viewersOwn = await makeRecipe(viewer, "My own kimchi", "public", ["kimchi"], { tags: ["korean"] });

// --- the feed ---------------------------------------------------------------
const feed = await discoverFeed(db, viewer);
expect("the feed shows public recipes", titles(feed).includes("Kimchi stew"), true);
expect("the feed hides private ones", titles(feed).includes("Kimchi secret"), false);
expect("the feed hides friends-only ones", titles(feed).includes("Kimchi for friends"), false);
expect("the feed hides your own", titles(feed).includes("My own kimchi"), false);

const signedOut = await discoverFeed(db, null);
expect("a signed-out visitor sees public recipes", titles(signedOut).includes("Kimchi stew"), true);
expect("...and still no private ones", titles(signedOut).includes("Kimchi secret"), false);

// --- filters ----------------------------------------------------------------
expect(
  "tag filter narrows the feed",
  titles(await discoverFeed(db, viewer, { tags: ["baking"] })),
  ["Lemon drizzle cake"],
);
expect(
  "time filter drops the slow one",
  titles(await discoverFeed(db, viewer, { maxMinutes: 30 })),
  ["Tteokbokki"],
);

// --- search -----------------------------------------------------------------
const kimchi = (await searchDiscover(db, viewer, { query: "kimchi" })).filter((c) =>
  fixtureIds.has(c.recipeId),
);
expect("search finds it by title", kimchi[0]?.title, "Kimchi stew");
expect(
  "search ranks the title match above a passing mention",
  kimchi.findIndex((c) => c.title === "Kimchi stew") <
    kimchi.findIndex((c) => c.title === "Lemon drizzle cake"),
  true,
);
expect("search still respects visibility", titles(kimchi).includes("Kimchi secret"), false);

expect("search matches on cuisine", titles(await searchDiscover(db, viewer, { query: "korean" })).length > 0, true);
expect(
  "search handles a phrase without erroring",
  titles(await searchDiscover(db, viewer, { query: '"lemon drizzle cake"' })),
  ["Lemon drizzle cake"],
);
expect("search handles punctuation people type", Array.isArray(await searchDiscover(db, viewer, { query: "kimchi!! & stew??" })), true);
expect(
  "an empty query falls back to the feed",
  titles(await searchDiscover(db, viewer, { query: "  " })),
  titles(feed),
);
expect("a search with no matches returns nothing", anyTitles(await searchDiscover(db, viewer, { query: "zzzznotathing" })), []);

// --- similar ----------------------------------------------------------------
const similar = (await similarRecipes(db, kimchiStew, viewer, 40)).filter((c) =>
  fixtureIds.has(c.recipeId),
);
expect("similar finds the one sharing an ingredient", similar[0]?.title, "Tteokbokki");
expect("similar explains itself", similar[0]?.reason, "Shares 1 ingredient");
expect(
  "similar excludes recipes with nothing in common",
  similar.map((c) => c.title).includes("Lemon drizzle cake"),
  false,
);
expect("similar never includes the recipe itself", similar.map((c) => c.recipeId).includes(kimchiStew), false);
expect("similar respects visibility", similar.map((c) => c.title).includes("Kimchi for friends"), false);
expect(
  "similar for a recipe that doesn't exist is empty",
  anyTitles(await similarRecipes(db, "00000000-0000-0000-0000-000000000000", viewer)),
  [],
);
expect(
  "similar works from one of your own recipes, which is the usual case",
  titles(await similarRecipes(db, viewersOwn, viewer, 40)),
  ["Kimchi stew", "Tteokbokki"],
);

// --- save counts ------------------------------------------------------------
const [copy] = await db.insert(schema.recipes).values({
  ownerId: viewer, title: "Saved kimchi stew", visibility: "private",
  ingredients: [ing("kimchi")], steps: [],
  copiedFromId: kimchiStew, sourceKind: "manual", extractionMethod: "manual",
}).returning({ id: schema.recipes.id });

const withSaves = (await discoverFeed(db, viewer, { limit: 200 })).filter((c) =>
  fixtureIds.has(c.recipeId),
);
expect(
  "the feed reports how many people saved a recipe",
  withSaves.find((c) => c.recipeId === kimchiStew)?.saveCount,
  1,
);
expect("the most-saved recipe leads the feed", withSaves[0]?.title, "Kimchi stew");

// --- tags -------------------------------------------------------------------
const tags = await popularTags(db, viewer, 100);
expect(
  "popular tags includes tags from public recipes",
  tags.some((t) => t.tag === "korean"),
  true,
);
expect("popular tags is most-common first", tags[0]?.count === Math.max(...tags.map((t) => t.count)), true);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.id, [copy!.id]));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, viewer]));
await db.delete(schema.users).where(inArray(schema.users.id, [cook, viewer]));

void [tteokbokki, lemonCake, privateOne, friendsOne];

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
