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

## How an import actually runs

The pipeline tries the cheapest path that can work, and tells you which one it
took (visible under "How this import ran" on every card).

| Source | What we read | Cost |
|---|---|---|
| Blog with schema.org data | The site's own machine-readable recipe | **No model call** |
| Blog without it | Page prose → Claude | One call |
| YouTube | Caption track (+ description) → Claude | One call |
| TikTok | Post caption → Claude | One call |
| Instagram / Facebook | Caption via yt-dlp → Claude | One call |
| Video whose captions we can't fetch directly | yt-dlp → caption track → Claude | One call |
| Video with no captions at all | yt-dlp → audio → ASR → Claude | One call + ASR |

Most food blogs publish structured recipe data, and those imports are instant
and free. Everything else goes through `claude-opus-5` with adaptive thinking, a
cached system prompt, and a Zod-validated structured output.

### YouTube captions need yt-dlp today

Measured 2026-08-26, and worth knowing before you judge a video import.

YouTube still lists caption tracks in the watch page, and the pipeline still
finds them - but `/api/timedtext` now answers a plain server-side request with
an **empty 200**. Not an error, not a 403: zero bytes. Every URL variant tried
(`fmt=json3`, `fmt=srv3`, bare, `&c=WEB`) behaves the same, and the InnerTube
`ANDROID` client route 400s. The endpoint is gated behind browser session
tokens now, which is exactly what `yt-dlp` exists to handle.

**yt-dlp can still fetch them**, which is why it's the first thing the pipeline
reaches for when the direct fetch comes back empty - ahead of transcribing
audio, because it's free, takes a second or two rather than minutes, and a
human-written caption track beats any ASR pass. (The automatic track on the
test video renders "Jacques Pépin" as "zck Pepa".)

```bash
winget install yt-dlp.yt-dlp Gyan.FFmpeg
```

winget installs both **without adding them to PATH**, so name them explicitly
in `.env.local` rather than fighting your environment:

```
YT_DLP_PATH=C:\...\WinGet\Packages\yt-dlp.yt-dlp_...\yt-dlp.exe
FFMPEG_PATH=C:\...\WinGet\Packages\Gyan.FFmpeg_...in
```

Only audio extraction needs ffmpeg; subtitles don't touch it.

**What it's worth**, measured on the same Jacques Pépin video:

| | Without yt-dlp | With it |
|---|---|---|
| Path | description → Claude | transcript → Claude |
| Confidence | 0.20 | **0.78** |
| Ingredients | 4 | **17**, with real quantities |
| Steps | 3 | **14**, each timestamped |

An ASR key (`GROQ_API_KEY`, free tier, or `DEEPGRAM_API_KEY`) is still worth
setting, but it is now the *third* resort - for videos that publish no captions
at all.

The trace says exactly which of these happened, because they need different
fixes: "the video publishes no captions", "captions exist but YouTube won't
serve them to a server directly", "yt-dlp: 41 caption cues".

**Instagram and Facebook need yt-dlp too**, for a different reason than
YouTube: they serve a login wall to anything that looks like a scraper, so the
Open Graph tags the social resolver reads come back empty. yt-dlp still gets
the caption - and for a Reel the caption usually *is* the recipe, which makes
these the highest-confidence imports in the app (0.93 on the one used to test
it). TikTok has a working oEmbed endpoint and never needs the fallback, so it
doesn't pay for one.

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

- **Web** - `@clerk/nextjs`. `middleware.ts` only *attaches* the session;
  it does not authorize. Clerk deprecated `createRouteMatcher` for a good
  reason - matching paths in middleware can drift from how Next actually routes
  a request - so every page and route checks for itself at the point it reads
  data. That check lives in `apps/web/lib/session.ts`.
- **Mobile** - `@clerk/expo` with the session token in `expo-secure-store`.
  Sign-in runs through Clerk's hosted Account Portal in a browser session, so
  the app never handles a password or a verification code and automatically
  supports whatever methods the Clerk instance has enabled.

Clerk ids are mapped onto a local `users` row on first sight, which is also
where each account's three default shelves are created. The webhook at
`/api/webhooks/clerk` covers the changes that happen without a request from the
user - a profile edited in Clerk's UI, or an account deleted (which cascades to
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

Three built-in shelves - **Want to cook**, **Cooking**, **Cooked** - plus as
many custom shelves as you like.

The two kinds behave differently on purpose:

- **Status shelves are exclusive.** A recipe is at exactly one point in its
  lifecycle, enforced by a partial unique index on `(user_id, type)`. Pressing
  the shelf a recipe is already on takes it off.
- **Custom shelves stack.** A recipe can sit on any number of them, alongside
  its status.

Anything you import lands on *Want to cook* automatically - but re-importing a
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
  tags, a time limit, and a course. If no key is configured - or the call fails
  - it silently falls back to the list parser and says so. Search never errors
  because smart search was unavailable.

Matching itself is one SQL query against the flattened `recipe_ingredients`
index, so it stays a single round-trip however large the collection gets. The
same rules exist as pure functions in `packages/core/src/pantry.ts`, and
`pnpm check:pantry` asserts the SQL and the functions agree on every fixture.

**Staples are assumed, perishables never are.** Salt, oil, flour, and the rest
of the shelf-stable list count as present without being added. Eggs, milk,
butter, onions, and garlic do not - people genuinely run out of those, and
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

## Shopping lists and carts

Add a recipe from its card, or just the missing ingredients straight from a
pantry result. Everything merges into one list.

**Merging is the whole job.** Three recipes wanting flour is one line. Amounts
combine only when their units genuinely relate - `1 cup` and `2 tbsp` add up,
`1 cup` and `200 g` don't, because that would mean guessing the ingredient's
density. Incompatible amounts stay as two lines rather than becoming one wrong
one. Ranges shop for the larger number, since running short is worse than
leftovers.

**The pantry comes off the top.** Anything you have with no amount recorded is
dropped entirely; anything with an amount is subtracted and only the shortfall
is bought. When the units can't be compared, the line stays but is marked *you
may already have some* - recomputed on read, so it can't go stale as the pantry
changes.

Names on the list come from the canonical form rather than the recipe's own
wording, because "melted coconut oil or extra-virgin olive oil or high quality
vegetable oil*" is not something you can look for in a shop.

### Which services actually work

This is the part worth being straight about:

| Service | What happens |
|---|---|
| **Instacart** | Real cart. Their Developer Platform API takes the list and returns a populated shopping-list page. |
| **Kroger / Fred Meyer** | Real cart. Sign in to Kroger once, pick a store, and matched items go into your own cart for pickup. |
| **DoorDash, Uber Eats, Safeway** | **No public consumer cart API exists.** These copy your list and open their store. |

The provider type says which kind each is (`api` vs `handoff`), the UI groups
them apart, and both record identically in `cart_handoffs` so the history reads
the same. An API provider only appears once its key is configured.

The Instacart integration is written against
[their documented schema](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page)
- using `line_item_measurements`, since `quantity`/`unit` on a line item are
deprecated - but has never been run against the live API, which needs a partner
key this project doesn't have.

### Kroger, and why it's shaped differently

Instacart takes names and matches them itself. Kroger takes **UPCs**, and a UPC
only means anything at a **specific store** - so the flow has more moving parts:

1. A `client_credentials` token searches the catalogue. No customer involved.
2. The shopper signs in to Kroger once (`authorization_code`, `cart.basic:write`).
3. They pick a store, because price, stock, and what's carried all differ.
4. Each line is searched, matched to a UPC, and `PUT /v1/cart/add` does the rest.

**The matching rule is the interesting part, and it's deliberately strict.** A
line only matches a product whose description contains the item's name as a
whole phrase. Kroger's search is fuzzy and will happily hand back almond milk
for "milk", oat flour for "flour", and olive oil for "coconut oil" - and a
wrong item that ends up in someone's actual shopping is far worse than a line
they have to add themselves. Anything unmatched is named, not silently dropped.

Set these to turn it on:

```
KROGER_CLIENT_ID=...
KROGER_CLIENT_SECRET=...
KROGER_REDIRECT_URI=http://localhost:3000/api/grocery/kroger/callback
```

The OAuth `state` is held in an httpOnly cookie and checked on the way back, so
a callback URL someone else hands you can't quietly attach their Kroger account
to your session.

**Developing without Kroger credentials.** There's a stand-in that implements
the documented shapes of the four endpoints used here:

```bash
pnpm kroger:stub
```

Point `KROGER_API_BASE=http://127.0.0.1:4600/v1` at it with any client id and
secret, and the whole flow runs end to end - sign-in, store picking, matching,
and the cart add. Its catalogue is a dozen items and its search is loose on
purpose, so the "Kroger returned it but it isn't what you asked for" path is
reachable. That is what the integration has actually been run against; the live
API still hasn't been.

**On mobile, the sign-in happens on the web.** The redirect lands on our server,
which identifies mobile callers by a bearer token that a system browser doesn't
carry, so a sign-in started in the app would come back as nobody. The app opens
the web list instead, and everything after that - picking a store, sending the
list - happens in the app.

---

## Sharing

Every recipe is **private by default**. Switch it to *Friends* or *Anyone with
the link* and you get a link to send: `/r/<id>`.

That page works **without an account**. A stranger opening the link sees the
recipe, Open Graph metadata for a decent preview, and an invitation to sign in
and save it - which is the whole point, since the friction in "share a recipe
with me" is usually the other person having to sign up before they can read it.

**A shared page is the card, not your relationship with it.** Your shelves,
your rating, and your notes are never rendered there - the type the page
receives has no field for them.

**Saving makes a copy.** It's yours to shelf, rate, and shop for; the original
owner only sees the save count go up. Attribution to the *original source* is
carried over untouched, because that credit belongs to whoever wrote the recipe
rather than to whoever imported it. A saved copy starts private, and is indexed
for pantry search immediately.

**Not found and not allowed look identical.** A 404 never confirms that a
private recipe exists to someone guessing ids.

The rules live in `packages/core/src/sharing.ts` as pure functions, every read
path goes through `canView`, and `pnpm check:sharing` asserts the negative
cases against a real database - including that a friends-only recipe is not
reachable by a signed-out visitor holding the link.

---

## Friends

Add someone by handle - `@sam`, `Sam`, or a pasted profile URL all find the
same person. They accept, and two things happen: your *Friends* recipes become
visible to each other, and their cooking shows up in your feed.

**One row per direction** in `friendships`, which is what makes the three
states cheap to ask about and unambiguous about who asked whom:

| Rows | Meaning |
|---|---|
| `A → B pending` | A has asked B. Only the requester's row exists. |
| `A → B accepted` + `B → A accepted` | They're friends. |
| `A → B blocked` | A has blocked B - and B sees no relationship at all, rather than a rejection. |

So "who are my friends" and "who has asked me" are each a single indexed
lookup. Declining a request, withdrawing one, and un-friending are all the same
operation on the same rows.

**The feed** is what friends cooked, rated, and shared, newest first. Every
branch requires the recipe to be non-private - a friend cooking something they
kept private never surfaces.

Access follows the friendship in both directions: accept and a friends-only
recipe becomes reachable, unfriend or get blocked and it 404s again. That's
asserted in `pnpm check:friends`, along with the whole state machine.

---

## Discovery

Browse and search what other people have shared, filter by tag, and get "more
like this" under any recipe. Readable **signed out** - discovery you have to
sign up for isn't discovery.

Only `public` recipes appear, never your own. Friends-only recipes stay out
deliberately; they reach their audience through the feed.

**Not embeddings, on purpose.** Recipes are short structured documents whose
useful similarity is concrete - shared ingredients, shared tags, same cuisine -
and a result you can explain (*"Shares 6 ingredients"*) is worth more to a cook
than a cosine score they can't argue with. So:

- **Search** is Postgres full-text over a generated `tsvector`, with title
  weighted above cuisine above description. `websearch_to_tsquery` parses what
  a person actually types, quoted phrases and stray punctuation included.
- **Tags** are matched exactly via GIN array overlap rather than being stemmed
  into the text vector - you want `vegetarian`, not a near-miss.
- **Similar** counts shared non-staple ingredients, with shared tags as a
  lighter signal, and shows the count as the reason.

Ranking is by save count, then recency. Someone bothering to put a recipe into
their own collection says more than a star they clicked once.

`recipes.embedding` is still there for when semantic search earns its keep.

One wrinkle worth knowing if you touch the search column: `to_tsvector('english', …)`
is only STABLE, and `array_to_string` is too, so neither can appear in a
generated column. The `::regconfig` cast form is IMMUTABLE, which is why the
expression looks the way it does.

---

## Writing and correcting recipes

The same form does both. `/recipe/new` starts empty; `/recipe/:id/edit` starts
from what's already there. A recipe someone typed and a recipe pulled out of a
video are the same card once they're on the page.

Ingredients are **one box per line**, parsed with the same parser the importer
uses - people think "2 tbsp olive oil", not amount / unit / item in three
fields. Underneath each line the form shows the canonical name it landed on
("Matches *firm tofu* in your pantry"), because that name is what pantry search
and shopping-list merging join on, and it's the part that silently stops
matching when a line is misread.

**Sections are typed, not configured.** End a line with a colon and it becomes
a heading - "For the sauce:" - applying to every ingredient under it until the
next one. That's how recipes are written, so it needs no extra control: the
same one box per line does both. Headings are stored as the `group` on each
ingredient and expanded back into heading rows whenever the form reopens, so a
multi-part recipe survives editing instead of flattening.

Two decisions worth knowing:

- **Parsing happens on every keystroke, not on blur.** Blur is nearly right and
  fails exactly once: type the last ingredient, hit Save, and the click can be
  handled before the blur's state update lands - so the recipe saves without
  the line you just typed. A line nobody touches never re-parses, which is the
  other half of what's wanted: an imported ingredient keeps the structure the
  extractor gave it rather than being re-read by a simpler parser.
- **Saving an edit sets `verifiedAt`.** The confidence score and the list of
  guesses stay on the record, but they stop being a warning, because a person
  has now read it. That's the difference between "we're not sure" and "we
  weren't sure, and then someone checked".

Editing never rewrites provenance - where a recipe came from, who made it, and
what we admit we guessed are left exactly as they were. A corrected import is
still an import.

Validation and normalisation live in `packages/core/src/editor.ts` and run
inside the database layer, so both write paths agree on what a valid recipe is
and there's no way to save an invalid one from either app. The ingredient index
is rebuilt in the same call as the write, or pantry search keeps answering from
the old card.

`pnpm check:editor` asserts all of it against a real database.

---

## Cooking from a card

`/recipe/:id/cook` is the recipe one step at a time, sized to be read from
arm's length and driven with one finger or the arrow keys. The screen stays
awake — Wake Lock on the web, `expo-keep-awake` on the phone — because
unlocking a phone with batter on your hands is the moment an app stops being
worth using.

This is where two extracted fields finally get used. The importer has always
pulled a hands-off duration out of step prose ("simmer for 20 minutes") and,
for videos, the second each step happens at; until now both were badges.

- **Timers belong to the session, not the step.** The reason you set one is so
  you can move on, so they run in a tray above whatever step you're reading.
  Several at once is the normal case.
- **They're anchored to the wall clock**, not counted down on a tick. A tick
  drifts, and stops entirely when the tab is backgrounded or the phone sleeps —
  exactly when someone has walked away from a simmering pot. Nothing has to be
  running for the remaining time to stay correct.
- **Overdue keeps counting up.** "3 minutes past" is what you want to know when
  you come back and something smells wrong.
- **Steps typed by hand get timers too.** The same deterministic
  `timerFromStep` the importer uses runs over edited step text, so writing
  "simmer for 20 minutes" is all anyone has to do — and changing the number in
  the text moves the timer with it.
- **▶ Watch this bit** deep-links into the source video at that second, for
  recipes that came from one.

Ticking the last step marks the recipe cooked — bumping `timesCooked`, which
pantry search and discovery both lean on — and asks for a rating there and
then, which is the one moment anyone has an opinion.

**Sessions survive a reload.** Progress and running timers are kept per recipe
- `localStorage` on the web, `AsyncStorage` on the phone - and restored for 12
hours, which is longer than any cook and shorter than "yesterday". Timers come
back *correct* rather than approximate, which falls out of anchoring them to
the wall clock: `endsAt` is an absolute instant, so a timer written before a
reload and read after it has simply been counting down the whole time.

The screen says "Picked up where you left off" rather than silently jumping to
step 8, and offers to start over. A session is dropped if it belongs to another
recipe, is stale, or points past a recipe that has since been edited shorter.

**Timers reach you when you've moved on.** On the phone the alarm is handed to
the OS the moment a timer starts, so it fires whether the app is backgrounded,
swapped out, or killed — which is the whole reason anyone sets a cook timer.
Pausing, resetting or clearing cancels it, because a paused timer that still
rings the phone is worse than no timer. On the web a system notification is
raised when the tab isn't the one you're looking at.

Permission is asked when the first timer starts, never at launch: an unprompted
prompt is the one people deny by reflex, and on iOS a denial is close to
permanent.

**The web has a real limit here.** Notifications raised by a page belong to
that page, so they only fire while it is still open, even if backgrounded.
Close the tab and the timer goes with it. Surviving that needs a service worker
with its own scheduler, which is more machinery than a cook timer earns. The
phone has no such limit.

---

## Optional pieces

**Persistence** - set `DATABASE_URL` in `apps/web/.env.local` (the db package
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

`pnpm db:push` also exists - it diffs the schema straight into the database with
no migration file. Handy while iterating locally, but note that drizzle-kit
can't round-trip array defaults, so `push` reports the same six no-op
`ALTER ... SET DEFAULT '{}'` statements every time. `db:migrate` doesn't.

**Video transcription** - only used when a video has no captions *and* no usable
caption text. Needs `yt-dlp` and `ffmpeg` on PATH plus `DEEPGRAM_API_KEY` or
`GROQ_API_KEY`. Without them the pipeline says so in the trace and falls back to
caption extraction rather than failing.

**Mobile** - `pnpm dev:mobile`. It talks to the web app's API, so run both, and
copy the web app's publishable key into `apps/mobile/.env`. On a simulator
`localhost` resolves to your machine; on a physical device the app falls back to
the LAN address Expo is already serving from. Copy a link in any app and Second Breakfast
offers to import it when you switch back.

Five tabs - Library, Cook, List, Friends, Discover - with importing, recipes,
and shared links pushed over them. Sharing uses the system share sheet, which
is the point on a phone: it hands the link to whatever the person already uses
to talk to their friends.

Check it still bundles without needing a device or simulator:

```bash
pnpm mobile:bundle
```

**Keep mobile's dependency versions where Expo wants them.** `expo install --check`
is the source of truth; `npm view <pkg> version` is not. Pinning React Native to
the newest release rather than the one Expo SDK 57 expects produces a Metro
failure about a missing `rn-get-polyfills` that looks nothing like a version
problem. The one deliberate exception is TypeScript: Expo suggests 6.x, and the
rest of the workspace is on 5.x.

---

## Deploying

Never deployed, but the production build has been run and exercised end to end
locally - with and without Clerk - so the following is measured rather than
assumed.

**Clerk is mandatory in production.** The single local development account is
refused when `NODE_ENV=production`, deliberately: a shared implicit account on
a public URL would be a security hole, not a convenience. Without Clerk keys
every authenticated endpoint answers `501` and says which variables are
missing. With them, signed-out requests get `401 Sign in to do that.` and
protected pages `307` to `/sign-in?redirect_url=...`. Discovery and `/r/<id>`
stay readable signed out, by design.

**`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` has to be set at build time**, not just
at runtime. `NEXT_PUBLIC_*` values are inlined into the client bundle by
`next build`; setting one only in the running environment ships a client with
no Clerk in it. Verified both ways - the key is absent from the bundle when
unset at build, present when set. Platforms that build and run in one step
(Vercel, Netlify) do the right thing automatically; a split build/run pipeline
needs the variable in both halves.

**Run the migrations against the production database** before first boot:

```bash
DATABASE_URL=<production> pnpm db:migrate
```

**Video imports shell out to `yt-dlp`.** This is the constraint most likely to
bite when choosing a host. The import route runs on the Node runtime and spawns
`yt-dlp` (and, for ASR only, `ffmpeg`), so the binary has to exist on the
machine serving the request. A container or VM host - Fly, Railway, Render, a
plain VPS - can just install it. Function-based platforms generally cannot, and
there a YouTube import will silently degrade to description extraction at
around 0.2 confidence, and Instagram will fail outright. `YT_DLP_PATH` and
`FFMPEG_PATH` exist so you can point at wherever your host puts them.

**Imports are slow by web standards.** The Jacques Pépin video took 52 seconds
end to end - fetch, subtitles, one model call. `maxDuration` on the import
route is 300s, which exceeds the function timeout on several platforms' cheaper
tiers. Worth checking before assuming a video import will survive.

**Kroger's redirect URI must match the deployed origin** exactly, and be
registered in the Kroger developer console. The state cookie is set `secure` in
production, so the callback only works over HTTPS.

**Mobile** points at whatever `EXPO_PUBLIC_API_BASE_URL` says, which is the
deployed web origin - the two apps share one server.

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
server and a real database - exclusivity, the cook counter, re-import
idempotency, and the guards on built-in shelves:

```bash
pnpm check:shelves http://localhost:3000
```

```bash
pnpm check:pantry
```

```bash
pnpm check:sharing
```

```bash
pnpm check:friends
```

```bash
pnpm check:discover
```

```bash
pnpm check:editor
```

```bash
pnpm check:grocery
```

All seven work on their own fixtures and are safe to re-run. `check:shelves` imports
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

1. **Running mobile on a device.** It bundles, but has never been opened on a
   phone or simulator - no device was available. Expect the first run to turn
   up layout and native-module issues that bundling can't catch.
2. **Kroger against the live API.** Built and exercised end to end against a
   local stand-in, but never run with real Kroger credentials - expect the
   first real run to turn up schema details a stand-in can't.
3. **Semantic search** - `recipes.embedding` is unused. Worth doing when the
   ingredient-overlap approach visibly runs out, not before.
4. **Web timers still stop at the tab.** Close it and the timer is gone —
   see "Cooking from a card". The phone hands its alarms to the OS and has no
   such limit. Fixing the web side means a service worker with its own
   scheduler.
5. **The mobile home-screen label.** `app.json` uses the full "Second
   Breakfast", which iOS truncates near 12 characters to "Second Brea…". Left
   as-is deliberately — a naming convention is well down the priority list, and
   "Seconds" wasn't the right call. Worth a look before any store listing.
