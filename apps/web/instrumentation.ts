// Server-side Sentry bootstrap. Next.js calls register() once per runtime
// (Node for route handlers and server components, edge for middleware) before
// any application code runs. Inert when SENTRY_DSN is unset, which is the
// normal state in local development.
import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "./lib/sentry-shared";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    ...sharedSentryOptions,
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    // The reviewed commit is baked into the image as an OCI label and passed
    // to the runtime as SB_RELEASE_COMMIT, so an error can be traced to the
    // exact source that produced it rather than to a moving version number.
    release: `savortome-web@${process.env.SB_RELEASE_COMMIT ?? "unknown"}`,
  });
}

// Errors thrown in server components, route handlers and server actions reach
// Sentry through this hook, so every /api route is covered without wrapping
// each handler.
export const onRequestError = Sentry.captureRequestError;
