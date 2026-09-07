# Second Breakfast Style Guide

Status: concept-board web system extended across existing features, 31 August 2026. Visual acceptance and release remain gated pending permitted browser, device and invited-account review. The latest web continuation is documented in `docs/beta/web-ui-completion.md`; previously built Android artifacts are preserved.

## Woodland concept implementation

The authoritative visual reference is `design/concepts/woodland-beta-board.png`. James requested a structural rebuild to match this board after reviewing the first palette-only pass. That earlier implementation and its screenshots are historical, not acceptance evidence for this revision.

The web app now uses the board's kitchen composition, dark timber, thin worn-brass frames, quiet plum actions, parchment recipe pages and labeled line-icon navigation. Library shelves occupy a desktop column beside image cards. At narrow widths the shelves wrap and recipe cards become image-and-text rows. Care uses compact illustrated choices which expand with native details controls. Recipe ingredients and method, plus active cook instructions, use legible native text over parchment.

| Token | Light | Dark (new-device default) |
| --- | --- | --- |
| Background | `#EEE3CD` | `#101514` |
| Surface | `#F8EEDB` | `#191E1B` |
| Text | `#302B21` | `#EDDFC5` |
| Muted text | `#65573F` | `#C0AF92` |
| Brass accent | `#705024` | `#E1BA7D` |
| Border | `#8A704A` | `#8E7855` |
| Primary action | `#E5DBE6` | `#3E3344` |
| Primary action text | `#493B4C` | `#F3DEBB` |
| Parchment / ink | `#E5D0A9` / `#332C20` | same |

Headings, recipe-card names and navigation use Georgia. Ingredients, forms, timers and supporting copy retain a readable system sans. Sizes use rem units. Display options retains system/light/dark, 100/125/150/200 percent text, and reduced decoration. Explicit saved light/system preferences still win over the new dark default.

Production art is separate from every label/control: `kitchen-scene.png`, `food-atlas.png`, `parchment.png`, and `timber.png` in `apps/web/public/woodland`, with lossless WebP derivatives shared by web and Android. The four-by-four food atlas maps directly to catalogue IDs; it does not classify recipes or establish ingredients or safety. Library cards use actual recipe photos or a neutral journal illustration when no photo exists. Scene, food, and texture assets were generated with the built-in imagegen tool; prompts and file evidence are in `docs/beta/web-concept-rebuild.md`. The earlier hearth and kettle/journal assets remain preserved. The optional Wispling visitor remains comparison art only. No new character is introduced, and PR #38's skillet mark remains intact.

Frames are native CSS, iconography is native SVG, and all controls are HTML. Never crop a control, title, recipe or card from the concept image. Counts and shelves must come from actual data. The library import link expands the real import form; new shelf uses the existing authenticated API. Do not fabricate the board's recipe examples or counts.

Reduced decoration removes scene/food illustrations, paper/timber textures and ornamental rules while preserving content, navigation, controls and card boundaries. Reduced-motion CSS disables nonessential transitions. Keyboard outlines and a skip link remain visible; the dock flows into the document at 200 percent text. Print uses plain paper rather than textures. System/light layouts preserve the same composition.

Everyday screens use restrained native journal headings and flat, framed form surfaces. Do not repeat the entry scene or timber texture behind fields. Planning uses a wrapping day grid, discovery uses photo cards and narrow recipe rows, and pantry, shopping, friends, saved meals, shelves and sharing use consistent brass rules and serif section titles. All displayed counts, images and content still come from existing data. The new headings are server-gated; public legacy pages do not render them. Secondary details and companion recipe panels wrap at enlarged text sizes.

Native controls follow the chosen light/dark color scheme, including system mode. Border colors provide at least 3:1 against the three flat theme surfaces in static calculation; body and muted text retain at least 4.5:1 on those surfaces. These numbers do not certify artwork overlays, browser-rendered colors or full WCAG conformance. Paper panels use the darker brass boundary for controls. Display and navigation disclosures close on Escape with focus requested on their summary. Saved meals appears under More. Care write feedback appears next to the selected item, retaining native live status and the exact single-item action.

Every native input, select and textarea needs a visible label or an explicit
accessible name. A placeholder is supporting copy, never the only name. Repeated
controls include their object and context, such as the timer label and source
step. Failed writes and safety-check failures use alerts; routine loading and
  confirmed saves use polite status. Countdown clocks do not announce every
  second. The reusable source audit in `scripts/check-web-accessibility-source.mjs`
  enforces the native-control, image, dialog and frame naming boundary.

  Mobile follows the same naming rules. Tappable controls use a semantic role,
  duplicate recipe and avatar images stay hidden from assistive technology, and
  working controls expose at least a 44 by 44 point target. The reusable audit in
  `scripts/check-mobile-accessibility-source.mjs` checks those source boundaries;
  device TalkBack and Switch Access checks remain separate acceptance work.

The generic offline care shell stays independent of accounts and does not inherit private data. Care catalogue filtering, fixed Wispling return, temporary restrictions, saved-setting warnings, shopping confirmation and local sign-in restoration are unchanged. Color and imagery never mean a food is safe. No scores, streaks, clinical claims or completion reporting.

Source compilation cannot establish visual fidelity. The new revision still needs permitted browser inspection at narrow/wide widths, both themes, keyboard, enlarged text and reduced decoration. The existing explicit browser URL-policy block must not be bypassed. Do not describe the earlier Android APK or earlier browser screenshots as this new web revision.

## Existing public baseline

The private Android build now uses byte-identical WebP derivatives of the web
scene, food atlas and textures. Its library has actual recipe-image rows, neutral
journal fallbacks, shelf counts and a wider two-column arrangement. Care uses
native expandable cards with every ingredient/step available for all three slots.
Recipe and cook instructions use parchment panels with scoped dark ink; reduced
decoration retains the system-theme palette without texture. Android follows the
system light/dark preference and native text scaling. The labeled line-icon dock
wraps at enlarged text, and decorative food art drops out to make room for text.
Cook step scrolling respects reduced motion and ingredient lists are not clipped.
The old hearth/kettle assets remain preserved but are no longer the default scene.
These are source changes, not evidence of emulator or physical-device acceptance.

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

