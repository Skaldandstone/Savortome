import { test, expect } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { clerk } from "@clerk/testing/playwright";

/**
 * The signed-in sweep.
 *
 * This is the case that got away. Account provisioning runs on every
 * signed-in request, so when it threw, `/profile` and `/plan` both returned
 * 500 and the discover search answered "something went wrong on our end" —
 * three separate-looking faults from one line of SQL. Nothing caught it,
 * because nothing had ever loaded a page while signed in.
 *
 * Provisioning only misbehaves against a real database with a real prior row,
 * so `pnpm check:users` covers the SQL directly and this covers the thing a
 * person actually experiences: the page comes up.
 *
 * Needs a Clerk **development/test** instance and a database. Without
 * `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY` and the test user's
 * credentials the whole file skips rather than failing, so a contributor
 * without Clerk access still gets the rest of the suite.
 */

const publishableKey = process.env.E2E_CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.E2E_CLERK_SECRET_KEY;
const identifier = process.env.E2E_CLERK_USER_IDENTIFIER;
const password = process.env.E2E_CLERK_USER_PASSWORD;

const configured = Boolean(publishableKey && secretKey && identifier && password);

test.skip(
  !configured,
  "Signed-in coverage needs E2E_CLERK_PUBLISHABLE_KEY, E2E_CLERK_SECRET_KEY, " +
    "E2E_CLERK_USER_IDENTIFIER and E2E_CLERK_USER_PASSWORD against a Clerk test instance.",
);

const CRASH_HEADING = "The kitchen went dark";

/** Every page a signed-in cook can reach from the navigation. */
const SIGNED_IN_PATHS = [
  "/profile",
  "/plan",
  "/plans",
  "/discover",
  "/care",
  "/cook",
  "/list",
  "/friends",
  "/templates",
];

test.beforeAll(async () => {
  await clerkSetup({ publishableKey, secretKey });
});

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: { strategy: "password", identifier: identifier!, password: password! },
  });
});

test.describe("signed in", () => {
  for (const path of SIGNED_IN_PATHS) {
    test(`${path} renders for a signed-in cook`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response, `${path} returned no response`).not.toBeNull();
      expect(response!.status(), `${path} answered ${response!.status()}`).toBeLessThan(500);
      await expect(
        page.getByRole("heading", { name: CRASH_HEADING }),
        `${path} rendered the crash page`,
      ).toHaveCount(0);
      // Signing in and landing back on the sign-in page means the session
      // never took, which would make every assertion above vacuous.
      expect(page.url(), `${path} bounced back to sign-in`).not.toContain("/sign-in");
    });
  }

  test("the account page survives being loaded twice", async ({ page }) => {
    // Provisioning is an upsert, so the second visit takes the conflict path
    // the first one created. That asymmetry is where the bug lived.
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    const second = await page.goto("/profile", { waitUntil: "domcontentloaded" });

    expect(second!.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: CRASH_HEADING })).toHaveCount(0);
  });
});
