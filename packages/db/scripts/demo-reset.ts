/**
 * Puts an account back to a clean demo state.
 *
 *   pnpm demo:reset            # the local development account
 *   pnpm demo:reset <handle>   # someone specific
 *
 * Rehearsing a demo spends credits, and the third run opening on "no AI
 * imports left" is a bad way to find that out. This gives the allowance back.
 *
 * It deliberately does not touch recipes, shelves, ratings, the meal plan or
 * the shopping list. Those are the demo — a reset that wiped them would leave
 * an empty app, which is the opposite of ready. Only the meter is reset.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { TIER_LABEL, describeCredits } from "@seconds/core";
import * as schema from "../src/schema.js";
import { creditsFor } from "../src/queries/credits.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const db = drizzle(new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } }), { schema });

const wanted = process.argv[2];

const users = await db
  .select({ id: schema.users.id, handle: schema.users.handle, tier: schema.users.tier })
  .from(schema.users);

// Without Clerk the app runs on a single local account, whose handle is "you".
const account = wanted
  ? users.find((u) => u.handle === wanted)
  : (users.find((u) => u.handle === "you") ?? users[0]);

if (!account) {
  console.error(
    wanted
      ? `No account with handle "${wanted}". Known: ${users.map((u) => u.handle).join(", ")}`
      : "No accounts in the database yet — sign in once, then run this again.",
  );
  process.exit(1);
}

const before = await creditsFor(db, account.id);

// Only the spend ledger. Purchased credits stay bought: deleting something
// someone paid for to tidy up a demo would be a strange thing to automate.
const removed = await db
  .delete(schema.creditSpends)
  .where(eq(schema.creditSpends.userId, account.id))
  .returning({ id: schema.creditSpends.id });

const after = await creditsFor(db, account.id);

const recipes = await db
  .select({ id: schema.recipes.id })
  .from(schema.recipes)
  .where(eq(schema.recipes.ownerId, account.id));

console.log(`Account   ${account.handle} (${TIER_LABEL[after.tier]})`);
console.log(`Credits   ${describeCredits(before)}  ->  ${describeCredits(after)}`);
console.log(`Cleared   ${removed.length} spend${removed.length === 1 ? "" : "s"}`);
console.log(`Untouched ${recipes.length} recipes, and every shelf, plan and list`);
