# Savortome rebrand migration

Status: working local candidate. No deployment, provider-console change, repository rename, store-listing change, or public release has been performed.

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
- iOS and Android identifier: `com.secondbreakfast.app`
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
