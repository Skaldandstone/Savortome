// Actual route/fulfillment/config code, real Stripe signature verification and
// disposable PGlite SQL. Only auth, Next response and Stripe HTTP are fixtures.
// Run: node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-stripe-lifecycle.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import * as billing from '../packages/db/src/queries/billing.ts';
import * as schema from '../packages/db/src/schema.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const dbRequire = createRequire(new URL('../packages/db/package.json', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { PGlite } = dbRequire('@electric-sql/pglite');
const { drizzle } = dbRequire('drizzle-orm/pglite');
const Stripe = webRequire('stripe');
const signatures = new Stripe(['sk', 'test', 'offline-fixture'].join('_')).webhooks;
const secret = randomBytes(32).toString('hex');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const compiled = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'iife', globalName: 'routes',
  stdin: { resolveDir: root, contents: `
    export {POST as webhook} from './apps/web/app/api/billing/webhook/route.ts';
    export {POST as checkout} from './apps/web/app/api/billing/checkout/route.ts';
    export {POST as portal} from './apps/web/app/api/billing/portal/route.ts';
    export {appOrigin,priceForProduct,trustedBillingOrigin} from './apps/web/lib/stripe.ts';
  ` },
  plugins: [{ name: 'external-boundaries', setup(api) {
    const stubs = {
      'server-only': '',
      'stripe': 'export default class Stripe { constructor() { return state.client; } }',
      'next/server': 'export const NextResponse = {json: (data, init) => Response.json(data, init)};',
      '@seconds/db': `export const {applyPurchase,applySubscriptionTier,lockBillingUser,stripePurchaseFulfilled,claimStripeEvent,linkStripeCustomer} = billing; export const db = () => state.database;`,
      '@/lib/session': 'export const databaseConfigured = () => state.databaseReady;',
      '@/lib/api': `export class BadRequestError extends Error {};
        export const readJson = async request => {try{return await request.json();}catch{return {};}};
        export const withUser = async handler => {
          if(!state.userId) return Response.json({error:'sign in'},{status:401});
          try { return Response.json(await handler(state.userId,state.database)); }
          catch(error) {return Response.json({error: error instanceof BadRequestError ? error.message : 'unavailable'},{status:error instanceof BadRequestError ? 400 : 500});}
        };`,
    };
    api.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' };
      if (args.path === '@seconds/core') return { path: root + 'packages/core/src/billing.ts' };
      if (args.path.startsWith('@/')) return { path: root + 'apps/web/' + args.path.slice(2) + '.ts' };
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
const price = (id = 'price_plus', overrides = {}) => ({
  id, object: 'price', active: true, livemode: false, currency: 'usd', unit_amount: id === 'price_pro' ? 4999 : id === 'price_pack25' ? 299 : 2999,
  type: id === 'price_pack25' ? 'one_time' : 'recurring',
  recurring: id === 'price_pack25' ? null : { interval: 'year', interval_count: 1, usage_type: 'licensed' },
  product: { id: 'prod_secondbreakfast', livemode: false, metadata: { app: 'secondbreakfast' } }, ...overrides,
});
const customer = (overrides = {}) => ({ id: 'cus_owner', livemode: false, metadata: { app: 'secondbreakfast', userId: owner }, ...overrides });
const subscription = (overrides = {}) => ({
  id: 'sub_current', customer: 'cus_owner', status: 'active', livemode: false,
  metadata: { app: 'secondbreakfast', userId: owner, productId: 'plan-plus' },
  items: { has_more: false, data: [{ quantity: 1, price: price() }] }, ...overrides,
});
const checkout = (overrides = {}) => ({
  id: 'cs_paid', status: 'complete', mode: 'subscription', payment_status: 'paid', livemode: false,
  customer: 'cus_owner', subscription: 'sub_current', currency: 'usd', amount_total: 2999,
  metadata: { app: 'secondbreakfast', userId: owner, productId: 'plan-plus' },
  line_items: { has_more: false, data: [{ quantity: 1, price: price() }] }, ...overrides,
});

test('Stripe routes enforce current product/customer ownership with atomic SQL', async t => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE users (id uuid PRIMARY KEY, email text, tier text NOT NULL DEFAULT 'free', credits_purchased int NOT NULL DEFAULT 0, stripe_customer_id text UNIQUE, stripe_subscription_id text);
      CREATE TABLE stripe_events (id text PRIMARY KEY, type text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE credit_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), product_id text NOT NULL, cents int NOT NULL, credits int NOT NULL DEFAULT 0, tier text, stripe_session_id text UNIQUE, refunded_at timestamptz, refunded_cents int, fulfilled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE credit_spends (user_id uuid, month text, source text);
    `);
    const database = drizzle(pg, { schema });
    async function fixture() {
      await pg.exec(`TRUNCATE credit_purchases, stripe_events, users; INSERT INTO users(id,stripe_customer_id,stripe_subscription_id,tier) VALUES ('${owner}','cus_owner','sub_current','plus'),('${other}','cus_other',null,'free');`);
      const state = { database, databaseReady: true, userId: owner, customer: customer(), price: price(), subscription: subscription(), checkout: checkout(), subscriptions: [], open: [], calls: [], errors: [], failRetrieve: false };
      state.client = {
        webhooks: signatures,
        customers: {
          retrieve: async id => { state.calls.push(['customer', id]); return state.customer; },
          create: async (params, options) => { state.calls.push(['createCustomer', params, options]); return state.customer; },
        },
        prices: { retrieve: async () => state.price },
        subscriptions: {
          retrieve: async id => { state.calls.push(['subscription', id]); if (state.failRetrieve) throw Error('upstream secret body must not leak'); return state.subscription; },
          list: async () => ({ data: state.subscriptions, has_more: false }),
        },
        checkout: { sessions: {
          retrieve: async () => state.checkout,
          list: async () => ({ data: state.open, has_more: false }),
          create: async params => { state.calls.push(['createCheckout', params]); return { url: 'https://checkout.stripe.test/fixture' }; },
        } },
        billingPortal: { sessions: { create: async params => { state.calls.push(['portal', params]); return { url: 'https://billing.stripe.test/fixture' }; } } },
      };
      const env = { NODE_ENV: 'production', STRIPE_SECRET_KEY: ['rk', 'test', 'fixture'].join('_'), STRIPE_WEBHOOK_SECRET: secret,
        STRIPE_LIVEMODE: 'false', STRIPE_CHECKOUT_ENABLED: 'true', STRIPE_PRICE_PLUS_ANNUAL: 'price_plus', STRIPE_PRICE_PRO_ANNUAL: 'price_pro', STRIPE_PRICE_PACK_25: 'price_pack25', STRIPE_PRICE_PACK_100: 'price_pack100', STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_fixture', NEXT_PUBLIC_APP_URL: 'https://secondbreakfast.test' };
      const sandbox = { state, billing, process: { env }, Response, Request, URL, console: { error: (...args) => state.errors.push(args) }, require: webRequire };
      runInNewContext(compiled.outputFiles[0].text, sandbox);
      const routes = sandbox.routes;
      const event = (type = 'customer.subscription.updated', object = subscription(), id = 'evt_fixture') => ({ id, object: 'event', type, livemode: false, data: { object } });
      const request = (value, signature) => new Request('https://secondbreakfast.test/api/billing/webhook', { method: 'POST', body: value, headers: signature ? { 'stripe-signature': signature } : {} });
      const deliver = async value => { const body = JSON.stringify(value); return routes.webhook(request(body, signatures.generateTestHeaderString({ payload: body, secret }))); };
      const billingRequest = (path, init = {}) => {
        const { headers = {}, ...rest } = init;
        return new Request(`https://secondbreakfast.test/api/billing/${path}`, {
          method: 'POST', ...rest, headers: { origin: 'https://secondbreakfast.test', ...headers },
        });
      };
      const buy = (body, headers) => routes.checkout(billingRequest('checkout', { body: JSON.stringify(body), headers }));
      const portal = headers => routes.portal(billingRequest('portal', { headers }));
      const row = async () => (await pg.query('SELECT tier,stripe_subscription_id,credits_purchased FROM users WHERE id=$1', [owner])).rows[0];
      const claims = async () => (await pg.query('SELECT * FROM stripe_events')).rows.length;
      return { state, env, routes, event, request, deliver, buy, portal, row, claims };
    }
    await t.test('missing or altered signatures do not claim events', async () => {
      const f = await fixture(); const body = JSON.stringify(f.event());
      assert.equal((await f.routes.webhook(f.request(body))).status, 400);
      const signature = signatures.generateTestHeaderString({ payload: body, secret });
      assert.equal((await f.routes.webhook(f.request(body + ' ', signature))).status, 400);
      assert.equal(await f.claims(), 0);
    });
    await t.test('signed wrong environment and unsupported events cannot grant', async () => {
      const f = await fixture(); assert.equal((await f.deliver({ ...f.event(), livemode: true })).status, 400);
      assert.equal((await f.deliver(f.event('payment_intent.succeeded'))).status, 200); assert.equal(await f.claims(), 0);
    });
    await t.test('another product in the shared account never unlocks this app', async () => {
      const f = await fixture(); const foreign = subscription({ metadata: { app: 'wispling', userId: owner } });
      assert.equal((await f.deliver(f.event(undefined, foreign))).status, 200); assert.equal(f.state.calls.length, 0);
    });
    await t.test('old subscription cancellation cannot downgrade its replacement', async () => {
      const f = await fixture(); const old = subscription({ id: 'sub_old', status: 'canceled' });
      assert.equal((await f.deliver(f.event('customer.subscription.deleted', old))).status, 200);
      assert.equal((await f.row()).tier, 'plus'); assert.equal(f.state.calls.length, 0);
    });
    await t.test('current Price sets tier even when metadata names the old tier', async () => {
      const f = await fixture(); f.state.subscription.items.data[0].price = price('price_pro');
      assert.equal((await f.deliver(f.event())).status, 200); assert.equal((await f.row()).tier, 'pro');
    });
    await t.test('late active snapshot reads current cancellation; duplicate delivery is inert', async () => {
      const f = await fixture(); f.state.subscription.status = 'canceled';
      assert.equal((await f.deliver(f.event())).status, 200); assert.equal((await f.row()).tier, 'free');
      const calls = f.state.calls.length; const duplicate = await f.deliver(f.event());
      assert.equal((await duplicate.json()).duplicate, true); assert.equal(f.state.calls.length, calls);
    });
    await t.test('unpaid identity remains pinned and payment recovery restores its plan', async () => {
      const f = await fixture(); f.state.subscription.status = 'unpaid'; await f.deliver(f.event());
      assert.equal((await f.row()).stripe_subscription_id, 'sub_current'); assert.equal((await f.row()).tier, 'free');
      f.state.subscription.status = 'active'; await f.deliver(f.event(undefined, subscription(), 'evt_recovered'));
      assert.equal((await f.row()).tier, 'plus');
    });
    await t.test('unknown and cross-product Prices fail closed without guessed Plus', async () => {
      const f = await fixture(); f.state.subscription.items.data[0].price = price('price_unknown');
      await f.deliver(f.event()); assert.equal((await f.row()).tier, 'free');
      f.state.subscription.items.data[0].price = price('price_plus', { product: { metadata: { app: 'other' } } });
      await f.deliver(f.event(undefined, subscription(), 'evt_foreign')); assert.equal((await f.row()).tier, 'free');
    });
    await t.test('customer metadata cannot move an entitlement to a different account', async () => {
      const f = await fixture(); f.state.customer.metadata.userId = other;
      assert.equal((await f.deliver(f.event())).status, 500); assert.equal(await f.claims(), 0);
      assert.equal((await pg.query('SELECT tier FROM users WHERE id=$1', [other])).rows[0].tier, 'free');
    });
    await t.test('subscription/customer mismatch rolls back and does not dump upstream errors', async () => {
      const f = await fixture(); f.state.subscription.customer = 'cus_other';
      assert.equal((await f.deliver(f.event())).status, 500); assert.equal(await f.claims(), 0);
      f.state.failRetrieve = true; await f.deliver(f.event());
      assert.ok(!JSON.stringify(f.state.errors).includes('upstream secret'));
    });
    await t.test('paid pack grants once across event IDs and preserves the subscription', async () => {
      const f = await fixture(); f.state.checkout = checkout({ mode: 'payment', subscription: null, amount_total: 299,
        metadata: { app: 'secondbreakfast', userId: owner, productId: 'pack-25' }, line_items: { has_more: false, data: [{ quantity: 1, price: price('price_pack25') }] } });
      assert.equal((await f.deliver(f.event('checkout.session.completed', f.state.checkout))).status, 200);
      await f.deliver(f.event('checkout.session.async_payment_succeeded', f.state.checkout, 'evt_second'));
      assert.equal((await f.row()).credits_purchased, 25); assert.equal((await f.row()).stripe_subscription_id, 'sub_current');
    });
    await t.test('pending payment does not grant; later paid event does', async () => {
      const f = await fixture(); await pg.exec(`UPDATE users SET tier='free',stripe_subscription_id=null WHERE id='${owner}'`);
      f.state.checkout.payment_status = 'unpaid'; await f.deliver(f.event('checkout.session.completed', f.state.checkout));
      assert.equal((await f.row()).tier, 'free'); f.state.checkout.payment_status = 'paid';
      await f.deliver(f.event('checkout.session.async_payment_succeeded', f.state.checkout, 'evt_paid')); assert.equal((await f.row()).tier, 'plus');
    });
    await t.test('mismatched actual Checkout Price cannot grant from metadata', async () => {
      const f = await fixture(); f.state.checkout.line_items.data[0].price = price('price_pro');
      assert.equal((await f.deliver(f.event('checkout.session.completed', f.state.checkout))).status, 500); assert.equal(await f.claims(), 0);
    });
    await t.test('fulfilled old Checkout cannot relink a later subscription', async () => {
      const f = await fixture(); await f.deliver(f.event('checkout.session.completed', f.state.checkout));
      await pg.exec(`UPDATE users SET stripe_subscription_id='sub_new',tier='pro' WHERE id='${owner}'`);
      await f.deliver(f.event('checkout.session.async_payment_succeeded', f.state.checkout, 'evt_late'));
      assert.equal((await f.row()).stripe_subscription_id, 'sub_new'); assert.equal((await f.row()).tier, 'pro');
    });
    await t.test('post-grant SQL failure rolls back receipt and purchase; retry succeeds', async () => {
      const f = await fixture(); await pg.exec(`CREATE FUNCTION fail_billing() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql; CREATE TRIGGER fail_billing BEFORE UPDATE OF tier ON users FOR EACH ROW EXECUTE FUNCTION fail_billing();`);
      try { assert.equal((await f.deliver(f.event('checkout.session.completed', f.state.checkout))).status, 500); }
      finally { await pg.exec('DROP TRIGGER fail_billing ON users; DROP FUNCTION fail_billing();'); }
      assert.equal(await f.claims(), 0); assert.equal((await pg.query('SELECT * FROM credit_purchases')).rows.length, 0);
      assert.equal((await f.deliver(f.event('checkout.session.completed', f.state.checkout))).status, 200);
    });
    await t.test('pending Session recovery cannot change the ledger owner or product', async () => {
      const f=await fixture();
      await pg.query("INSERT INTO credit_purchases(user_id,product_id,cents,credits,tier,stripe_session_id) VALUES ($1,'plan-plus',2999,0,'plus','cs_paid')",[other]);
      assert.equal((await f.deliver(f.event('checkout.session.completed',f.state.checkout))).status,500);
      assert.equal(await f.claims(),0);
      assert.equal((await pg.query("SELECT user_id,fulfilled_at FROM credit_purchases WHERE stripe_session_id='cs_paid'")).rows[0].user_id,other);
      assert.equal((await pg.query("SELECT fulfilled_at FROM credit_purchases WHERE stripe_session_id='cs_paid'")).rows[0].fulfilled_at,null);
      await pg.query("UPDATE credit_purchases SET user_id=$1,product_id='plan-pro',cents=4999,tier='pro' WHERE stripe_session_id='cs_paid'",[owner]);
      assert.equal((await f.deliver(f.event('checkout.session.completed',f.state.checkout))).status,500);assert.equal(await f.claims(),0);
    });
    await t.test('checkout is disabled by default and requires an authenticated owner', async () => {
      const f = await fixture(); delete f.env.STRIPE_CHECKOUT_ENABLED; assert.equal((await f.buy({ productId: 'plan-plus' })).status, 403);
      f.env.STRIPE_CHECKOUT_ENABLED = 'true'; f.state.userId = null; assert.equal((await f.buy({ productId: 'plan-plus' })).status, 401);
      assert.equal(f.state.calls.length, 0);
    });
    await t.test('null, unknown and non-string product IDs return 400 without SDK writes', async () => {
      const f = await fixture(); for (const body of [null, [], { productId: {} }, { productId: 'plan-admin' }]) assert.equal((await f.buy(body)).status, 400);
      assert.equal(f.state.calls.length, 0);
    });
    await t.test('checkout ignores client price and uses validated server Price and metadata', async () => {
      const f = await fixture(); const result = await f.buy({ productId: 'plan-plus', price: 'price_attacker', userId: other, amount: 1 });
      assert.equal(result.status, 200); const params = f.state.calls.find(call => call[0] === 'createCheckout')[1];
      assert.equal(params.line_items[0].price, 'price_plus'); assert.equal(params.metadata.userId, owner);
      assert.equal(params.customer, 'cus_owner'); assert.equal(params.payment_method_types, undefined); assert.equal(params.automatic_tax, undefined);
      assert.equal(params.adaptive_pricing.enabled,false);
      assert.equal(params.success_url, 'https://secondbreakfast.test/?checkout=done');
    });
    await t.test('existing active subscription prevents another recurring Checkout', async () => {
      const f = await fixture(); f.state.subscriptions = [subscription()]; assert.equal((await f.buy({ productId: 'plan-plus' })).status, 400);
      assert.equal(f.state.calls.filter(call => call[0] === 'createCheckout').length, 0);
    });
    await t.test('an open matching plan Checkout is reused instead of duplicated', async () => {
      const f = await fixture(); f.state.open = [checkout({ status: 'open', url: 'https://checkout.stripe.test/existing' })];
      const result = await f.buy({ productId: 'plan-plus' }); assert.equal((await result.json()).url, f.state.open[0].url);
      assert.equal(f.state.calls.filter(call => call[0] === 'createCheckout').length, 0);
    });
    await t.test('wrong-product catalog or mispriced plan is rejected before purchase', async () => {
      const f = await fixture(); f.state.price.product.metadata.app = 'another-product'; assert.equal((await f.buy({ productId: 'plan-plus' })).status, 400);
      f.state.price = price('price_plus', { unit_amount: 1 }); assert.equal((await f.buy({ productId: 'plan-plus' })).status, 400);
    });
    await t.test('portal rejects deleted, foreign or wrong-environment customer links', async () => {
      const f = await fixture(); for (const value of [customer({ deleted: true }), customer({ livemode: true }), customer({ metadata: { app: 'other', userId: owner } })]) {
        f.state.customer = value; assert.equal((await f.portal()).status, 400);
      }
      assert.equal(f.state.calls.filter(call => call[0] === 'portal').length, 0);
    });
    await t.test('portal uses only authenticated customer and works when new Checkout is off', async () => {
      const f = await fixture(); f.env.STRIPE_CHECKOUT_ENABLED = 'false'; assert.equal((await f.portal()).status, 200);
      assert.equal(f.state.calls.find(call => call[0] === 'portal')[1].customer, 'cus_owner');
    });
    await t.test('origin, prototype names and ambiguous Price configuration fail closed', async () => {
      const f = await fixture(); assert.equal(f.routes.priceForProduct('constructor'), undefined);
      f.env.STRIPE_PRICE_PRO_ANNUAL = 'price_plus'; assert.equal(f.routes.priceForProduct('plan-plus'), undefined);
      for (const url of ['http://secondbreakfast.test', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test/?next=evil', 'javascript:alert(1)']) {
        f.env.NEXT_PUBLIC_APP_URL = url; assert.throws(() => f.routes.appOrigin());
      }
      delete f.env.NEXT_PUBLIC_APP_URL; assert.throws(() => f.routes.appOrigin());
    });
    for (const [label, mutate] of [
      ['multi-item subscriptions', value => value.items.data.push({ quantity: 1, price: price('price_pro') })],
      ['unsupported quantity', value => { value.items.data[0].quantity = 2; }],
      ['monthly price', value => { value.items.data[0].price.recurring.interval = 'month'; }],
      ['wrong currency', value => { value.items.data[0].price.currency = 'eur'; }],
      ['wrong environment price', value => { value.items.data[0].price.livemode = true; }],
    ]) await t.test(`${label} cannot infer a paid tier`, async () => {
      const f = await fixture(); mutate(f.state.subscription); assert.equal((await f.deliver(f.event())).status, 200);
      assert.equal((await f.row()).tier, 'free');
    });
    await t.test('past-due retains the existing documented grace policy', async () => {
      const f = await fixture(); f.state.subscription.status = 'past_due';
      await f.deliver(f.event()); assert.equal((await f.row()).tier, 'plus');
    });
    await t.test('unknown Customer owners block both Checkout and portal writes', async () => {
      const f = await fixture(); f.state.customer.metadata.userId = other;
      assert.equal((await f.buy({productId:'plan-plus'})).status, 400); assert.equal((await f.portal()).status, 400);
      assert.equal(f.state.calls.filter(call => ['createCheckout','portal'].includes(call[0])).length, 0);
    });
    await t.test('first customer creation uses stable private ownership and idempotency', async () => {
      const f = await fixture(); await pg.exec(`UPDATE users SET stripe_customer_id=null,stripe_subscription_id=null WHERE id='${owner}'`);
      assert.equal((await f.buy({productId:'plan-plus'})).status, 200);
      const created = f.state.calls.find(call => call[0] === 'createCustomer');
      assert.deepEqual(Object.keys(created[1]), ['metadata']); assert.equal(created[1].metadata.userId, owner);
      assert.match(created[2].idempotencyKey, /^secondbreakfast-customer-[0-9a-f]{64}$/);
      assert.equal((await pg.query('SELECT stripe_customer_id FROM users WHERE id=$1',[owner])).rows[0].stripe_customer_id,'cus_owner');
    });
    await t.test('production billing actions reject missing, malformed and cross-site origins before auth or Stripe', async () => {
      const f = await fixture();
      for (const headers of [
        { origin: '' },
        { origin: 'null' },
        { origin: 'https://attacker.test' },
        { origin: 'https://secondbreakfast.test.attacker.test' },
        { origin: 'https://secondbreakfast.test', 'sec-fetch-site': 'cross-site' },
      ]) {
        assert.equal((await f.buy({ productId: 'plan-plus' }, headers)).status, 403);
        assert.equal((await f.portal(headers)).status, 403);
      }
      assert.equal(f.state.calls.length, 0);
    });
    await t.test('local direct clients may omit Origin without weakening production', async () => {
      const f = await fixture();
      f.env.NODE_ENV = 'development';
      const request = new Request('http://127.0.0.1:3000/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ productId: 'plan-plus' }),
      });
      assert.equal(f.routes.trustedBillingOrigin(request), true);
      f.env.NODE_ENV = 'production';
      assert.equal(f.routes.trustedBillingOrigin(request), false);
    });
  } finally { await pg.close(); }
});
