# Woodland kitchen review assets

These are private Second Breakfast design and production assets. The beta defaults to the kitchen without a character. The concept images are visual references, not interface screenshots or packaged controls.

| Asset | Purpose |
| --- | --- |
| [Woodland concept board](concepts/woodland-beta-board.png) | Library, recipe/cook, care and desktop compositions |
| [Optional Wispling visitor comparison](concepts/wispling-visitor-comparison.png) | Comparison only; no default mascot or new character |
| [Current kitchen scene](../apps/web/public/woodland/kitchen-scene.webp) | Scene for the concept rebuild; original `kitchen-scene.png` retained |
| [Food illustration atlas](../apps/web/public/woodland/food-atlas.webp) | Authored care food illustrations and neutral journal placeholder; no inferred recipe classification |
| [Parchment](../apps/web/public/woodland/parchment.webp) and [timber](../apps/web/public/woodland/timber.webp) | Separate material assets removed by reduced-decoration mode |
| [Earlier hearth scene](../apps/web/public/woodland/hearth.png) | Preserved earlier web/mobile art; mobile copy remains in `apps/mobile/assets/hearth.png` |
| [Kettle and recipe journal](../apps/web/public/woodland/kettle-journal.png) | Separate transparent decoration; matching mobile copy in `apps/mobile/assets/kettle-journal.png` |
| [Web icons](../apps/web/public/icons/) | Skillet mark retained from the existing icon work, including a maskable asset |
| [Mobile icons](../apps/mobile/assets/) | App, adaptive, notification and splash assets |

Text, navigation, forms, ingredients, timers and actions are implemented as native web or React Native controls. Do not crop controls or wording out of the concept boards into the application. Catalogue steps and current interface wording take precedence over illustrative concept copy.

The four current WebP files are lossless encodings with identical decoded pixels to their source PNGs. [Encoding evidence](../docs/beta/checks/web-concept-encoding.json) records dimensions and hashes. The [new integration report](../docs/beta/web-concept-integration.md) separates source/build checks from the still-pending running-UI inspection. Android retains the earlier visual design.

The [style guide](../STYLE_GUIDE.md) documents both the gated woodland system and the existing public baseline. Reduced decoration removes the scene and prop images without removing useful controls. The [web evidence](../docs/beta/web-evidence.md) links actual browser captures and distinguishes missing inspections. No concept or browser image proves Android rendering or device validation.
