import "server-only";
import Stripe from "stripe";
import { products } from "@seconds/core";

/**
 * Stripe, when it's configured.
 *
 * Payments are optional in exactly the way the database and Clerk are: the app
 * runs without them, says which variables are missing, and refuses the routes
 * that need them rather than crashing at import time. That's what makes it
 * possible to develop everything around a payment before an account exists.
 */

export class StripeNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Payments need Stripe. Set ${missing.join(" and ")} in .env.local. ` +
        `Until then, checkout is disabled and the app works on the free tier.`,
    );
    this.name = "StripeNotConfiguredError";
  }
}

const missingVars = (): string[] =>
  [
    process.env.STRIPE_SECRET_KEY ? null : "STRIPE_SECRET_KEY",
    process.env.STRIPE_WEBHOOK_SECRET ? null : "STRIPE_WEBHOOK_SECRET",
  ].filter((v): v is string => v !== null);

/** A key from the wrong environment is unavailable, even when it is present. */
export const stripeConfigured = (): boolean => {
  const mode = process.env.STRIPE_LIVEMODE === "true" ? "live" : "test";
  return new RegExp(`^(rk|sk)_${mode}_`).test(process.env.STRIPE_SECRET_KEY ?? "");
};

export const webhookConfigured = (): boolean => Boolean(process.env.STRIPE_WEBHOOK_SECRET);

/** Stable sandbox/live Prices are injected by the deployment, never by a buyer. */
export function priceForProduct(productId: string): string | undefined {
  const prices: Record<string, string | undefined> = {
    "plan-plus": process.env.STRIPE_PRICE_PLUS_ANNUAL,
    "plan-pro": process.env.STRIPE_PRICE_PRO_ANNUAL,
    "pack-25": process.env.STRIPE_PRICE_PACK_25,
    "pack-100": process.env.STRIPE_PRICE_PACK_100,
  };
  if (!Object.hasOwn(prices, productId)) return;
  const price = prices[productId];
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price)) return;
  if (products().filter(product => prices[product.id] === price).length !== 1) return;
  return price;
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError(missingVars());
  const mode = process.env.STRIPE_LIVEMODE === "true" ? "live" : "test";
  if (!stripeConfigured()) {
    throw new StripeNotConfiguredError([`a ${mode} Stripe key matching STRIPE_LIVEMODE`]);
  }
  // Built once. A new client per request leaks sockets under load.
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10_000, maxNetworkRetries: 1 });
  return client;
}

export function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError(["STRIPE_WEBHOOK_SECRET"]);
  return secret;
}

/**
 * Where Stripe sends people back to.
 *
 * Read from the environment rather than the request, because an attacker who
 * can set a Host header could otherwise redirect a completed checkout to a site
 * they control.
 */
export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new StripeNotConfiguredError(["NEXT_PUBLIC_APP_URL"]);
  const url = new URL(configured ?? "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:" && process.env.NODE_ENV !== "production"))
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new StripeNotConfiguredError(["a secure, absolute NEXT_PUBLIC_APP_URL origin"]);
  }
  return url.origin;
}

/**
 * Billing actions are initiated by this app's own browser UI. Clerk still
 * authenticates the person, while this check prevents another site from
 * submitting a cookie-backed Checkout or portal request on their behalf.
 *
 * Browsers send Origin on fetch POSTs. Local development keeps direct test
 * clients usable when they omit it; production fails closed.
 */
export function trustedBillingOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return new URL(origin).origin === appOrigin();
  } catch {
    return false;
  }
}
