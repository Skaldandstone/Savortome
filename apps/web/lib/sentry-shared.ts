import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Shared Sentry options for the browser, Node and edge runtimes.
 *
 * Savortome knows things about people that an error tracker has no business
 * storing. Allergens and dietary restrictions are health data. The care
 * feature exists for people who are ill, and the mere fact that someone opened
 * it is sensitive — which is why `/care` already sends `no-referrer` and
 * `noindex`. Recipe titles and shopping lists are mundane individually and
 * revealing in aggregate.
 *
 * So the default SDK behaviour is narrowed before anything leaves the process:
 * no request bodies, headers or cookies, no user identity, no breadcrumbs, no
 * session replay, no performance tracing. What ships is the exception, the
 * stack, and the route. Enough to fix a bug, nothing that says whose kitchen
 * it happened in.
 *
 * The DSN is public by design — it can only *send* events to one project — so
 * it travels as a plain environment variable, rendered into a meta tag at
 * request time for the browser. Every page in this app is dynamically
 * rendered, so that tag reaches all of them; there is no prerendered HTML to
 * freeze a stale value into.
 */

export const SENTRY_DSN_META_NAME = "savortome-sentry-dsn";
export const SENTRY_ENVIRONMENT_META_NAME = "savortome-sentry-environment";

/** Query keys that carry the care handoff. Never worth sending anywhere. */
const CARE_PARAMS = /^(source|intent|effort|time|temperature|texture|return_to)$/;

/**
 * Strip anything that could identify a person, or what they are going
 * through, from an outgoing event.
 *
 * The URL goes too. A recipe path carries an id, and `/care?...` carries the
 * handoff — which says someone is unwell, how much energy they have, and what
 * they can keep down. The method plus the route name on the transaction is
 * enough to find the failing handler.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  if (event.request) {
    const { method } = event.request;
    event.request = method ? { method } : {};
  }
  // Defence in depth: if a future integration puts the care parameters
  // somewhere else on the event, drop them rather than trusting the shape.
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (CARE_PARAMS.test(key)) delete event.extra[key];
    }
  }
  return event;
}

/** Options every runtime shares; each supplies its own dsn and environment. */
export const sharedSentryOptions = {
  sendDefaultPii: false,
  // Errors only. Tracing samples ordinary requests, and an ordinary request
  // here is someone reading a recipe.
  tracesSampleRate: 0,
  // Breadcrumbs record console lines, fetch URLs and navigation history —
  // three separate ways for a care link or a recipe title to ride along.
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubEvent,
  debug: false,
  ignoreErrors: [
    // A single-task ECS service briefly runs the old and new task during
    // every rolling deploy, so a tab holding the old client bundle can call a
    // server action the new task never registered. Next documents this as
    // expected with rolling deploys; global-error.tsx recovers with a reload.
    "Failed to find Server Action",
    // The offline shell deliberately fails fetches when the network is gone.
    // That is the feature working, not a fault worth paging anyone about.
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "Load failed",
  ] as string[],
} as const;
