import type { RecipeRating, RecipeShelfState, ShelfSummary, StatusShelf } from "./shelves.js";
import type { PantryEntry, PantryMatch } from "./pantry.js";
import type { ImportRequest, ImportResponse } from "./import-client.js";
import type { Recipe } from "./recipe.js";

/**
 * One typed client for the NomNom HTTP API, shared by both apps.
 *
 * The web app talks to its own origin with a session cookie; the mobile app
 * talks to a host over the network with a bearer token. That difference is the
 * whole reason this takes a config object — everything else is identical, and
 * duplicating it per platform is how the two drift apart.
 */

export interface ApiClientConfig {
  /** Empty for same-origin (web); the server's address on mobile. */
  baseUrl?: string;
  /** Supplies a Clerk session token per request. Omit on web — the cookie does it. */
  getToken?: () => Promise<string | null>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly trace?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** One row of "what can I make", with enough to render it without a second call. */
export interface PantrySearchResult extends PantryMatch {
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  timesCooked: number;
}

export interface PantrySearchResponse {
  /** The filters that were actually applied, after any interpretation. */
  query: {
    ingredients: string[];
    excludeIngredients: string[];
    tags: string[];
    maxMinutes: number | null;
    course: string | null;
  };
  results: PantrySearchResult[];
  /** True when a model read the request rather than it being taken as a list. */
  interpreted: boolean;
  /** True when the saved pantry was used because no ingredients were typed. */
  usedPantry: boolean;
  /** Set when smart search was unavailable and the query was handled plainly. */
  note?: string;
}

export interface NomNomClient {
  importRecipe: (request: ImportRequest) => Promise<ImportResponse>;
  listShelves: () => Promise<ShelfSummary[]>;
  createShelf: (name: string) => Promise<ShelfSummary>;
  deleteShelf: (shelfId: string) => Promise<void>;
  renameShelf: (shelfId: string, name: string) => Promise<void>;
  getShelfState: (recipeId: string) => Promise<RecipeShelfState>;
  setStatus: (recipeId: string, status: StatusShelf | null) => Promise<RecipeShelfState>;
  setShelfMembership: (
    recipeId: string,
    shelfId: string,
    member: boolean,
  ) => Promise<RecipeShelfState>;
  rateRecipe: (recipeId: string, stars: number, review?: string | null) => Promise<RecipeRating>;
  clearRating: (recipeId: string) => Promise<void>;
  listPantry: () => Promise<PantryEntry[]>;
  addPantry: (text: string) => Promise<PantryEntry[]>;
  removePantry: (canonicalItems: string[]) => Promise<PantryEntry[]>;
  clearPantry: () => Promise<PantryEntry[]>;
  searchPantry: (query?: string) => Promise<PantrySearchResponse>;
  getRecipe: (recipeId: string) => Promise<Recipe>;
}

export function createClient(config: ApiClientConfig = {}): NomNomClient {
  const base = (config.baseUrl ?? "").replace(/\/$/, "");

  async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = config.getToken ? await config.getToken() : null;

    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    let payload: (T & { error?: string; trace?: string[] }) | null = null;
    try {
      payload = (await res.json()) as T & { error?: string; trace?: string[] };
    } catch {
      // A non-JSON body means something upstream failed; the status says enough.
    }

    if (!res.ok) {
      throw new ApiError(
        payload?.error ?? `Request failed (${res.status}).`,
        res.status,
        payload?.trace,
      );
    }
    return payload as T;
  }

  const body = (value: unknown) => JSON.stringify(value);

  return {
    importRecipe: (request) =>
      send<ImportResponse>("/api/import", { method: "POST", body: body(request) }),

    listShelves: () => send<ShelfSummary[]>("/api/shelves"),

    createShelf: (name) =>
      send<ShelfSummary>("/api/shelves", { method: "POST", body: body({ name }) }),

    deleteShelf: async (shelfId) => {
      await send(`/api/shelves/${shelfId}`, { method: "DELETE" });
    },

    renameShelf: async (shelfId, name) => {
      await send(`/api/shelves/${shelfId}`, { method: "PATCH", body: body({ name }) });
    },

    getShelfState: (recipeId) => send<RecipeShelfState>(`/api/recipes/${recipeId}/shelf`),

    setStatus: (recipeId, status) =>
      send<RecipeShelfState>(`/api/recipes/${recipeId}/shelf`, {
        method: "PUT",
        body: body({ status }),
      }),

    setShelfMembership: (recipeId, shelfId, member) =>
      send<RecipeShelfState>(`/api/recipes/${recipeId}/shelf`, {
        method: "PUT",
        body: body({ shelfId, member }),
      }),

    rateRecipe: (recipeId, stars, review = null) =>
      send<RecipeRating>(`/api/recipes/${recipeId}/rating`, {
        method: "PUT",
        body: body({ stars, review }),
      }),

    clearRating: async (recipeId) => {
      await send(`/api/recipes/${recipeId}/rating`, { method: "DELETE" });
    },

    listPantry: () => send<PantryEntry[]>("/api/pantry"),

    addPantry: (text) =>
      send<PantryEntry[]>("/api/pantry", { method: "POST", body: body({ text }) }),

    removePantry: (canonicalItems) =>
      send<PantryEntry[]>("/api/pantry", {
        method: "DELETE",
        body: body({ items: canonicalItems }),
      }),

    clearPantry: () =>
      send<PantryEntry[]>("/api/pantry", { method: "DELETE", body: body({ all: true }) }),

    searchPantry: (query) =>
      send<PantrySearchResponse>("/api/pantry/search", {
        method: "POST",
        body: body({ query: query ?? "" }),
      }),

    getRecipe: (recipeId) => send<Recipe>(`/api/recipes/${recipeId}`),
  };
}
