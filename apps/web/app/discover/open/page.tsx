import Link from "next/link";
import { notFound } from "next/navigation";
import { findOpenRecipe, OPEN_RECIPE_LIBRARY, searchOpenRecipes } from "@seconds/core/open-recipes";
import { KitchenPageHeading } from "@/modules/woodland/KitchenPageHeading";

export const dynamic = "force-dynamic";

export default async function OpenRecipeLibrary({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; recipe?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const recipeId = typeof params.recipe === "string" ? params.recipe : "";
  const selected = recipeId ? findOpenRecipe(recipeId) : undefined;
  if (recipeId && !selected) notFound();
  const result = searchOpenRecipes(q, Number(params.page ?? 1));
  const pageUrl = (page: number) => `/discover/open?${new URLSearchParams({ q, page: String(page) })}`;
  return <main className="woodland-workspace" data-kitchen-page="open-recipes">
    <KitchenPageHeading title={selected?.title ?? "Open recipe library"} description={`${OPEN_RECIPE_LIBRARY.recipes.length.toLocaleString()} community recipes from Wikibooks Cookbook.`} icon="book" />
    <p><Link href="/discover">Back to Discover</Link></p>
    <p>These recipes have been checked for complete ingredient and direction sections, but have not been cooking-tested by Savortome. Check ingredients, cooking instructions and suitability for your kitchen.</p>
    {selected ? <article>
      <p><Link href={pageUrl(result.page)}>Back to recipe library</Link></p>
      <h2>Ingredients</h2>
      <ul>{selected.ingredients.map((line, index) => <li key={index}>{line}</li>)}</ul>
      <h2>Directions</h2>
      <ol>{selected.steps.map((line, index) => <li key={index}>{line}</li>)}</ol>
      <p>Source: <a href={selected.sourceUrl} rel="noreferrer">{selected.title}, Wikibooks contributors</a>.</p>
      <p><a href={selected.licenseUrl} rel="noreferrer">Creative Commons Attribution-ShareAlike 4.0</a>. Adaptations of this recipe must retain attribution and the applicable share-alike license.</p>
      <p>{selected.modifications} Snapshot: {OPEN_RECIPE_LIBRARY.sourceSnapshotDate}. Source timing and servings have not been independently verified.</p>
    </article> : <>
      <form action="/discover/open" method="get">
        <label htmlFor="recipe-query">Search recipes or ingredients</label>{" "}
        <input id="recipe-query" name="q" defaultValue={q} maxLength={200} />{" "}
        <button type="submit">Search</button>
      </form>
      <p role="status">{result.total.toLocaleString()} recipes · Page {result.page} of {result.pages}</p>
      <ul>{result.recipes.map(recipe => <li key={recipe.id}><Link href={`/discover/open?${new URLSearchParams({ q, page: String(result.page), recipe: recipe.id })}`}>{recipe.title}</Link></li>)}</ul>
      {result.total === 0 && <p>No recipes match. Try another ingredient or a shorter search.</p>}
      <nav aria-label="Recipe library pages">
        {result.page > 1 && <Link href={pageUrl(result.page - 1)}>Previous page</Link>}{" "}
        {result.page < result.pages && <Link href={pageUrl(result.page + 1)}>Next page</Link>}
      </nav>
      <p>Recipe text: <a href={OPEN_RECIPE_LIBRARY.licenseUrl}>CC BY-SA 4.0</a>, credited individually to Wikibooks contributors. No images imported.</p>
    </>}
  </main>;
}
