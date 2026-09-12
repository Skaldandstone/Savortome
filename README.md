# Savortome™

**Food is magic. Cooking shouldn’t require it.**

Goodreads for recipes - with an importer that turns a YouTube video, a TikTok, a
Reel, or a 2,000-word blog post into a recipe card you can actually cook from.

Built so far: the **import pipeline**, **accounts**, **shelves & ratings**,
**pantry search**, **shopping lists & carts**, **sharing**, **friends**, and
**discovery** - the whole of the original brief. What's left is listed at the
bottom.

---

## Layout

```
packages/
  core/     the pipeline, the recipe model, shelf rules, the API client
  db/       Drizzle schema + Neon client + queries
apps/
  web/      Next.js app (App Router)
  mobile/   Expo app (expo-router)
```

Both apps use the same shape: thin route/entry files, feature folders under
`modules/`, and a shared primitives layer in `ui/`. Every feature exists on
both - library, import, shelves, pantry search, lists, sharing, friends, and
discovery. Anything platform-agnostic -
request shapes, shelf rules, quantity scaling, the optimistic-update logic -
lives in `@seconds/core/format` so the two clients can't drift apart.

The public product name is **Savortome™** across web and mobile. The existing
package namespace, Expo slug and scheme, mobile bundle identifier, Clerk access
key, infrastructure names, and beta hostname remain stable compatibility
identifiers during the rebrand. See [the migration record](docs/SAVORTOME-REBRAND.md).

`@seconds/core` has two entry points:

- `@seconds/core` - the full pipeline. Server only; pulls in `node:dns`,
  `child_process`, and the Anthropic SDK.
- `@seconds/core/format` - pure model, formatting, shelf rules, and the HTTP
  client. Safe in a browser or React Native bundle.

---

## Getting started

```bash
pnpm install
```

```bash
cp .env.example apps/web/.env.local
```

```bash
pnpm dev
```

Nothing in `.env.local` is required to see the app work: a blog that publishes
schema.org recipe data imports with no key and no database, and without Clerk
keys the app runs on a single local account.

Try the pipeline straight from the terminal:

```bash
pnpm ingest -- "https://cookieandkate.com/healthy-banana-bread-recipe/"
```

Run the tests:

```bash
pnpm test
```


---

## Documentation

| Doc | What it covers |
|---|---|
| [ASSET-LAYOUT.md](ASSET-LAYOUT.md) | Canonical design sources, runtime derivatives, beta evidence, and the isolated demo-video boundary |
| [Demo video](Demo%20video/README.md) | Selected presentation recording and sharing requirements; no approved recording is currently present |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Every feature, end to end: imports, accounts, shelves, search, pantry, planning, shopping lists and carts, sharing, friends, discovery, nutrition, pairing, editing, cook mode, print/export, AI credits, PWA, payments |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Persistence, video transcription, mobile development, and the test suites |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production constraints, build-time env vars, and the AWS deploy |
| [docs/ADMIN_DEPLOY.md](docs/ADMIN_DEPLOY.md) | Admin portal deploy runbook |
| [docs/CONSTRAINTS.md](docs/CONSTRAINTS.md) | Genuinely constrained parts (grocery APIs, social scraping, SSRF) and what is not built yet |
| [docs/DEMO.md](docs/DEMO.md) | Demo walkthrough, written 2026-08-27 |
| [docs/WISPLING-INTEGRATION.md](docs/WISPLING-INTEGRATION.md) | The low-effort food handoff from Wispling and its privacy and safety boundaries |
| [STYLE_GUIDE.md](STYLE_GUIDE.md) | Visual system and brand |

