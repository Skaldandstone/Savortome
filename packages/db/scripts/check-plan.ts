import { connectionOptions } from "../src/connection.js";
/**
 * Checks the meal planner against a real database.
 *
 *   pnpm check:plan
 *
 * The things worth asserting: a week reads back as the week it is, a main and
 * a side can share a slot while a double-tap can't duplicate one, moving a
 * meal leaves exactly one row, and nobody can put anything on anybody else's
 * calendar.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { recipeIdsIn, weekDays, weekEnd, weekStart } from "@seconds/core";
import * as schema from "../src/schema.js";
import {
  addToPlan,
  clearPlanRange,
  movePlanEntry,
  planForRange,
  plannedDatesFor,
  removeFromPlan,
} from "../src/queries/plan.js";

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

// --- fixture ----------------------------------------------------------------
const HANDLES = ["mp-cook", "mp-other"];

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

async function makeRecipe(ownerId: string, title: string): Promise<string> {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId, title,
      ingredients: [], steps: [],
      sourceKind: "manual", extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

const stew = await makeRecipe(cook, "Kimchi stew");
const salad = await makeRecipe(cook, "Green salad");
const cake = await makeRecipe(cook, "Lemon cake");
const theirs = await makeRecipe(other, "Not yours");

// A Wednesday, so the week-start maths has to do real work.
const MONDAY = weekStart("2026-09-02");
const [mon, tue, wed] = weekDays(MONDAY) as [string, string, string];

expect("the week starts on Monday", MONDAY, "2026-08-31");

// --- planning ---------------------------------------------------------------
expect("a recipe goes on a day", await addToPlan(db, cook, stew, mon, "dinner"), true);
expect(
  "a main and a side can share one slot",
  await addToPlan(db, cook, salad, mon, "dinner"),
  true,
);
await addToPlan(db, cook, cake, wed, "lunch");

const week = await planForRange(db, cook, MONDAY, weekEnd(MONDAY));
expect("the week reads back", week.length, 3);
expect(
  "...with the recipe's own details joined in",
  week.find((m) => m.recipeId === stew)?.title,
  "Kimchi stew",
);
expect(
  "...and the date as the day it was planned for, not a timestamp",
  week.find((m) => m.recipeId === stew)?.date,
  mon,
);

// --- double taps ------------------------------------------------------------
await addToPlan(db, cook, stew, mon, "dinner");
expect(
  "planning the same recipe twice in one slot is a no-op, not a duplicate",
  (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).filter((m) => m.recipeId === stew).length,
  1,
);
expect(
  "...but the same recipe on two different days is fine",
  await addToPlan(db, cook, stew, tue, "lunch"),
  true,
);

// --- other people -----------------------------------------------------------
expect("you can't plan someone else's recipe", await addToPlan(db, cook, theirs, mon, "dinner"), false);
expect("...and nothing was written", (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).length, 4);
expect("nobody else sees your plan", (await planForRange(db, other, MONDAY, weekEnd(MONDAY))).length, 0);

// --- moving -----------------------------------------------------------------
await movePlanEntry(db, cook, cake, { date: wed, slot: "lunch" }, { date: tue, slot: "dinner" });
const moved = await planForRange(db, cook, MONDAY, weekEnd(MONDAY));
expect(
  "a moved meal leaves exactly one row",
  moved.filter((m) => m.recipeId === cake).length,
  1,
);
expect(
  "...at the new day and slot",
  moved.filter((m) => m.recipeId === cake).map((m) => [m.date, m.slot])[0],
  [tue, "dinner"],
);

// Moving onto a slot that already holds it must not leave two, nor throw.
await addToPlan(db, cook, salad, tue, "dinner");
await movePlanEntry(db, cook, salad, { date: mon, slot: "dinner" }, { date: tue, slot: "dinner" });
expect(
  "moving onto a slot that already has it collapses to one",
  (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).filter((m) => m.recipeId === salad).length,
  1,
);

// --- the shopping trip ------------------------------------------------------
expect(
  "a recipe planned twice is one shopping trip",
  recipeIdsIn(await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).length,
  3,
);

// --- what's already planned -------------------------------------------------
const planned = await plannedDatesFor(db, cook, [stew, cake]);
expect("a card can say which days it's planned for", planned.get(stew)?.sort(), [mon, tue].sort());
expect("...and says nothing for one that isn't", planned.get(await makeRecipe(cook, "Unplanned")), undefined);

// --- range boundaries -------------------------------------------------------
await addToPlan(db, cook, stew, weekEnd(MONDAY), "dinner");
expect(
  "the last day of the week is inside the week",
  (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).some((m) => m.date === weekEnd(MONDAY)),
  true,
);
const nextMonday = weekDays(weekStart("2026-09-09"))[0]!;
await addToPlan(db, cook, stew, nextMonday, "dinner");
expect(
  "...and next week's Monday is not",
  (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).some((m) => m.date === nextMonday),
  false,
);

// --- removing ---------------------------------------------------------------
await removeFromPlan(db, cook, stew, mon, "dinner");
expect(
  "removing takes just that meal",
  (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).some(
    (m) => m.recipeId === stew && m.date === mon,
  ),
  false,
);

await clearPlanRange(db, cook, MONDAY, weekEnd(MONDAY));
expect("clearing empties the week", (await planForRange(db, cook, MONDAY, weekEnd(MONDAY))).length, 0);
expect(
  "...and leaves next week alone",
  (await planForRange(db, cook, nextMonday, nextMonday)).length,
  1,
);

// --- cascade ----------------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.id, stew));
expect(
  "deleting a recipe takes it off the calendar",
  (await planForRange(db, cook, nextMonday, nextMonday)).length,
  0,
);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
