# Known constraints and what is not built yet

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

**SSRF.** The server fetches whatever URL you paste, so every request - and
every redirect hop - is checked against loopback, link-local, and private ranges
before it goes out. See `packages/core/src/sources/url-guard.ts`.

**`next build` used to clobber the dev server.** Both write to `.next` by
default, so building while `next dev` was running left it serving production
chunks it couldn't hydrate - a page that rendered and then did nothing, or
`Cannot find module './vendor-chunks/...'`. The production build now writes to
`.next-build` instead (`next.config.ts`), so the two can't collide. If you ever
see that symptom anyway, `rm -rf apps/web/.next` and restart.

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

1. **Running mobile on a device.** It bundles, typechecks, and a real Android
   prebuild against the current config succeeds cleanly, but it has never been
   opened on a phone or simulator - no device was available. Expect the first
   run to turn up layout and native-module issues that bundling can't catch.
2. **Kroger against the live API.** Built and exercised end to end against a
   local stand-in, but never run with real Kroger credentials - expect the
   first real run to turn up schema details a stand-in can't.
3. **Semantic search** - `recipes.embedding` is unused. Worth doing when the
   ingredient-overlap approach visibly runs out, not before.
4. **Web timers don't notify while the tab is closed.** The timer state
   itself survives fine (see "Cooking from a card" in `PRODUCT.md`) - only the proactive
   alert doesn't reach you if you've walked away and closed the tab. The
   phone hands its alarms to the OS and has no such limit. Fixing the web
   side means a service worker with its own scheduler.

