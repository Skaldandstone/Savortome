// Independent writers on the disposable full-schema CI database only.
// No hosted URL, provider invocation or application migration is performed here.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { setRecipeNutrition } from '../packages/db/src/queries/recipes.ts';
import * as schema from '../packages/db/src/schema.ts';
const url = new URL(process.env.DATABASE_URL ?? 'http://not-configured');
assert.equal(process.env.CI, 'true');
assert.ok(['postgresql:', 'postgres:'].includes(url.protocol));
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname, '/savortome_ci');
assert.equal(url.username, 'postgres');
assert.equal(url.search, ''); assert.equal(url.hash, '');
assert.ok(url.port === '' || url.port === '5432');
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg'), { drizzle } = require('drizzle-orm/node-postgres');
const clients = Array.from({ length: 3 }, (_, i) => new Client({ connectionString: url.href, ssl: false, application_name: `savortome-nutrition-fixture-${i}`, connectionTimeoutMillis: 5000 }));
const [editor, estimator, observer] = clients;
const owner = randomUUID(), recipeId = randomUUID();
const original = { ingredients: [{ item: 'rice', quantity: 1 }], servings: 2 };
const late = { method: 'computed', perServing: { calories: 100 }, perIngredient: [] };
let pending, transaction = false;
try {
  await Promise.all(clients.map(c => c.connect()));
  await Promise.all(clients.map(c => c.query("SET statement_timeout='8s'; SET lock_timeout='6s'")));
  const suffix = owner.slice(0, 8);
  await observer.query("INSERT INTO users(id,email,handle,display_name) VALUES($1,$2,$3,'Nutrition fixture')", [owner, `${suffix}@example.test`, `nutrition-${suffix}`]);
  await observer.query("INSERT INTO recipes(id,owner_id,title,ingredients,steps,source_kind,extraction_method) VALUES($1,$2,'Synthetic rice','[]','[]','manual','manual')", [recipeId, owner]);
  const db = drizzle(estimator, { schema });
  const pid = (await estimator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  async function contend(label, statement, values, expectedNutrition) {
    await observer.query('UPDATE recipes SET ingredients=$2::jsonb,servings=$3,nutrition=NULL WHERE id=$1', [recipeId, JSON.stringify(original.ingredients), original.servings]);
    await editor.query('BEGIN'); transaction = true;
    await editor.query(statement, values);
    let settled = false;
    pending = setRecipeNutrition(db, owner, recipeId, late, original).finally(() => { settled = true; });
    pending.catch(() => {});
    let observedLock = false;
    const until = Date.now() + 3000;
    while (Date.now() < until && !settled) {
      const row = (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
      if (row?.wait_event_type === 'Lock') { observedLock = true; break; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(observedLock, true, 'Expected an actual independent PostgreSQL row lock wait');
    await editor.query('COMMIT'); transaction = false;
    assert.equal(await pending, false, 'Late estimate must recheck inputs after the other writer commits');
    pending = undefined;
    const current = (await observer.query('SELECT nutrition FROM recipes WHERE id=$1 AND owner_id=$2', [recipeId, owner])).rows[0];
    assert.deepEqual(current.nutrition, expectedNutrition);
    console.log(`PASS: independent PostgreSQL nutrition ${label}`);
  }
  await contend('ingredient edit rejects stale figures', 'UPDATE recipes SET ingredients=$2::jsonb WHERE id=$1', [recipeId, JSON.stringify([{ item: 'beans', quantity: 3 }])], null);
  await contend('serving edit rejects stale per-serving figures', 'UPDATE recipes SET servings=4 WHERE id=$1', [recipeId], null);
  const newer = { ...late, method: 'published', perServing: { calories: 250 } };
  await contend('competing completed estimate is preserved', 'UPDATE recipes SET nutrition=$2::jsonb WHERE id=$1', [recipeId, JSON.stringify(newer)], newer);
} finally {
  if (transaction) await editor.query('ROLLBACK').catch(() => {});
  await pending?.catch(() => {});
  try { await observer.query('DELETE FROM users WHERE id=$1', [owner]); }
  finally { await Promise.allSettled(clients.map(c => c.end())); }
}
