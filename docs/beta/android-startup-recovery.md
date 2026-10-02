# Android account startup recovery

On 1 October 2026, the owner reported a white screen on Android 0.1.3 (4).
The exact EAS APK was installed in a read-only Pixel API35 emulator. Its
JavaScript process ran without a captured fatal exception, but the default
entry had no accessible content. Opening `seconds://care` rendered suggestions.
This is emulator evidence, not physical-tablet acceptance.

The prior gate combined ClerkLoading and ClerkLoaded. In the installed SDK,
the loading component renders only for status `loading`, while loaded content
requires successful loading. A failed account initialization therefore has no
fallback. The replacement uses the supported useAuth hook as one exhaustive
gate: unresolved accounts see loading and guest access immediately; after
12 seconds they see recovery and a restart action. Only a loaded signed-in
account can render protected routes. Restart does not erase tokens or app data.

Five component-boundary regressions in `scripts/check-mobile-account-startup.mjs`
cover loading, timeout, late recovery, signed-out admission and rejected restart.
They do not establish provider or native login acceptance. Mobile TypeScript
and the 19 existing woodland checks also pass.

The mobile application has no Sentry SDK/configuration. Its startup failure
is not automatically reported to the web Sentry project. No read-only Sentry
API token was available at diagnosis; no dashboard absence was claimed.

Production Clerk Native API/Android registration remains a separate blocker.
Changing provider access requires the exact security confirmation. No provider
settings, stored accounts, production web runtime or database were changed by
this fix. Guest suggestions must remain available without granting access to
private recipes.
