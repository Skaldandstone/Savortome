import type { RecipeRating, RecipeShelfState, ShelfSummary, StatusShelf } from "./shelves.js";
import type { PantryEntry, PantryMatch } from "./pantry.js";
import type { ShoppingLine } from "./shopping.js";
import type { CartHandoff, CartProvider, CartProviderId } from "./carts.js";
import type { Visibility } from "./shelves.js";
import type { FeedItem, FriendsOverview } from "./friends.js";

/** A recipe someone else has shared, as it appears while browsing. */
export interface DiscoverCard {
  recipeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  cuisine: string | null;
  sharedBy: { handle: string; displayName: string; avatarUrl: string | null };
  saveCount: number;
  /** Why this is in front of you. Only set by "more like this". */
  reason?: string;
}

export interface DiscoverResponse {
  recipes: DiscoverCard[];
  tags: { tag: string; count: number }[];
  query: string;
  appliedTags: string[];
}

/** A row in your own library. */
export interface LibraryRecipe {
  id: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  ingredientCount: number;
  attribution: string;
  status: StatusShelf | null;
  visibility: Visibility;
}

/** A shared recipe plus what the viewer may do with it. */
export interface SharedRecipeResponse {
  recipe: Recipe;
  view: SharedRecipeView;
}

/** A recipe you own, including who can see it. */
export type OwnedRecipe = Recipe & { visibility: Visibility };

export interface LibraryResponse {
  shelves: ShelfSummary[];
  recipes: LibraryRecipe[];
}

export interface DiscoverQuery {
  query?: string;
  tags?: string[];
  maxMinutes?: number | null;
}
import type { ImportRequest, ImportResponse } from "./import-client.js";
import type { Recipe } from "./recipe.js";
import type { SharedRecipeView } from "./sharing.js";

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

export interface ShoppingListView {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
  checkedCount: number;
  items: (ShoppingLine & { id: string })[];
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
  getRecipe: (recipeId: string) => Promise<OwnedRecipe>;
  getSharedRecipe: (recipeId: string) => Promise<SharedRecipeResponse>;
  getList: () => Promise<ShoppingListView>;
  addRecipesToList: (recipeIds: string[]) => Promise<ShoppingListView>;
  addItemsToList: (
    items: { canonicalItem: string; displayName?: string }[],
  ) => Promise<ShoppingListView>;
  setListItemChecked: (itemId: string, checked: boolean) => Promise<ShoppingListView>;
  removeListItem: (itemId: string) => Promise<ShoppingListView>;
  clearList: () => Promise<ShoppingListView>;
  cartProviders: () => Promise<CartProvider[]>;
  sendToCart: (provider: CartProviderId) => Promise<CartHandoff>;
  setVisibility: (recipeId: string, visibility: Visibility) => Promise<{ visibility: Visibility | null }>;
  saveSharedRecipe: (recipeId: string) => Promise<{ recipeId: string }>;
  friends: () => Promise<FriendsOverview>;
  addFriend: (handle: string) => Promise<FriendsOverview>;
  updateFriendship: (
    personId: string,
    action: "accept" | "remove" | "block" | "unblock",
  ) => Promise<FriendsOverview>;
  feed: () => Promise<FeedItem[]>;
  discover: (query?: DiscoverQuery) => Promise<DiscoverResponse>;
  similarRecipes: (recipeId: string) => Promise<DiscoverCard[]>;
  library: (shelfId?: string) => Promise<LibraryResponse>;
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

    getRecipe: (recipeId) => send<OwnedRecipe>(`/api/recipes/${recipeId}`),

    getSharedRecipe: (recipeId) => send<SharedRecipeResponse>(`/api/shared/${recipeId}`),

    getList: () => send<ShoppingListView>("/api/list"),

    addRecipesToList: (recipeIds) =>
      send<ShoppingListView>("/api/list", { method: "POST", body: body({ recipeIds }) }),

    addItemsToList: (items) =>
      send<ShoppingListView>("/api/list", { method: "POST", body: body({ items }) }),

    setListItemChecked: (itemId, checked) =>
      send<ShoppingListView>(`/api/list/items/${itemId}`, {
        method: "PATCH",
        body: body({ checked }),
      }),

    removeListItem: (itemId) =>
      send<ShoppingListView>(`/api/list/items/${itemId}`, { method: "DELETE" }),

    clearList: () => send<ShoppingListView>("/api/list", { method: "DELETE" }),

    cartProviders: () => send<CartProvider[]>("/api/list/cart"),

    sendToCart: (provider) =>
      send<CartHandoff>("/api/list/cart", { method: "POST", body: body({ provider }) }),

    setVisibility: (recipeId, visibility) =>
      send<{ visibility: Visibility | null }>(`/api/recipes/${recipeId}/share`, {
        method: "PUT",
        body: body({ visibility }),
      }),

    saveSharedRecipe: (recipeId) =>
      send<{ recipeId: string }>(`/api/recipes/${recipeId}/save`, { method: "POST" }),

    friends: () => send<FriendsOverview>("/api/friends"),

    addFriend: (handle) =>
      send<FriendsOverview>("/api/friends", { method: "POST", body: body({ handle }) }),

    updateFriendship: (personId, action) =>
      send<FriendsOverview>(`/api/friends/${personId}`, {
        method: "PATCH",
        body: body({ action }),
      }),

    feed: () => send<FeedItem[]>("/api/feed"),

    discover: (query = {}) => {
      const params = new URLSearchParams();
      if (query.query) params.set("q", query.query);
      for (const tag of query.tags ?? []) params.append("tag", tag);
      if (query.maxMinutes) params.set("maxMinutes", String(query.maxMinutes));
      const qs = params.toString();
      return send<DiscoverResponse>(`/api/discover${qs ? `?${qs}` : ""}`);
    },

    similarRecipes: (recipeId) => send<DiscoverCard[]>(`/api/recipes/${recipeId}/similar`),

    library: (shelfId) =>
      send<LibraryResponse>(`/api/recipes${shelfId ? `?shelf=${shelfId}` : ""}`),
  };
}
