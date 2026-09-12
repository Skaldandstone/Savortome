import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { fulfilmentFor, productById } from "@seconds/core";
import { applyPurchase, claimStripeEvent, stripeEventSeen } from "../src/queries/billing.js";
import * as schema from "../src/schema.js";

// Ephemeral PostgreSQL: never reads DATABASE_URL or touches a hosted database.
test("purchase, grant, and event receipt roll back together and retries grant once", async () => {
  const pg = new PGlite();
  try {
    // Minimal relational fixture for the tables touched by the billing queries.
    await pg.exec(`
      CREATE TABLE users (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'free', credits_purchased int NOT NULL DEFAULT 0);
      CREATE TABLE stripe_events (id text PRIMARY KEY, type text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE credit_purchases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
        product_id text NOT NULL, cents int NOT NULL, credits int NOT NULL DEFAULT 0,
        tier text, stripe_session_id text UNIQUE, refunded_at timestamptz, refunded_cents int,
        fulfilled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE credit_spends (user_id uuid, month text, source text);
      INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000000001');
      CREATE FUNCTION fail_fulfilment() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'simulated failure after grant'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_fulfilment BEFORE UPDATE OF fulfilled_at ON credit_purchases FOR EACH ROW EXECUTE FUNCTION fail_fulfilment();
    `);
    // PGlite and node-postgres use the same Drizzle PostgreSQL query surface.
    const database = drizzle(pg, { schema }) as unknown as Parameters<typeof applyPurchase>[0];
    const product = productById("pack-25")!;
    const record = {
      userId: "00000000-0000-0000-0000-000000000001", productId: product.id,
      cents: product.cents, credits: product.credits, tier: product.tier, stripeSessionId: "cs_test_purchase",
    };
    const deliver = (eventId: string) => database.transaction(async (tx) => {
      if (!(await claimStripeEvent(tx, eventId, "checkout.session.async_payment_succeeded"))) return;
      await applyPurchase(tx, record, fulfilmentFor(product));
    });
    await assert.rejects(deliver("evt_test"));
    assert.equal(await stripeEventSeen(database, "evt_test"), false);
    assert.deepEqual((await pg.query("SELECT credits_purchased FROM users")).rows, [{ credits_purchased: 0 }]);
    assert.equal((await pg.query("SELECT * FROM credit_purchases")).rows.length, 0);

    await pg.exec("DROP TRIGGER fail_fulfilment ON credit_purchases;");
    await deliver("evt_test");
    await deliver("evt_test");
    // A distinct completed/succeeded event for the same Session also dedupes.
    await Promise.all([deliver("evt_second"), deliver("evt_third")]);
    assert.deepEqual((await pg.query("SELECT credits_purchased FROM users")).rows, [{ credits_purchased: 25 }]);
    assert.equal((await pg.query("SELECT * FROM credit_purchases WHERE fulfilled_at IS NOT NULL")).rows.length, 1);
  } finally {
    await pg.close();
  }
});
