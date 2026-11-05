import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Real React, component and CSS in Chromium with synthetic recipe values.
// No application route, Clerk session, DB, API or nutrition provider is used.
let javascript: string;
let css: string;
test.beforeAll(async () => {
  const result = await build({
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    outfile: "nutrition-fixture.js", define: { "process.env.NODE_ENV": '"production"' },
    stdin: {
      resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "tsx",
      contents: `import {createRoot} from 'react-dom/client';
        import {NutritionFacts} from './modules/recipe/NutritionFacts';
        const recipe={nutrition:{method:'computed',perIngredient:[],perServing:{calories:0,proteinGrams:null,carbGrams:null,fatGrams:null,fiberGrams:null,sodiumMg:null}}};
        createRoot(document.getElementById('fixture')).render(<NutritionFacts recipe={recipe} shelvedId={null}/>);`,
    },
    plugins: [{ name: "no-auth-provider", setup(api) {
      api.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({ path: "auth", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const useAuth=()=>{throw Error('Nutrition display must not load auth');};" }));
    } }],
  });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
});

for (const width of [390, 1280]) {
  test(`optional nutrition is keyboard controlled at ${width}px and stays optional in print`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const requests: string[] = [];
    page.on("request", request => requests.push(request.url()));
    await page.setContent('<main id="fixture"></main>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: javascript });
    const summary = page.locator("summary");
    const figures = page.locator("dl");
    await expect(summary).toHaveText("Show optional nutrition figures");
    await expect(figures).toBeHidden();
    await summary.focus();
    await expect(summary).toBeFocused();
    await summary.press("Enter");
    await expect(figures).toBeVisible();
    await expect(page.locator("dd")).toHaveText(["0", ...Array(5).fill("Not available")]);
    await expect(page.getByText(/not a record of what you ate/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await summary.press("Enter");
    await expect(figures).toBeHidden();
    await page.emulateMedia({ media: "print" });
    await expect(figures).toBeHidden();
    expect(requests).toEqual([]);
  });
}
