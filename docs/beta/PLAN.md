# Approved scope: Second Breakfast whimsical private beta

Deliver web and Android beta for a small invited cohort. Canonical repo is `C:\Users\James\Documents\GitHub\SecondBreakfast`. Baseline was clean main, 512 tests and four typechecks passing. Runtime, visual, live integration, emulator and physical-device claims must be separate.

## Visual system

Translate approved Vordling woodland field-guide and newer Wispling illustrated direction into hearth light, dark timber, parchment recipe journals, botanical details, kettles, jars and worn brass. Retain Second Breakfast and recognizable skillet mark; preserve useful PR #38 icon work. Produce polished raster concepts for library, recipe/cook, care, and desktop, plus one optional existing Wispling-visitor comparison. Default beta has no character. Scene art, props and icons are separate; text and controls are native. Apply system across features, richer on entry surfaces, quiet on ingredients, timers, lists and forms. Preserve light/dark, reduced decoration, reduced motion, readable body type, labeled navigation, and updated style guide.

## Care and handoff

Web/mobile `/care` is reachable directly and from cooking. Mobile auth belongs on protected routes so guest care works. Offer useful suggestions immediately with optional effort, time, temperature, texture, appetite and pantry controls, no required questionnaire. Shared deterministic curated catalogue in core/format contains steps, ingredients, effort, time and sensory attributes. No paid AI or inferred classifications. At most three: Right now, A little more, optional Future me. Hard effort/time/restriction limits; opt-in pantry compatibility ranks first; no unsuitable fallback.

Reuse dietary, pantry and shopping APIs. Exclude detected allergen conflicts, explain limits, never claim verified food safety. Settings failures are visible and temporary choices remain possible. Basic native suggestions are offline. Shopping writes require account/connectivity; preserve choice through sign-in and never claim an unconfirmed write succeeded.

Allowlisted link fields are source, intent, effort, time, temperature, texture, return_to. Accept `seconds://care` and matching web fallback, ignore unknown fields and reject invalid values. Return is only `wispling://care-return`, maps to Wispling home without bypassing onboarding, no arbitrary destination. Wispling optional button detects installed app, falls back to web, retains standalone support. Transfer no health history, diagnoses, medication, dietary profile, food choice, or eating completion. No return completion event. Wispling changes stay limited to handoff in its isolated branch.

## Private readiness and rollout

Verify account, import, library, editing, shelves, planning, pantry, dietary profile, shopping, sharing, discovery using disposable fixtures. Fix demonstrated transaction/account-isolation defects; update stale docs only after verification. Service worker has explicit public/static allowlist, never authenticated page/API cache, removes old caches, supplies generic offline care shell.

Server Clerk user-ID allowlist gates hosted redesign/care, disabled by default, previous experience for everyone else. Public frontend flags cannot grant access. Guest care works in local web and private Android; hosted beta requires invited account. Repeatable enrollment/removal/install/feedback instructions; identities needed for enrollment, not development; no automatic invitations.

Reuse existing AWS and scale-down arrangements. Before release verify identity, deployed revision and rollback. No new recurring services. Stripe/grocery use test credentials or existing stubs; unavailable live integrations stay disabled. No real charges/purchases/public launch. Reviewed cohort build needs kill switch and previous container revision pinned for rollback.

## Acceptance

Run existing tests, four typechecks, production web build and Android export/build. Meaningful ranking, malformed link, restricted return, privacy, authorization and rollback tests. Exercise sign-in/out, missing settings, empty pantry, offline, session expiry, failed writes, absent apps and bidirectional handoff. Verify worker install/offline reload/update/logout/account switching/no private cached responses. Browser and available Android emulator interaction plus visual narrow/wide, both themes, enlarged text, keyboard, screen-reader labels, reduced decoration. Physical device status separate. Deliver artwork, assets, working builds, evidence, enrollment runbook and short blocker list. No new mascot, gamification, semantic search, proactive food reminders, medical guidance, or iOS release. Public food support waits for documented usability/safety reviews.
