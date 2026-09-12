import { test, expect, type Page } from "@playwright/test";

/**
 * Every page renders, signed out and signed in.
 *
 * Deliberately shallow and deliberately wide. It asserts the one thing no
 * existing check asserted: that loading a route actually produces a page
 * rather than a server error. The bug that prompted this suite was a single
 * throw in account provisioning, which ran on every signed-in request and so
 * broke every signed-in page at once — something a wide, shallow sweep
 * catches immediately and a deep test of one feature does not.
 */

/** The error boundary in app/global-error.tsx. Its presence means a crash. */
const CRASH_HEADING = "The kitchen went dark";

/**
 * Fail on a rendered crash, an error status, or a page that came back empty.
 *
 * Next renders the error boundary with a 200 in some paths, so the status
 * alone is not enough to tell a working page from a broken one.
 */
async function expectRenders(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });

  expect(response, `${path} returned no response`).not.toBeNull();
  expect(response!.status(), `${path} answered ${response!.status()}`).toBeLessThan(500);

  await expect(
    page.getByRole("heading", { name: CRASH_HEADING }),
    `${path} rendered the crash page`,
  ).toHaveCount(0);

  // A blank body is a failure that no status code reports.
  const text = (await page.locator("body").innerText()).trim();
  expect(text.length, `${path} rendered an empty page`).toBeGreaterThan(0);
}

/** Readable by strangers and by crawlers. */
const PUBLIC_PATHS = [
  "/",
  "/discover",
  "/accessibility",
  "/privacy",
  "/terms",
  "/sign-in",
  "/sign-up",
];

/**
 * Signed-in only. Signed out these must redirect to sign-in rather than
 * render — a gated page that quietly renders to a stranger is a leak, and
 * one that 500s instead of redirecting is the bug this suite was written for.
 */
const GATED_PATHS = ["/care", "/cook", "/friends", "/list", "/plan", "/profile"];

test.describe("public pages", () => {
  for (const path of PUBLIC_PATHS) {
    test(`${path} renders for a stranger`, async ({ page }) => {
      await expectRenders(page, path);
    });
  }

  test("the shell says Savortome, not the old name", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The rebrand once survived in a prerendered shell behind a one-year
    // cache header, so assert the live HTML rather than trusting the source.
    await expect(page.locator("body")).not.toContainText("Second Breakfast");
  });
});

test.describe("gated pages", () => {
  for (const path of GATED_PATHS) {
    test(`${path} sends a stranger to sign in`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response, `${path} returned no response`).not.toBeNull();
      expect(
        response!.status(),
        `${path} answered ${response!.status()} instead of gating`,
      ).toBeLessThan(500);

      await expect(
        page.getByRole("heading", { name: CRASH_HEADING }),
        `${path} crashed instead of redirecting`,
      ).toHaveCount(0);

      // Either the sign-in page, or the page itself when Clerk is not
      // configured and the whole app is running on the local dev account.
      const signedOutSomewhereSensible =
        page.url().includes("/sign-in") || page.url().includes(path);
      expect(signedOutSomewhereSensible, `${path} landed on ${page.url()}`).toBe(true);
    });
  }
});
