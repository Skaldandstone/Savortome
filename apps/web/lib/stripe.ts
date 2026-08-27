import "server-only";
import Stripe from "stripe";

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

/** Checkout needs only the secret key; the webhook secret is checked separately. */
export const stripeConfigured = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY);

export const webhookConfigured = (): boolean => Boolean(process.env.STRIPE_WEBHOOK_SECRET);

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError(missingVars());
  // Built once. A new client per request leaks sockets under load.
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
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
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
