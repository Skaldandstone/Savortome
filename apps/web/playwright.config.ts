import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * These tests exist because Sentry is a last resort, not a safety net: it
 * tells us a page broke after somebody's evening was already ruined by it.
 * The suite that ran before this one was pure functions and a typecheck, so
 * nothing ever loaded a page as a signed-in person, and a 500 on /profile and
 * /plan reached production unnoticed.
 *
 * The server under test is the real production build, not `next dev`. The
 * bugs worth catching here — a server component throwing, a route that only
 * renders dynamically, a shell frozen at build time — are exactly the ones a
 * dev server papers over.
 */

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // A failing assertion here means a page is broken; retrying it locally just
  // hides flakiness. CI retries once because a cold start can lose a race.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Reuse a server the developer already has running; start one in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
