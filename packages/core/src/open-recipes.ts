// Keep this subpath separate from the root export: the catalogue belongs on
// the server, not in every mobile/web client bundle.
import library from "./data/open-recipes.json";

export const OPEN_RECIPE_LIBRARY = library;
export type OpenRecipe = (typeof library.recipes)[number];

export function findOpenRecipe(id: string): OpenRecipe | undefined {
  return library.recipes.find(recipe => recipe.id === id);
}

export function searchOpenRecipes(query: string, page = 1) {
  const terms = query.trim().toLocaleLowerCase("en").slice(0, 200).split(/\s+/).filter(Boolean);
  const matches = library.recipes.filter(recipe => {
    const haystack = [recipe.title, ...recipe.ingredients].join(" ").toLocaleLowerCase("en");
    return terms.every(term => haystack.includes(term));
  });
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const currentPage = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  return { recipes: matches.slice((currentPage - 1) * 24, currentPage * 24), total: matches.length, page: currentPage, pages };
}
