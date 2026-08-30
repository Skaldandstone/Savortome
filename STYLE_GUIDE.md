# Second Breakfast Style Guide

Status: private woodland beta implemented 30 August 2026. Release remains gated pending device and invited-account review.

## Woodland private beta

The approved family direction is Tomte woodland field guide and Wispling illustrated support, translated into a kitchen. The beta uses native text and controls over separate raster art. The current public palette below remains the fallback for non-invited accounts.

| Token | Beta light | Beta dark |
| --- | --- | --- |
| Background | `#F3EDDF` | `#111E1D` |
| Surface | `#FFFAF0` | `#1B2B28` |
| Text | `#24342E` | `#F0E7D5` |
| Muted text | `#566258` | `#B5BDAA` |
| Accent | `#795022` | `#E2B97B` |
| Text on filled accent | `#FFFFFF` | `#111E1D` |
| Border | `#BDB29C` | `#5B6452` |

Use Georgia or the platform serif for headings, native sans for body copy, ingredients, forms, and timers. Main controls have at least 44 px touch targets. Warm brass, parchment, pine, dark timber, and hearth light define the beta. No new mascot is introduced.

The original skillet mark is retained through the supersampled, mask-safe icon work from PR #38. Concepts live in `design/concepts`; the optional existing Wispling visitor is comparison artwork only. Never ship text flattened into a concept image.

Use `hearth.png` on library and care entry surfaces. Use `kettle-journal.png` as a quiet secondary ornament. Recipe instructions and forms keep plain surfaces and strong contrast. Reduced decoration removes scene and prop images without hiding controls. Respect reduced motion. Web Appearance offers system/light/dark; Android follows the system. Screenshots in `docs/beta` record browser visual checks, not Android device validation.

Care has no scores, streaks, prescribed intake, medical claims, or completion reporting. Dietary flags remove detected conflicts only; packaging and cross-contact remain unverified. Color never means a food is safe.

Web Display options contains theme, text size (100%, 125%, 150%, 200%), and reduced decoration. These preferences stay on the device. Beta typography uses rem units so instructions, form labels, and actions enlarge together. Keep controls at least 44 px high, let rows wrap, and retain visible keyboard outlines. Navigation names remain visible, with the current page marked by text color and an underline. A keyboard skip link leads past navigation.

Filled actions use `--on-accent`, never a fixed white label on the dark theme's pale brass. Existing public colors retain their fallback. Recipe rows place ratings and shelf status below the text on narrow screens. Practical pages inherit the woodland palette and typography without adding scene art behind ingredients, timers, forms, lists, or sharing controls.

Care preserves a selected idea locally through sign-in and marks it with both a label and outline. Restored storage is validated; the only allowed app return is `wispling://care-return`. Selections, pantry settings, appetite, and dietary restrictions never become outgoing link parameters. Pantry matches use ingredient names, not quantity or preparation form. The selected card is hidden if changed restrictions exclude it, and saving still requires an explicit successful list write.

## Existing public baseline

This guide describes the visual system already shipped in `apps/web/ui/tokens.css`. The active
`Second Breakfast - UI Draft` Figma file is a working design reference; changes from that file
should update this guide and the tokens together rather than creating a parallel system.

## Brand idea

Second Breakfast is the calm, capable friend beside the chopping board. It should feel domestic,
warm, and immediately useful: a recipe card propped near the kettle, not a content feed, restaurant
menu, or glossy food-delivery app.

## Palette

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| Background | `#FBF8F4` | `#16130F` | Warm kitchen air |
| Surface | `#FFFFFF` | `#201B16` | Recipe cards and controls |
| Sunken surface | `#F4EFE8` | `#2A231C` | Grouped ingredients and secondary regions |
| Border | `#E6DDD1` | `#3A3129` | Quiet structure |
| Text | `#241D17` | `#F2ECE4` | Primary copy |
| Muted text | `#6F6459` | `#A89C8E` | Metadata and hints |
| Accent | `#B4451F` | `#F08D5F` | Terracotta action and appetite cue |
| Good | `#2F6B46` | `#7FC59B` | Herb green for success and status |
| Warning | `#8A6100` | `#E2B768` | Mustard for timing and attention |

The accent is for actions and key food information, not broad decorative fields. Green means a
positive state, never an allergen safety guarantee. Warning gold should remain legible without reading as an error.

## Typography and information hierarchy

- The current implementation uses a native sans stack for speed and kitchen-distance readability.
- Recipe title, yield, time, and the next action form the first reading layer.
- Ingredients and numbered steps are the second layer; source notes and metadata are the third.
- Use sentence case. Avoid tiny all-caps labels and editorial magazine typography.
- Numeric timers and quantities must use stable, easy-to-scan figures.

## Shape, spacing, and motion

- Cards use `14px` radii; compact controls use `10px`.
- Shadows are warm and shallow. Avoid glassmorphism, high-gloss highlights, and deep modal stacks.
- Motion should explain state: adding to a list, advancing a step, or confirming a timer. No ambient
  bouncing, streak celebrations, or transitions that delay cooking.
- Every essential state must work in a narrow mobile viewport and with one hand.

## Food imagery

- Prefer honest, attainable food in natural window light or warm practical kitchen light.
- Show useful texture and doneness, not luxury plating. Props should look lived-in and clean enough,
  never showroom-perfect.
- Avoid stock-photo smiles, delivery packaging, impossible ingredient abundance, and AI-perfect
  symmetrical tables.
- Images support recognition; the recipe must remain usable when images fail or are omitted.

## Print

Print is a first-class surface. Printed recipes use black on white, remove interactive controls and
screen shadows, keep headings with their content, and avoid splitting steps. A printout should work
beside the stove without account chrome or promotional material.

## Voice

Direct, warm, and non-performative. Prefer "You can swap in..." and "This will take about..." over
chef authority or lifestyle copy. Error messages should preserve the user's ingredients and effort.

