import { test, expect } from "@playwright/test";

test("open library supports search, credited details and return to results", async ({ page }) => {
  await page.goto("/discover/open");
  const library = page.locator('main[data-kitchen-page="open-recipes"]');
  await expect(library.getByRole("heading", { name: "Open recipe library" })).toBeVisible();
  await expect(library.locator("ul > li > a")).toHaveCount(24);
  await library.getByLabel("Search recipes or ingredients").fill("rice");
  await library.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=rice/);
  await library.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const selected = library.locator("ul > li > a").first();
  const title = await selected.innerText();
  await selected.click();
  await expect(library.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(library.getByRole("heading", { name: "Ingredients", exact: true })).toBeVisible();
  await expect(library.getByRole("heading", { name: "Directions", exact: true })).toBeVisible();
  await expect(library.locator("article ol > li").first()).toBeVisible();
  await expect(library.locator('article a[href^="https://en.wikibooks.org/wiki/Cookbook:"]')).toHaveCount(1);
  await expect(library.getByRole("link", { name: "Creative Commons Attribution-ShareAlike 4.0", exact: true }))
    .toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await library.getByRole("link", { name: "Back to recipe library", exact: true }).click();
  await expect(page).toHaveURL(/q=rice&page=2$/);
  await expect(library.getByLabel("Search recipes or ingredients")).toHaveValue("rice");
  await expect(library.locator("ul > li > a")).toHaveCount(24);
});

test("an empty library search offers a working recovery", async ({ page }) => {
  await page.goto("/discover/open?q=zzzznonexistentingredientzzzz&page=999");
  const library = page.locator('main[data-kitchen-page="open-recipes"]');
  await expect(library.getByRole("status")).toHaveText("0 recipes · Page 1 of 1");
  await expect(library).toContainText("No recipes match. Try another ingredient or a shorter search.");
  await expect(library.locator("ul > li > a")).toHaveCount(0);
  await library.getByLabel("Search recipes or ingredients").fill("");
  await library.getByRole("button", { name: "Search", exact: true }).click();
  await expect(library.locator("ul > li > a")).toHaveCount(24);
});
