# Developing Second Breakfast

Local development beyond the quick start in the [README](../README.md).

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

```bash
pnpm check:library
```

```bash
pnpm check:plan
```

All nine work on their own fixtures and are safe to re-run. `check:shelves` imports
a real recipe and leaves it in the library, so point it at a development
database.

---

