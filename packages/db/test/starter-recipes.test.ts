import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { STARTER_RECIPES, STARTER_RECIPE_AUTHOR } from "@seconds/core";
import { ensureStarterRecipes } from "../src/queries/starter-recipes.js";
import * as schema from "../src/schema.js";

test("starter catalogue is idempotent and repairs an incomplete seed atomically", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE users (
        id uuid PRIMARY KEY, clerk_id text UNIQUE, email text NOT NULL UNIQUE,
        handle text NOT NULL UNIQUE, display_name text NOT NULL, avatar_url text,
        tier text NOT NULL DEFAULT 'free', stripe_customer_id text,
        stripe_subscription_id text, credits_purchased integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'active', dietary_tags text[] NOT NULL DEFAULT '{}',
        cook_tier text, cook_skills jsonb NOT NULL DEFAULT '{}', kitchen_stock text,
        allergens text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE recipes (
        id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title text NOT NULL, description text, image_url text, servings integer, servings_note text,
        prep_minutes integer, cook_minutes integer, total_minutes integer,
        photos jsonb NOT NULL DEFAULT '[]', ingredients jsonb NOT NULL, steps jsonb NOT NULL, equipment text[] NOT NULL DEFAULT '{}',
        tags text[] NOT NULL DEFAULT '{}', cuisine text, course text, difficulty text,
        skill_demands jsonb, source_kind text NOT NULL, source_url text, source_author text,
        source_site_name text, extraction_method text NOT NULL, confidence real NOT NULL DEFAULT 1,
        extraction_notes text[] NOT NULL DEFAULT '{}', verified_at timestamptz,
        visibility text NOT NULL DEFAULT 'private', shared_at timestamptz,
        nutrition jsonb, copied_from_id uuid, embedding text, search_vector tsvector,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE recipe_ingredients (
        recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        canonical_item text NOT NULL, optional boolean NOT NULL DEFAULT false,
        is_staple boolean NOT NULL DEFAULT false,
        PRIMARY KEY(recipe_id, canonical_item)
      );
    `);
    const database = drizzle(pg, { schema }) as unknown as Parameters<typeof ensureStarterRecipes>[0];

    await ensureStarterRecipes(database);
    await ensureStarterRecipes(database);
    assert.equal((await pg.query("select id from recipes")).rows.length, STARTER_RECIPES.length);
    assert.deepEqual(
      (await pg.query("select handle, clerk_id from users")).rows,
      [{ handle: STARTER_RECIPE_AUTHOR.handle, clerk_id: STARTER_RECIPE_AUTHOR.catalogueId }],
    );
    assert.ok((await pg.query("select recipe_id from recipe_ingredients")).rows.length > STARTER_RECIPES.length);

    await pg.exec(`delete from recipes where id = '${STARTER_RECIPES[0]!.id}'`);
    await ensureStarterRecipes(database);
    assert.equal((await pg.query("select id from recipes")).rows.length, STARTER_RECIPES.length);
    assert.deepEqual(
      (await pg.query("select distinct visibility from recipes")).rows,
      [{ visibility: "public" }],
    );
  } finally {
    await pg.close();
  }
});
