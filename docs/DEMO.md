# Demo runbook

A walking order for showing Second Breakfast, plus the setup and the honest
gaps. Written 2026-08-27 after an overnight session; see `PRODUCT.md` for how
any of this actually works.

## Before you start

```bash
pnpm demo:reset          # puts the dev account's AI credits back to a clean 3/3
```

Run this before every rehearsal. It only touches the credit ledger — recipes,
shelves, the plan and the shopping list are untouched, because those are the
demo and wiping them would leave an empty app.

Start the app:

```bash
pnpm --filter @seconds/web dev
```

**Clerk needs attention first** — see "Known issues" below. Without fixing
that, sign-in loops, which blocks the credit meter and checkout both.

## Suggested walk

1. **Library** (`/`) — the seeded recipes are already there: a YouTube
   transcript extraction, a TikTok caption extraction, a schema.org blog
   import, and two hand-typed recipes. Point at the shelf filter and sort.

2. **Import something live.** Paste a real YouTube cooking video URL into the
   front page. This is the whole pitch: a rambling spoken-word video becomes a
   structured card with ingredients, steps, and timers. Takes ~15–30 seconds
   — Jacques Pépin's microwave pasta video is a good one, tested tonight
   end-to-end.
   - Watch the credit meter above the paste box tick down by exactly one.
   - Mention that a normal recipe blog would have cost *nothing* — only video
     and social imports spend a credit.

3. **Cook mode** (`Start cooking` on any recipe). Step through a few steps and
   point out the amounts shown beside each instruction — built last night,
   and the one feature that took three rounds of bugs found by testing
   against real recipes before it was right (garlic vs. garlic powder, "the
   sauce" resolving to the wrong ingredient).

4. **Shopping list** (`/list`). Add a recipe or two, show it grouped by
   supermarket aisle — produce, dairy, pantry, in the order a shop is laid
   out.

5. **Plans** (`/plans`). The pricing model: three tiers, all named after
   hobbit meals (Elevenses / Luncheon / Feast), and the free tier listed
   first and longest — almost everything in the app is free, and only AI
   import costs anything. Click "Choose Luncheon" to show the checkout
   attempt degrade gracefully (see below).

6. **Print or export** a recipe (bottom of any recipe card). Also: the
   library page has a "download all N recipes" link — a full JSON archive,
   yours to keep.

## What will NOT work in a live demo right now

- **Checkout.** Clicking a plan or a credit pack will show "Payments aren't
  set up yet" rather than opening a real Stripe checkout. This is honest,
  not broken — say so before someone clicks it, not after.
- **Kroger.** Never tested against the live API, only a local stand-in.
- **The service worker / true offline mode.** Installable and the offline
  banner both work, but the actual caching layer is intentionally switched
  off pending a real-browser check — see `PRODUCT.md`'s "Installing it, and
  losing signal".
- **Mobile on an actual phone or emulator.** Bundles, typechecks, and a real
  Android prebuild succeeds — but nobody has watched it render on a screen
  yet.

If asked live: "the payment and mobile-device pieces are staged and tested up
to the edge of needing your Stripe account / a phone in hand" is the true
answer.

## If something breaks mid-demo

- **"No AI imports left"** — you forgot to run `pnpm demo:reset`, or you
  imported more than 3 things already this session. Run it again; it's safe
  mid-demo, nothing else is affected.
- **Sign-in redirect loop** — the Clerk key mismatch (see below). Falls back
  to the single local dev account if Clerk env vars are unset entirely,
  which is a viable demo fallback: comment out both `NEXT_PUBLIC_CLERK_*`
  lines in `apps/web/.env.local` and restart. No accounts, no sign-in
  screen, everything else works identically.
- **A page 500s** — check the terminal running `pnpm dev` for the real error;
  nothing sensitive should reach the browser (that was fixed last night),
  but the terminal will have it.

## Known issues (also in `pending-decisions.md`)

- Clerk's publishable/secret key pair looks mismatched — `clerk env pull`
  fixes it. Not yet done because it needs your Clerk dashboard access.
- Everything above needing Stripe, an AWS region, or physical hardware is
  queued and unaffected by anything in this file.
