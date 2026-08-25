/**
 * End-to-end check of the shelf lifecycle against a running server and a real
 * database. Unit tests cover the rules; this covers the wiring — exclusivity,
 * the cook counter, re-import idempotency, and the guards on built-in shelves.
 *
 *   pnpm check:shelves http://localhost:3000
 *
 * Re-runnable: it resets the test recipe to a known baseline first, so it
 * asserts behaviour rather than whatever state a previous run left behind.
 * It imports a real recipe and leaves it in the library, so point it at a
 * development database.
 */
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const URL_TO_IMPORT = "https://cookieandkate.com/healthy-banana-bread-recipe/";
const TEST_SHELF = "Shelf check scratch";

const j = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

let failures = 0;
const expect = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

// --- import -----------------------------------------------------------------
const imported = await j("/api/import", {
  method: "POST",
  body: JSON.stringify({ url: URL_TO_IMPORT }),
});
if (imported.status !== 200) {
  console.error(`import failed: ${imported.status} ${JSON.stringify(imported.body)?.slice(0, 300)}`);
  process.exit(1);
}
const recipeId = imported.body.recipe.id;
console.log(`imported "${imported.body.recipe.title}" -> ${recipeId}\n`);
expect("import saved the recipe", imported.body.saved, true);

const shelfState = () => j(`/api/recipes/${recipeId}/shelf`).then((r) => r.body);
const setStatus = (status) =>
  j(`/api/recipes/${recipeId}/shelf`, { method: "PUT", body: JSON.stringify({ status }) }).then(
    (r) => r.body,
  );

// --- reset to a known baseline ----------------------------------------------
// Everything below asserts behaviour relative to this point, so a second run
// of the script sees exactly what the first one did.
await j(`/api/recipes/${recipeId}/rating`, { method: "DELETE" });
await setStatus(null);

let state = await shelfState();
expect("baseline: no status", state.status, null);
expect("baseline: no rating", state.rating, null);

// Other recipes may live on these shelves; assert the delta, not the total.
const countOn = async (name) =>
  ((await j("/api/shelves")).body.find((s) => s.name === name)?.recipeCount) ?? 0;
const wantToCookBefore = await countOn("Want to cook");

// --- the importer shelves an unshelved recipe -------------------------------
const reimported = await j("/api/import", {
  method: "POST",
  body: JSON.stringify({ url: URL_TO_IMPORT }),
});
expect("re-import updates the same recipe", reimported.body.recipe.id, recipeId);
state = await shelfState();
expect("importing an unshelved recipe puts it on Want to cook", state.status, "want_to_cook");

// --- status lifecycle -------------------------------------------------------
state = await setStatus("cooking");
expect("moves to Cooking", state.status, "cooking");
expect("moving to Cooking does not count as a cook", state.rating, null);
expect("status shelves stay exclusive", state.shelfIds.length, 1);

state = await setStatus("cooked");
expect("moves to Cooked", state.status, "cooked");
expect("marking Cooked records a cook", state.rating?.timesCooked, 1);
expect("cooked but unrated is 0 stars", state.rating?.stars, 0);

// Bouncing away and back counts a second cook.
await setStatus("cooking");
state = await setStatus("cooked");
expect("cooking it again counts again", state.rating?.timesCooked, 2);

// Re-marking Cooked while already Cooked must not double-count.
state = await setStatus("cooked");
expect("re-marking Cooked does not double-count", state.rating?.timesCooked, 2);

// Pressing the shelf it is already on takes it off.
state = await j(`/api/recipes/${recipeId}/shelf`, {
  method: "PUT",
  body: JSON.stringify({ status: null }),
}).then((r) => r.body);
expect("clearing the status unshelves it", state.status, null);
expect("unshelving keeps the cook history", state.rating?.timesCooked, 2);

// Coming back to Cooked from unshelved is a genuine third cook, so everything
// after this compares against the count as it actually stands.
state = await setStatus("cooked");
expect("re-shelving as Cooked counts a cook", state.rating?.timesCooked, 3);
const cooks = state.rating.timesCooked;

// --- rating -----------------------------------------------------------------
const rated = await j(`/api/recipes/${recipeId}/rating`, {
  method: "PUT",
  body: JSON.stringify({ stars: 4, review: "Good with walnuts." }),
});
expect("rating saves stars", rated.body.stars, 4);
expect("rating leaves the cook count alone", rated.body.timesCooked, cooks);

const badRating = await j(`/api/recipes/${recipeId}/rating`, {
  method: "PUT",
  body: JSON.stringify({ stars: 9 }),
});
expect("rejects an out-of-range rating", badRating.status, 400);

// --- re-import preserves everything -----------------------------------------
await j("/api/import", { method: "POST", body: JSON.stringify({ url: URL_TO_IMPORT }) });
state = await shelfState();
expect("re-import leaves Cooked alone", state.status, "cooked");
expect("re-import keeps the rating", state.rating?.stars, 4);
expect("re-import keeps the cook count", state.rating?.timesCooked, cooks);

// --- custom shelves ---------------------------------------------------------
// Left over from an interrupted run? Remove it so the create below is a real test.
const before = (await j("/api/shelves")).body;
const stale = before.find((s) => s.name === TEST_SHELF);
if (stale) await j(`/api/shelves/${stale.id}`, { method: "DELETE" });

const created = await j("/api/shelves", {
  method: "POST",
  body: JSON.stringify({ name: `  ${TEST_SHELF.replace(" ", "   ")} ` }),
});
expect("creates a custom shelf", created.status, 200);
expect("normalizes the shelf name", created.body.name, TEST_SHELF);
const shelfId = created.body.id;

expect(
  "refuses a duplicate shelf name",
  (await j("/api/shelves", { method: "POST", body: JSON.stringify({ name: TEST_SHELF }) })).status,
  400,
);
expect(
  "refuses a blank shelf name",
  (await j("/api/shelves", { method: "POST", body: JSON.stringify({ name: "   " }) })).status,
  400,
);

state = await j(`/api/recipes/${recipeId}/shelf`, {
  method: "PUT",
  body: JSON.stringify({ shelfId, member: true }),
}).then((r) => r.body);
expect("adds to a custom shelf", state.shelfIds.includes(shelfId), true);
expect("custom shelves sit alongside the status", state.status, "cooked");
expect("now on two shelves", state.shelfIds.length, 2);

// --- guards on the built-in shelves -----------------------------------------
const shelves = (await j("/api/shelves")).body;
const cookedShelfId = shelves.find((s) => s.type === "cooked").id;

expect(
  "built-in shelves reject the custom-shelf path",
  (
    await j(`/api/recipes/${recipeId}/shelf`, {
      method: "PUT",
      body: JSON.stringify({ shelfId: cookedShelfId, member: false }),
    })
  ).status,
  400,
);
expect(
  "built-in shelves cannot be deleted",
  (await j(`/api/shelves/${cookedShelfId}`, { method: "DELETE" })).status,
  400,
);

// --- shelf counts -----------------------------------------------------------
const counts = Object.fromEntries((await j("/api/shelves")).body.map((s) => [s.name, s.recipeCount]));
expect("Cooked holds the recipe", counts["Cooked"] >= 1, true);
expect("Want to cook is back where it started", counts["Want to cook"], wantToCookBefore);
expect("the custom shelf holds it too", counts[TEST_SHELF], 1);

// --- cleanup ----------------------------------------------------------------
expect(
  "custom shelves can be deleted",
  (await j(`/api/shelves/${shelfId}`, { method: "DELETE" })).status,
  200,
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
