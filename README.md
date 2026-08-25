# NomNom

Goodreads for recipes — with an importer that turns a YouTube video, a TikTok, a
Reel, or a 2,000-word blog post into a recipe card you can actually cook from.

Built so far: the **import pipeline**, **accounts**, **shelves & ratings**, and
**pantry search**, across web, mobile, and the database. Friends and grocery
carts are modelled in the schema and listed at the bottom.

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
`modules/`, and a shared primitives layer in `ui/`. Anything platform-agnostic —
request shapes, shelf rules, quantity scaling, the optimistic-update logic —
lives in `@nomnom/core/format` so the two clients can't drift apart.

`@nomnom/core` has two entry points:

- `@nomnom/core` — the full pipeline. Server only; pulls in `node:dns`,
  `child_process`, and the Anthropic SDK.
- `@nomnom/core/format` — pure model, formatting, shelf rules, and the HTTP
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

## How an import actually runs

The pipeline tries the cheapest path that can work, and tells you which one it
took (visible under "How this import ran" on every card).

| Source | What we read | Cost |
|---|---|---|
| Blog with schema.org data | The site's own machine-readable recipe | **No model call** |
| Blog without it | Page prose → Claude | One call |
| YouTube | Caption track (+ description) → Claude | One call |
| TikTok / Instagram / Facebook | Post caption → Claude | One call |
| Video with no captions | yt-dlp → ASR → Claude | One call + ASR |

Most food blogs publish structured recipe data, and those imports are instant
and free. Everything else goes through `claude-opus-5` with adaptive thinking, a
cached system prompt, and a Zod-validated structured output.

**Video timestamps.** Steps extracted from a transcript carry the second they
happen at, and the card links straight into the video at that moment. Where the
model doesn't tag a step, the pipeline matches step wording back to transcript
cues, only ever moving forward through the video.

**Honesty over completeness.** Every card carries a confidence score and a list
of what had to be inferred ("Oil amount was never stated; estimated 2 tbsp").
The extractor is told to leave a gap and note it rather than invent a
plausible-looking step. Low-confidence cards are visually flagged.

---

## Accounts

Authentication is Clerk, on both platforms.

- **Web** — `@clerk/nextjs`. `middleware.ts` only *attaches* the session;
  it does not authorize. Clerk deprecated `createRouteMatcher` for a good
  reason — matching paths in middleware can drift from how Next actually routes
  a request — so every page and route checks for itself at the point it reads
  data. That check lives in `apps/web/lib/session.ts`.
- **Mobile** — `@clerk/expo` with the session token in `expo-secure-store`.
  Sign-in runs through Clerk's hosted Account Portal in a browser session, so
  the app never handles a password or a verification code and automatically
  supports whatever methods the Clerk instance has enabled.

Clerk ids are mapped onto a local `users` row on first sight, which is also
where each account's three default shelves are created. The webhook at
`/api/webhooks/clerk` covers the changes that happen without a request from the
user — a profile edited in Clerk's UI, or an account deleted (which cascades to
their recipes, shelves, and ratings).

**Running without Clerk keys** is supported and is how the app behaves straight
after `pnpm install`: every request resolves to one local account. It is refused
when `NODE_ENV=production`.

Set the keys up with:

```bash
cd apps/web && clerk env pull
```

---

## Shelves and ratings

Three built-in shelves — **Want to cook**, **Cooking**, **Cooked** — plus as
many custom shelves as you like.

The two kinds behave differently on purpose:

- **Status shelves are exclusive.** A recipe is at exactly one point in its
  lifecycle, enforced by a partial unique index on `(user_id, type)`. Pressing
  the shelf a recipe is already on takes it off.
- **Custom shelves stack.** A recipe can sit on any number of them, alongside
  its status.

Anything you import lands on *Want to cook* automatically — but re-importing a
link to refresh the card never knocks it back from *Cooked*.

Moving a recipe onto *Cooked* is the one shelf action with a side effect: it
bumps a times-cooked counter, which is a better signal of what someone actually
makes than stars are. Rating never touches that counter, and marking something
cooked twice in a row doesn't double-count it.

Every control applies optimistically and rolls back on failure. The rules behind
that live in `packages/core/src/shelves.ts` as pure functions, so both clients
apply identical logic.

---

## Pantry search

*What can I make from what I have.* Type a list of ingredients, or describe what
you're after, and get your own collection ranked into **Cook tonight**, **Nearly
there**, and everything else.

Two paths, and the cheap one is the default:

- **A list of ingredients** ("chicken thighs, rice, an onion") is parsed with
  the same code the importer uses, so a pantry entry and a recipe line land on
  the same key by construction. No model call.
- **A request with conditions in it** ("something quick and vegetarian",
  "dinner without dairy") goes to Claude to extract ingredients, exclusions,
  tags, a time limit, and a course. If no key is configured — or the call fails
  — it silently falls back to the list parser and says so. Search never errors
  because smart search was unavailable.

Matching itself is one SQL query against the flattened `recipe_ingredients`
index, so it stays a single round-trip however large the collection gets. The
same rules exist as pure functions in `packages/core/src/pantry.ts`, and
`pnpm check:pantry` asserts the SQL and the functions agree on every fixture.

**Staples are assumed, perishables never are.** Salt, oil, flour, and the rest
of the shelf-stable list count as present without being added. Eggs, milk,
butter, onions, and garlic do not — people genuinely run out of those, and
"you can make this" when you can't is the failure that stops the feature being
trusted. Being told you're missing salt is the cheaper mistake.

The staple list is code, so it's passed into the query as a parameter rather
than read from `recipe_ingredients.is_staple`. Editing it takes effect
immediately instead of needing every recipe reindexed.

Canonical names come from a parser that keeps improving. When it does, older
recipes keep their old keys until they're re-derived:

```bash
curl -X POST localhost:3000/api/pantry/reindex
```

---

## Optional pieces

**Persistence** — set `DATABASE_URL` in `apps/web/.env.local` (the db package
reads it from there, so it only has to be set once), then:

```bash
pnpm db:migrate
```

That enables pgvector and applies everything in `packages/db/migrations`. It is
idempotent, and it is the command to use against anything holding real data.

After changing `schema.ts`, write a migration for the change:

```bash
pnpm db:generate
```

`pnpm db:push` also exists — it diffs the schema straight into the database with
no migration file. Handy while iterating locally, but note that drizzle-kit
can't round-trip array defaults, so `push` reports the same six no-op
`ALTER ... SET DEFAULT '{}'` statements every time. `db:migrate` doesn't.

**Video transcription** — only used when a video has no captions *and* no usable
caption text. Needs `yt-dlp` and `ffmpeg` on PATH plus `DEEPGRAM_API_KEY` or
`GROQ_API_KEY`. Without them the pipeline says so in the trace and falls back to
caption extraction rather than failing.

**Mobile** — `pnpm dev:mobile`. It talks to the web app's API, so run both, and
copy the web app's publishable key into `apps/mobile/.env`. On a simulator
`localhost` resolves to your machine; on a physical device the app falls back to
the LAN address Expo is already serving from. Copy a link in any app and NomNom
offers to import it when you switch back.

---

## Tests

```bash
pnpm test
```

Unit tests cover the parts with real logic: quantity and ingredient parsing,
schema.org extraction, the SSRF guard, shelf rules, and the optimistic-update
helpers. The extractor is tested against a local stand-in for the Messages API
using the real SDK, so request shape and schema round-trip are covered without a
key or a bill.

There is also an end-to-end check of the shelf lifecycle against a running
server and a real database — exclusivity, the cook counter, re-import
idempotency, and the guards on built-in shelves:

```bash
pnpm check:shelves http://localhost:3000
```

```bash
pnpm check:pantry
```

Both work on their own fixtures and are safe to re-run. `check:shelves` imports
a real recipe and leaves it in the library, so point it at a development
database.

---

## Notes on the parts that are genuinely constrained

**Grocery carts.** Instacart has a public Developer Platform API that creates a
populated cart page, and Kroger (which owns Fred Meyer) has a public Cart API.
DoorDash, Uber Eats, and Safeway/Albertsons have **no** public consumer cart
API. The `cart_handoffs` table is shaped so real integrations and deep-link
fallbacks record identically.

**Social scraping.** TikTok, Instagram, and Facebook actively discourage
server-side reading. Captions are fetched via oEmbed and page metadata, both of
which are rate-limited and change without notice. The caption path is the
reliable one because creators put the real ingredient list there; the
transcription path is the fallback.

**Bot blocking.** Some large recipe sites (allrecipes.com among them) return 403
to server-side fetches regardless of headers. Those need the paste-text path.

**SSRF.** The server fetches whatever URL you paste, so every request — and
every redirect hop — is checked against loopback, link-local, and private ranges
before it goes out. See `packages/core/src/sources/url-guard.ts`.

**Postgres version.** Neon runs Postgres 18, which names its `NOT NULL`
constraints. drizzle-kit below 0.31 doesn't understand that and tries to drop
them, aborting the migration part-way and leaving a schema with tables but no
indexes or foreign keys. The pinned versions handle it; don't downgrade them.

**Clerk versions are pinned exactly**, not caret-ranged, to stay outside the
repo's `minimumReleaseAge` supply-chain policy window. Bumping them needs a
version at least a day old.

---

## Not built yet

Modelled in `packages/db/src/schema.ts`, in rough dependency order:

1. **Shopping lists and carts** — the natural next step: every "Nearly there"
   result already names exactly what's missing, so turning that into a merged
   list and handing it to Instacart or Kroger is mostly plumbing.
2. **Friends and sharing** — `friendships` and per-recipe/per-shelf
   `visibility` exist; nothing reads them yet.
3. **Discovery** — a public feed over `visibility = 'public'`, plus the
   `recipes.embedding` column for "more like this". Pantry search currently
   falls back to *closest match* rather than semantic similarity, which is
   arguably the better answer for "what's for dinner" anyway.
