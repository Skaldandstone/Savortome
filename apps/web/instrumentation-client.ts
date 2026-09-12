// Browser-side Sentry bootstrap. Next.js loads this before any client code
// runs.
//
// The DSN is read from a meta tag the root layout renders at request time.
// Every page in this app is dynamically rendered, so the tag reaches all of
// them and the value can change with a redeploy rather than being frozen into
// a bundle at build time. NEXT_PUBLIC_SENTRY_DSN still wins when it is set,
// which is how a local development run can point somewhere else.
//
// Inert when neither source provides a DSN.
import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN_META_NAME,
  SENTRY_ENVIRONMENT_META_NAME,
  sharedSentryOptions,
} from "./lib/sentry-shared";

function readMeta(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const content = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
  return content ? content : undefined;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || readMeta(SENTRY_DSN_META_NAME);
if (dsn) {
  Sentry.init({
    ...sharedSentryOptions,
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      readMeta(SENTRY_ENVIRONMENT_META_NAME) ??
      "production",
    // No session replay. It records the screen, and the screen shows the
    // allergens, the care answers, and the shopping list.
    integrations: [],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
