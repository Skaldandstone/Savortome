# Savortome UI illustrations

Original vector artwork authored for Savortome. Canonical sources live in this directory; edit these SVGs rather than maintaining raster copies.

- `pantry.svg`: pantry empty state.
- `meal-notes.svg`: meal journal or logging introduction.
- `recipes.svg`: saved recipe collection empty state.

All assets use a 240 x 160 viewBox, transparent outer canvas, rounded 2.5-unit strokes, and the existing parchment, woodland green and warm ochre palette. No fonts, embedded raster images, scripts or external references. Intended display width: 120–240 CSS pixels. Keep aspect ratio 3:2; do not crop. Files can also be imported into vector design tools.

When accompanying visible explanatory copy, use `alt=""` and explicit width/height to avoid duplicated screen-reader announcements and layout shifts. For standalone meaningful use, supply a short contextual alt description. These are decorative illustrations, not action icons; do not use them in place of button labels or state/error indicators. The parchment backing provides consistent separation on light and dark surfaces. No animation or motion dependency.

The pantry and recipe assets are integrated in their respective empty states. The meal-note asset remains available for subsequent UI integration. Native rendering and physical-device acceptance remain separate.
