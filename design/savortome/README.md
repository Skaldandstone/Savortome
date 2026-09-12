# Savortome brand exploration

Savortome™ is the working public brand for the product previously presented as Second Breakfast.

Tagline: **Food is magic. Cooking shouldn’t require it.**

The visual direction joins an open recipe tome with a hearth ember. It keeps the existing woodland kitchen, parchment, soot, moss, and amber vocabulary while avoiding faux runes, Viking costume imagery, and ornate fantasy-game heraldry.

`concepts/savortome-book-hearth-mark-v1.png` and `concepts/savortome-woodland-icon-v2.png` are nonproduction explorations generated with the built-in image generation tool.

`icons/app-icon-master-v1.png` is the simplified woodland launcher direction. Its checked-in 1024, 512, 192, 180, and 32 pixel exports are the canonical full-colour sources. `scripts/make-icons.mjs` copies those exact exports into the mobile and web asset slots and continues to generate the reduced notification and splash treatments. `concepts/savortome-app-icon-scale-preview-v1.png` records the legibility check at common sizes and through an Android circle mask.

The current migration changes public display names and artwork only. Compatibility identifiers remain stable until their consumers can be migrated deliberately:

- package namespace `@seconds/*`
- Expo slug and URL scheme `seconds`
- iOS and Android identifier `com.secondbreakfast.app`
- Clerk access key `second-breakfast`
- AWS, database, container, cache, and deployment resource identifiers
- existing beta and application hostnames

Final remote repository, domain, store-listing, and provider-console renames require separate owner-approved changes with redirect and rollback plans.
