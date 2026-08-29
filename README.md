# Second Breakfast

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

The app is **Second Breakfast** everywhere except an iPhone home screen, where
`ios.infoPlist.CFBundleDisplayName` shortens it to **2xBreakfast**. iOS elides
an icon label somewhere around twelve characters - it's really a width, not a
count - and "Second Breaâ€¦" is a worse thing to look at every day than a
contraction that fits whole. The bundle identifier, the App Store name and the
web app are all unchanged; only the icon caption is shorter. Android keeps the
full name, having room for it.

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
| [docs/PRODUCT.md](docs/PRODUCT.md) | Every feature, end to end: imports, accounts, shelves, search, pantry, planning, shopping lists and carts, sharing, friends, discovery, nutrition, pairing, editing, cook mode, print/export, AI credits, PWA, payments |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Persistence, video transcription, mobile development, and the test suites |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production constraints, build-time env vars, and the AWS deploy |
| [docs/ADMIN_DEPLOY.md](docs/ADMIN_DEPLOY.md) | Admin portal deploy runbook |
| [docs/CONSTRAINTS.md](docs/CONSTRAINTS.md) | Genuinely constrained parts (grocery APIs, social scraping, SSRF) and what is not built yet |
| [docs/DEMO.md](docs/DEMO.md) | Demo walkthrough, written 2026-08-27 |
| [STYLE_GUIDE.md](STYLE_GUIDE.md) | Visual system and brand |

