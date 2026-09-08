import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { fulfilmentFor, productById } from '@seconds/core';
import * as schema from '../src/schema.js';
import { connectionOptions } from '../src/connection.js';
import { applyPurchase, claimStripeEvent, linkStripeCustomer, lockBillingUser } from '../src/queries/billing.js';
import { requireBetaDatabaseUrl } from './beta-database.js';

// No Stripe requests or real customers. This exact guard refuses every other DB.
const url = requireBetaDatabaseUrl(process.env.DATABASE_URL);
const pool = new pg.Pool({ ...connectionOptions(url), options: '-c statement_timeout=15000 -c lock_timeout=10000' });
const database = drizzle(pool, { schema });
const owner = randomUUID();
const other = randomUUID();
const suffix = owner.replaceAll('-', '');
const injection = `beta_bill_${suffix}`;
const eventIds = ['first', 'second', 'third'].map(name => `evt_beta_${suffix}_${name}`);
const product = productById('pack-25')!;
const record = {
  userId: owner, productId: product.id, cents: product.cents,
  credits: product.credits, tier: product.tier, stripeSessionId: `cs_beta_${suffix}`,
};
const fulfilment = fulfilmentFor(product);
const ownerState = async () => (await pool.query(
  'SELECT credits_purchased, stripe_customer_id, stripe_subscription_id FROM users WHERE id=$1', [owner],
)).rows[0];
const purchases = async () => (await pool.query('SELECT * FROM credit_purchases WHERE user_id=$1', [owner])).rows;
const injected = (error: unknown): boolean => {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (cause.message.includes('beta injected billing failure')) return true;
  }
  return false;
};
let count = 0;
const pass = (message: string) => { count++; console.log(`PASS ${message}`); };

try {
  await database.insert(schema.users).values([owner, other].map(id => ({
    id, email: `${id}@test.invalid`, handle: `beta-${id}`, displayName: 'Disposable billing fixture',
    stripeSubscriptionId: `sub_beta_${id}`,
  })));
  const original = await ownerState();
  await pool.query(`CREATE FUNCTION ${injection}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.user_id = '${owner}' THEN RAISE EXCEPTION 'beta injected billing failure'; END IF;
    RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${injection} BEFORE UPDATE OF fulfilled_at ON credit_purchases FOR EACH ROW EXECUTE FUNCTION ${injection}()`);

  await assert.rejects(() => applyPurchase(database, record, fulfilment), injected);
  assert.deepEqual(await ownerState(), original);
  assert.equal((await purchases()).length, 0);
  pass('standalone purchase, credit grant and marker all roll back after an injected post-grant failure');

  const deliver = (eventId: string) => database.transaction(async tx => {
    if (!(await claimStripeEvent(tx, eventId, 'checkout.session.async_payment_succeeded'))) return;
    await linkStripeCustomer(tx, owner, `cus_beta_${suffix}`);
    await applyPurchase(tx, record, fulfilment);
  });
  await assert.rejects(() => deliver(eventIds[0]), injected);
  assert.deepEqual(await ownerState(), original);
  assert.equal((await purchases()).length, 0);
  assert.equal((await pool.query('SELECT id FROM stripe_events WHERE id=$1', [eventIds[0]])).rowCount, 0);
  pass('event receipt and customer link roll back with failed fulfillment');

  await pool.query(`DROP TRIGGER ${injection} ON credit_purchases`);
  await deliver(eventIds[0]);
  await deliver(eventIds[0]);
  await Promise.all([deliver(eventIds[1]), deliver(eventIds[2])]);
  assert.equal((await ownerState()).credits_purchased, 25);
  assert.equal((await ownerState()).stripe_subscription_id, original.stripe_subscription_id);
  assert.equal((await purchases()).length, 1);
  assert.ok((await purchases())[0].fulfilled_at);
  pass('retried and distinct concurrent event IDs grant a Session once and preserve the existing subscription');

  // Force two real connections to encounter the same pending purchase before
  // either can finish its grant. A third connection holds only this user's row.
  const pending = { ...record, stripeSessionId: `cs_beta_pending_${suffix}` };
  await database.insert(schema.creditPurchases).values(pending);
  const holder = await pool.connect();
  const left = await pool.connect();
  const right = await pool.connect();
  const appNames = [`beta_left_${suffix}`, `beta_right_${suffix}`];
  let outcomes: Promise<PromiseSettledResult<unknown>[]> | undefined;
  let released = false;
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [owner]);
    await left.query("SELECT set_config('application_name', $1, false)", [appNames[0]]);
    await right.query("SELECT set_config('application_name', $1, false)", [appNames[1]]);
    outcomes = Promise.allSettled([
      applyPurchase(drizzle(left, { schema }), pending, fulfilment),
      applyPurchase(drizzle(right, { schema }), pending, fulfilment),
    ]);
    const deadline = Date.now() + 7000;
    let blocked = 0;
    while (Date.now() < deadline) {
      blocked = (await pool.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=ANY($1::text[]) AND wait_event_type='Lock'", [appNames],
      )).rows[0].n;
      if (blocked === 2) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(blocked, 2, 'Both separate delivery connections must reach the lock barrier');
    await holder.query('COMMIT');
    released = true;
    for (const result of await outcomes) {
      if (result.status === 'rejected') throw result.reason;
    }
    assert.equal((await ownerState()).credits_purchased, 50);
    const rows = await purchases();
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => row.fulfilled_at !== null).length, 2);
    pass('two real PostgreSQL connections serialize a pending Session and grant it exactly once');
  } finally {
    if (!released) await holder.query('ROLLBACK');
    if (outcomes) await outcomes;
    await left.query("RESET application_name");
    await right.query("RESET application_name");
    left.release(); right.release(); holder.release();
  }

  // Subscription snapshots must be retrieved only after this lock returns. A
  // second event sees the first event's committed subscription identity.
  const writer = await pool.connect();
  const reader = await pool.connect();
  const readerName = `beta_billing_reader_${suffix}`;
  let pendingRead: Promise<Awaited<ReturnType<typeof lockBillingUser>>> | undefined;
  let committed = false;
  try {
    await writer.query('BEGIN');
    await lockBillingUser(drizzle(writer, { schema }), owner);
    await writer.query('UPDATE users SET stripe_subscription_id=$1 WHERE id=$2', ['sub_replacement', owner]);
    await reader.query("SELECT set_config('application_name',$1,false)", [readerName]);
    pendingRead = drizzle(reader, { schema }).transaction(tx => lockBillingUser(tx, owner));
    const deadline = Date.now() + 7000;
    let blocked = false;
    while (Date.now() < deadline) {
      const activity = await pool.query("SELECT wait_event_type FROM pg_stat_activity WHERE application_name=$1", [readerName]);
      blocked = activity.rows[0]?.wait_event_type === 'Lock';
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(blocked, true, 'A different connection must wait for the billing owner lock');
    await writer.query('COMMIT'); committed = true;
    assert.equal((await pendingRead)?.stripeSubscriptionId, 'sub_replacement');
    pass('billing account lock serializes subscription identity before a second event reads Stripe');
  } finally {
    if (!committed) await writer.query('ROLLBACK');
    if (pendingRead) await pendingRead;
    await reader.query('RESET application_name');
    reader.release(); writer.release();
  }

  const untouched = (await pool.query('SELECT credits_purchased, stripe_customer_id FROM users WHERE id=$1', [other])).rows[0];
  assert.deepEqual(untouched, { credits_purchased: 0, stripe_customer_id: null });
  assert.equal((await pool.query('SELECT id FROM credit_purchases WHERE user_id=$1', [other])).rowCount, 0);
  pass('all grants and customer changes remain scoped to the fixture owner');
  console.log(`PASS ${count} local PostgreSQL billing scenarios; no Stripe network requests`);
} finally {
  try {
    await pool.query(`DROP TRIGGER IF EXISTS ${injection} ON credit_purchases`);
    await pool.query(`DROP FUNCTION IF EXISTS ${injection}()`);
    await database.delete(schema.stripeEvents).where(inArray(schema.stripeEvents.id, eventIds));
    await database.delete(schema.users).where(eq(schema.users.id, owner));
    await database.delete(schema.users).where(eq(schema.users.id, other));
  } finally { await pool.end(); }
}
