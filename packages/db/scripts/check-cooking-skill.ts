import { connectionOptions } from "../src/connection.js";
/**
 * Checks the cook profile against a real database.
 *
 *   pnpm check:cooking
 *
 * The logic that decides whether a recipe is comfortable, a stretch or a
 * challenge is pure and covered by `packages/core/test/cooking-skill.test.ts`.
 * What needs a real Postgres is the part that stores it: that a partially
 * answered profile round-trips, that answering one question later does not
 * erase an earlier one, and that whatever ends up in a text or JSONB column
 * cannot take a page down when it is read back.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { fitForCook, canonicalTools } from "@seconds/core";
import * as schema from "../src/schema.js";
import { loadEnvLocal } from "../src/loadEnv.js";
import {
  getCookProfile,
  getRecipeDemands,
  saveCookProfile,
  saveRecipeDemands,
} from "../src/queries/cooking-skill.js";

loadEnvLocal();

const url = process.env.DATABASE_URL!;
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

// --- fixture ----------------------------------------------------------------
const HANDLES = ["ck-cook", "ck-other"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));
const [cook, other] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];

// --- nothing answered -------------------------------------------------------
expect("a new account has answered nothing", await getCookProfile(db, cook), {});

// --- the tier alone ---------------------------------------------------------
// This is the whole first-visit interaction: one tap, then straight to cooking.
expect(
  "the tier saves on its own",
  await saveCookProfile(db, cook, { tier: "adept" }),
  { tier: "adept" },
);

// --- answering more, later --------------------------------------------------
await saveCookProfile(db, cook, { skills: { knife: 2 } });
await saveCookProfile(db, cook, { stock: "basic" });
expect("later answers join the earlier one", await getCookProfile(db, cook), {
  tier: "adept",
  stock: "basic",
  skills: { knife: 2 },
});

// Rating one skill must not quietly wipe another rated last week.
await saveCookProfile(db, cook, { skills: { oven: 4 } });
expect(
  "a new skill rating merges rather than replaces",
  (await getCookProfile(db, cook)).skills,
  { knife: 2, oven: 4 },
);

// --- clearing is different from not answering -------------------------------
await saveCookProfile(db, cook, { stock: null });
expect(
  "an explicit null clears just that answer",
  await getCookProfile(db, cook),
  { tier: "adept", skills: { knife: 2, oven: 4 } },
);

// --- junk in the columns cannot break a page --------------------------------
// These are text and JSONB, so a renamed tier or a hand-edited row can put
// anything here. It should cost a ranking preference, never the page.
await db
  .update(schema.users)
  .set({
    cookTier: "hearthmaster" as never,
    kitchenStock: "" as never,
    cookSkills: { knife: 11, invented: 3, oven: "four" } as never,
  })
  .where(eq(schema.users.id, cook));
expect("an unknown tier reads as unanswered", await getCookProfile(db, cook), {});

await saveCookProfile(db, cook, { tier: "artisan", skills: { knife: 3 } });
expect(
  "and the profile is usable again straight after",
  await getCookProfile(db, cook),
  { tier: "artisan", skills: { knife: 3 } },
);

// --- one account's answers are their own ------------------------------------
expect("nobody else was touched", await getCookProfile(db, other), {});

// --- recipe demands ---------------------------------------------------------
const [recipe] = await db
  .insert(schema.recipes)
  .values({
    ownerId: cook,
    title: "Check: laminated dough",
    ingredients: [],
    steps: [],
    equipment: ["Stand Mixer", "rolling pin", "Food processor (optional)"],
    sourceKind: "manual",
    extractionMethod: "manual",
  })
  .returning({ id: schema.recipes.id });
const recipeId = recipe!.id;

expect(
  "a recipe starts with no stated demands",
  (await getRecipeDemands(db, recipeId))!.skills,
  {},
);

await saveRecipeDemands(db, recipeId, { oven: 5, knife: 2 });
const demands = (await getRecipeDemands(db, recipeId))!;
expect("analysis results persist", demands.skills, { knife: 2, oven: 5 });

// Tools come from the recipe's own equipment list rather than a second column.
expect("equipment maps onto known tools", canonicalTools(demands.equipment), [
  "rolling pin",
  "stand mixer",
]);
expect(
  "optional equipment never gates a recipe",
  canonicalTools(demands.equipment).includes("food processor"),
  false,
);

// --- the whole point --------------------------------------------------------
const profile = await getCookProfile(db, cook);
const fit = fitForCook(
  { ...profile, stock: "basic" },
  { skills: demands.skills, tools: canonicalTools(demands.equipment) },
);
expect("a stretch recipe is a challenge, not a locked door", fit.verdict, "challenge");
expect("...and it says which tool is missing", fit.missingTools, ["stand mixer"]);
expect("...and gives a reason", typeof fit.reason === "string" && fit.reason.length > 0, true);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.id, recipeId));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
