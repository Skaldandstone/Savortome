# Savortome rebrand migration

Status: public product identity and repository rename implemented. Compatibility identifiers and live infrastructure remain intentionally retained until a separately reviewed migration is approved.

## Coordination decision, 2026-09-12

A Claude scratch conversation recorded an AWS, Clerk, and other-service inventory discussion and the product-direction decision that **Savortome is the current public product identity** and **Second Breakfast is a retired public name**.

This is a coordination record, not authorization to deactivate or rename anything. The AWS `secondbreakfast-web` service, the `secondbreakfast` database, and other `secondbreakfast-*` resources are the live Savortome backend under compatibility names. The Savortome load balancer routes to that service. They are not cleanup candidates or abandoned resources. Any future identifier migration must first identify all dependencies and consumers, preserve recovery evidence and rollback paths, define data retention or export handling, receive owner approval, and prove the replacement before changing a provider or deleting data.

## Brand decision

- Public name: **Savortome™**
- Tagline: **Food is magic. Cooking shouldn’t require it.**
- Visual idea: an open recipe tome holding a hearth ember
- Nordic connection: the hearth as the place where food, memory, and people gather, expressed through materials and restrained geometry rather than costume imagery or faux runes

## Implemented in this candidate

- Web and native display names, mastheads, metadata, legal headings, contact subjects, offline shell, and shared-page titles use Savortome.
- The old skillet icon is replaced by the simplified woodland leather tome across full-colour launcher exports, with reduced notification and splash treatments.
- Existing woodland kitchen, parchment, timber, food, hearth, and journal artwork is preserved because it already supports the new identity.
- Explorations are retained under `design/savortome/concepts/`. Versioned full-colour exports under `design/savortome/icons/` are copied reproducibly by `scripts/make-icons.mjs`; only notification and splash treatments remain code-generated.

## Compatibility identifiers intentionally retained

- package namespace: `@seconds/*`
- Expo slug and URL scheme: `seconds`
- ~~iOS and Android identifier: `com.secondbreakfast.app`~~ — reversed 2026-09-11, see "Mobile identifier change" below.
- Clerk access metadata key: `second-breakfast`
- AWS, database, container, cache, and deployment resource identifiers
- current beta and application hostnames under `secondbreakfast.skaldandstone.com`

These values have live or historical consumers. Renaming them together with marketing copy would create unnecessary authentication, upgrade, rollback, certificate, and deployment risk.

## Coordinated external cutover

1. Accept the name, tagline, production icon, and website appearance.
2. Commit and review the app and Studio changes.
3. Rename the Linear and Notion project labels while retaining their stable IDs and history.
4. Rename the GitHub repository to `Skaldandstone/Savortome`, update the canonical local checkout and routing inventory, and verify every worktree and origin.
5. Add the preferred Savortome app hostname, DNS, certificate, proxy route, and redirects before retiring any old hostname.
6. Decide whether mobile package identifiers remain permanent. If changed, treat the result as a new application identity rather than a cosmetic rename.
7. Update Clerk, AWS, EAS, Stripe sandbox, build artifacts, documentation, and operational dashboards only where the old name is user-visible. Preserve stable machine keys where migration adds no user value.
8. Rebuild signed web and native candidates, then complete browser, physical-device, authentication, provider, and owner acceptance.

The old marketing route and name should remain redirects or historical aliases long enough to preserve links and tester access. Deployment and remote repository changes remain explicit owner gates.

## Mobile identifier change, 2026-09-11

Step 6 of the cutover left this open: decide whether the mobile identifiers
stay permanent. James decided they should not. The new identifier on both
platforms is:

```
com.skaldandstone.savortome
```

and this is now the naming convention for every Skald and Stone app:
`com.skaldandstone.<product>`. Kall already matches it (`com.skaldandstone.kall`,
Services ID `com.skaldandstone.kall.signin`), so Savortome was the only
outlier - it was named before the rebrand.

`com.skaldandstone.savortome` was chosen over `com.savortome.app` because the
convention for these identifiers is the reverse DNS of a domain you actually
control, and `savortome.com` is not registered.

### This is a new application identity, not a rename

Neither store permits an identifier to change. A Google Play package name is
permanent from the moment the app is created, and an App Store Connect record
is bound to its bundle ID for life. So this means new records on both stores
and abandoning the old ones:

| Old | Fate |
| --- | --- |
| App Store Connect app `6810124754` (`com.secondbreakfast.app`) | superseded; held TestFlight builds 1 and 2, build 2 was in Beta App Review |
| Google Play app `4974432210122251491` (`com.secondbreakfast.app`) | superseded; held one internal-testing release, one tester |
| Apple Services ID `com.secondbreakfast.app.signin` | superseded by `com.skaldandstone.savortome.signin` |

### New records, created 2026-09-11

| What | Value |
| --- | --- |
| Apple App ID | `com.skaldandstone.savortome` ("Savortome"), Sign in with Apple + Push Notifications enabled |
| Apple Services ID | `com.skaldandstone.savortome.signin`, primary App ID `BVB696HTCS.com.skaldandstone.savortome`, domain `clerk.savortome.skaldandstone.com`, return URL `https://clerk.savortome.skaldandstone.com/v1/oauth_callback` |
| App Store Connect | app `6811296756`, SKU `savortome-ios-2026` |
| Google Play | app `4973692325814773858`, package `com.skaldandstone.savortome`, internal testing tester list `Savortome Owner` |

App Store Connect reserves an app name per record, so the old record could
not keep "Savortome" while the new one claimed it. The old record
`6810124754` was renamed to "Savortome Legacy Identifier" rather than
deleted: renaming is reversible and deleting is not, and whether to remove it
is the owner's call. The same applies to the old Play app and the old
Services ID - both are superseded but still present.

The Apple private-relay email sources registered earlier
(`clkmail.savortome.skaldandstone.com` and the Clerk bounces address) are
account-level and did not need recreating.


The cost of this is at its lowest now and only grows: nothing is publicly
released, TestFlight had three testers and Play internal had one. Doing it
after a public launch would strand every installed copy, because an installed
app cannot follow its identifier to a new one - users would have to find and
install a different listing by hand.

### What changes

- `apps/mobile/app.json`: `ios.bundleIdentifier` and `android.package`. Build
  counters reset to 1, since the new store records start empty and the old
  numbers referred to a different app.
- `apps/mobile/eas.json`: the submit profile's `ascAppId` is cleared until the
  new App Store Connect record exists and has its own id.
- Apple: new App ID, new Services ID for Sign in with Apple, new signing key,
  new provisioning. EAS generates fresh credentials for a new identifier.
- Google Play: new app record, new upload keystore, new internal release, the
  tester list re-created.
- Clerk: the Apple connection's `bundle_id`.

Evidence files under `docs/beta/` keep the old identifier on purpose. They
record what was actually built and shipped at the time, and rewriting them
would falsify the record.
