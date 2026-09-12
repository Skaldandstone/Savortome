# Savortome mobile

## OTA updates (EAS Update)

A JS/asset-only change does not need a new store submission. `expo-updates`
is configured with `runtimeVersion.policy: "fingerprint"` (`app.json`), so a
build's compatibility with an update is computed from what's actually native
about it rather than a hand-maintained version number.

| Channel       | Build profile     | Reaches                        |
| ------------- | ------------------ | ------------------------------- |
| `beta`        | `beta`              | Internal Android/iOS testers    |
| `beta-simulator` | `beta-simulator` | iOS Simulator builds            |
| `testflight`  | `testflight`        | TestFlight external testers     |
| `playstore`   | `playstore`         | Google Play (currently internal track) |

Publish with:

```bash
npm run update:beta
npm run update:testflight
npm run update:playstore
```

**What this does NOT cover.** Anything that changes the native fingerprint --
a new native module, a changed permission, an `app.json`/`expo-build-properties`
change, a bumped native dependency, anything in `plugins` -- requires a new
build (and, for a permission/capability change, a new store submission)
regardless.

#### Keeping native builds rare

A native build costs real EAS build minutes and forces every user through
a store update, so treat crossing the fingerprint boundary as a real cost:

- Prefer a pure-JS approach over a new native module/config plugin when the
  difference doesn't matter for the feature.
- Don't add a permission or capability speculatively -- add it in the same
  change that uses it, and expect that change to need a real build.
- Batch unavoidable native-forcing changes together rather than shipping
  them one at a time.
- If a change is store-listing-only (screenshots, description, keywords),
  it never needs a build at all -- that's a Play Console / App Store
  Connect edit, independent of the app binary.

Note: the `playstore` submit profile currently targets Google Play's
**internal** track (`releaseStatus: draft`), not production -- there is no
production-track submit profile configured yet. Add one (matching Kall's
`google-play-production` profile in its `eas.json`) when Savortome is ready
for a real public release.
