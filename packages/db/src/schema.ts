import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { Ingredient, Step } from "@nomnom/core";

/**
 * The full NomNom data model. Only the recipe/import path is wired up in the
 * app today, but shelves, ratings, friends, pantry, and lists are defined here
 * so later slices land as features rather than migrations of live data.
 */

export const sourceKind = pgEnum("source_kind", [
  "youtube", "tiktok", "instagram", "facebook", "web", "manual", "text",
]);

export const extractionMethod = pgEnum("extraction_method", [
  "schema-org", "article-llm", "transcript-llm", "caption-llm", "manual",
]);

/** Mirrors Goodreads' want-to-read / reading / read triad. */
export const shelfType = pgEnum("shelf_type", ["want_to_cook", "cooking", "cooked", "custom"]);

export const visibility = pgEnum("visibility", ["private", "friends", "public"]);

export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted", "blocked"]);

export const importStatus = pgEnum("import_status", [
  "queued", "resolving", "extracting", "ready", "failed",
]);

// ---------------------------------------------------------------- people

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Clerk's user id. Nullable only so a local dev run works before Clerk keys
     * are configured; every real account has one.
     */
    clerkId: text("clerk_id"),
    email: text("email").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_idx").on(t.clerkId),
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_handle_idx").on(t.handle),
  ],
);

/**
 * One row per direction, so "who are my friends" is a single indexed lookup
 * and a pending request is distinguishable from an accepted one.
 */
export const friendships = pgTable(
  "friendships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.friendId] }), index("friendships_friend_idx").on(t.friendId)],
);

// ---------------------------------------------------------------- recipes

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),

    servings: integer("servings"),
    servingsNote: text("servings_note"),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"),

    /**
     * Ingredients and steps are stored as JSONB rather than child tables: they
     * are always read and written as a whole card, never queried row-by-row.
     * Ingredient *search* goes through `recipeIngredients` below instead.
     */
    ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
    steps: jsonb("steps").$type<Step[]>().notNull(),
    equipment: text("equipment").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),

    cuisine: text("cuisine"),
    course: text("course"),
    difficulty: text("difficulty"),

    sourceKind: sourceKind("source_kind").notNull(),
    sourceUrl: text("source_url"),
    sourceAuthor: text("source_author"),
    sourceSiteName: text("source_site_name"),
    extractionMethod: extractionMethod("extraction_method").notNull(),
    /** 0-1 from the extractor; drives the "double-check this" badge. */
    confidence: real("confidence").notNull().default(1),
    extractionNotes: text("extraction_notes").array().notNull().default([]),
    /** Set once a human has reviewed an imported card. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    visibility: visibility("visibility").notNull().default("private"),

    /** Title + tags + ingredients, embedded for semantic discovery and pantry search. */
    embedding: vector("embedding", { dimensions: 1024 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recipes_owner_idx").on(t.ownerId, t.createdAt),
    index("recipes_visibility_idx").on(t.visibility, t.createdAt),
    // Re-importing the same link should update the existing card, not duplicate it.
    uniqueIndex("recipes_owner_source_idx").on(t.ownerId, t.sourceUrl).where(sql`${t.sourceUrl} is not null`),
  ],
);

/**
 * Flattened ingredient index. One row per (recipe, canonical ingredient), which
 * is what "what can I make from what's in my kitchen" actually joins against —
 * a JSONB containment query over the card can't be indexed usefully at scale.
 */
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    canonicalItem: text("canonical_item").notNull(),
    optional: boolean("optional").notNull().default(false),
    /** True for salt, oil, and the like — missing these shouldn't disqualify a match. */
    isStaple: boolean("is_staple").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.canonicalItem] }),
    index("recipe_ingredients_item_idx").on(t.canonicalItem),
  ],
);

// ---------------------------------------------------------------- imports

/** An in-flight or finished import, so the UI can show progress and failures survive a refresh. */
export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url"),
    rawText: text("raw_text"),
    status: importStatus("status").notNull().default("queued"),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    /** The pipeline trace — which resolver ran, whether a model call was needed. */
    trace: text("trace").array().notNull().default([]),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("imports_user_idx").on(t.userId, t.createdAt)],
);

// ---------------------------------------------------------------- shelves & ratings

export const shelves = pgTable(
  "shelves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: shelfType("type").notNull().default("custom"),
    visibility: visibility("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("shelves_user_name_key").on(t.userId, t.name),
    // At most one shelf per built-in status, so "which status is this recipe at"
    // is always a single unambiguous answer.
    uniqueIndex("shelves_user_status_idx")
      .on(t.userId, t.type)
      .where(sql`${t.type} <> 'custom'`),
  ],
);

export const shelfRecipes = pgTable(
  "shelf_recipes",
  {
    shelfId: uuid("shelf_id").notNull().references(() => shelves.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shelfId, t.recipeId] }), index("shelf_recipes_recipe_idx").on(t.recipeId)],
);

export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    review: text("review"),
    /** Times this person has actually cooked it — a stronger signal than stars alone. */
    timesCooked: integer("times_cooked").notNull().default(0),
    lastCookedAt: timestamp("last_cooked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.recipeId] }), index("ratings_recipe_idx").on(t.recipeId)],
);

// ---------------------------------------------------------------- pantry, lists, carts

export const pantryItems = pgTable(
  "pantry_items",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    canonicalItem: text("canonical_item").notNull(),
    displayName: text("display_name").notNull(),
    quantity: real("quantity"),
    unit: text("unit"),
    /** Always-on-hand items the matcher can assume without the user re-adding them. */
    isStaple: boolean("is_staple").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.canonicalItem] })],
);

export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Shopping list"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").notNull().references(() => shoppingLists.id, { onDelete: "cascade" }),
    canonicalItem: text("canonical_item").notNull(),
    displayName: text("display_name").notNull(),
    /** Summed across every recipe on the list, per unit. */
    quantity: real("quantity"),
    unit: text("unit"),
    /** Which recipes contributed this line, so the user can see why it's here. */
    recipeIds: uuid("recipe_ids").array().notNull().default([]),
    checked: boolean("checked").notNull().default(false),
  },
  (t) => [index("shopping_list_items_list_idx").on(t.listId)],
);

/**
 * Record of pushing a list to a grocery or delivery service. Instacart and
 * Kroger have real cart APIs; the rest are deep links, and we keep the same
 * row shape for both so the history reads consistently.
 */
export const cartHandoffs = pgTable(
  "cart_handoffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").notNull().references(() => shoppingLists.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    /** The URL we sent the user to — a provider cart page or a search deep link. */
    handoffUrl: text("handoff_url").notNull(),
    /** Items we could not map to the provider's catalogue. */
    unmatchedItems: text("unmatched_items").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cart_handoffs_list_idx").on(t.listId)],
);

// ---------------------------------------------------------------- relations

export const usersRelations = relations(users, ({ many }) => ({
  recipes: many(recipes),
  shelves: many(shelves),
  ratings: many(ratings),
  pantryItems: many(pantryItems),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  ingredientIndex: many(recipeIngredients),
  shelfEntries: many(shelfRecipes),
  ratings: many(ratings),
}));

export const shelvesRelations = relations(shelves, ({ one, many }) => ({
  user: one(users, { fields: [shelves.userId], references: [users.id] }),
  entries: many(shelfRecipes),
}));

export const shelfRecipesRelations = relations(shelfRecipes, ({ one }) => ({
  shelf: one(shelves, { fields: [shelfRecipes.shelfId], references: [shelves.id] }),
  recipe: one(recipes, { fields: [shelfRecipes.recipeId], references: [recipes.id] }),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
}));
