# Mobile error reporting

Android 0.1.4 (5) adds Sentry React Native 8.28.0 to the existing Savortome
reporting endpoint. JavaScript initializes before Expo Router. Android native
initialization runs before React Native starts, with a separate native
before-send callback. Managed configuration generates that Kotlin helper.

Reports contain exception stacks, version/build, and fixed diagnostic codes
for account startup timeout, hosted authentication failure and failed restart.
Arbitrary exception text is withheld. Event payloads are rebuilt from an
allowlist; user identity, account tokens, request URLs/bodies, food state,
navigation history, screenshots, view hierarchies and attachments are removed.
Replay, tracing, logging and session tracking are disabled. NDK memory dumps
are disabled because JavaScript filters cannot make them private. Android Java
and JavaScript errors are covered; this does not claim NDK crash reporting.

iOS has the JavaScript integration prepared, with native reporting disabled
until an equivalent native privacy callback is reviewed. No iOS build or
device acceptance is implied by the Android build.

Metro emits source maps and debug IDs. Automatic source-map upload is disabled
because no Sentry upload token is available. Preserve the exact maps and
release artifacts locally for later upload; do not put an auth token in the
app, repository, app manifest or plain EAS variables. Symbolicated server-side
stack traces are a separate gate until the exact maps are uploaded with a
scoped build credential. The public DSN is an ingestion address, not an
administrative credential.

Validation commands: mobile TypeScript; `node scripts/check-mobile-sentry.mjs`;
`node scripts/check-mobile-account-startup.mjs`; existing woodland contracts;
Android export and full CI. Native compilation, actual provider delivery,
emulator cold start and remote-tablet acceptance must be recorded separately.
The separate production Clerk native registration blocker is not fixed by
adding telemetry.
