// Actual query against disposable PGlite. No hosted database or provider access.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { setRecipeNutrition } from '../packages/db/src/queries/recipes.ts';
import * as schema from '../packages/db/src/schema.ts';
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const id = '10000000-0000-4000-8000-000000000003';
const original = { ingredients: [{ item: 'rice', quantity: 1 }], servings: 2 };
const nutrition = { method: 'computed', perServing: { calories: 100 }, perIngredient: [] };

test('late nutrition results preserve recipe inputs and tenant ownership', async t => {
  const pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL,ingredients jsonb NOT NULL,servings integer,nutrition jsonb);');
    const db = drizzle(pg, { schema });
    const reset = async (snapshot = original, value = null) => {
      await pg.query('DELETE FROM recipes');
      await pg.query('INSERT INTO recipes VALUES($1,$2,$3::jsonb,$4,$5::jsonb)', [id,owner,JSON.stringify(snapshot.ingredients),snapshot.servings,JSON.stringify(value)]);
      // SQL NULL is distinct from JSON null, matching the actual column.
      if (value === null) await pg.query('UPDATE recipes SET nutrition=NULL');
    };
    const saved = async () => (await pg.query('SELECT nutrition FROM recipes')).rows[0]?.nutrition;
    await t.test('unchanged ingredients and servings accept the estimate', async () => {
      await reset(); assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),true);
      assert.deepEqual(await saved(),nutrition);
    });
    await t.test('ingredient edit while calculation is pending refuses old figures', async () => {
      await reset({ ...original, ingredients: [{ item: 'beans', quantity: 3 }] });
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),false); assert.equal(await saved(),null);
    });
    await t.test('serving edit refuses old per-serving figures', async () => {
      await reset({ ...original, servings: 4 });
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),false); assert.equal(await saved(),null);
    });
    await t.test('another completed estimate cannot be overwritten', async () => {
      const newer = { ...nutrition, method: 'published' }; await reset(original,newer);
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),false); assert.deepEqual(await saved(),newer);
    });
    await t.test('unknown servings compare as unknown rather than zero', async () => {
      const unknown = { ...original, servings: null }; await reset(unknown);
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),false);
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,unknown),true);
    });
    await t.test('foreign owner and deleted recipe never receive estimates', async () => {
      await reset(); assert.equal(await setRecipeNutrition(db,other,id,nutrition,original),false);
      assert.equal(await saved(),null); await pg.query('DELETE FROM recipes');
      assert.equal(await setRecipeNutrition(db,owner,id,nutrition,original),false);
    });
  } finally { await pg.close(); }
});
