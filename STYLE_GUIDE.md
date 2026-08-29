# Second Breakfast Style Guide

Status: current implementation baseline, 28 August 2026.

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
| Good | `#2F6B46` | `#7FC59B` | Herb green for success and safe substitutions |
| Warning | `#8A6100` | `#E2B768` | Mustard for timing and attention |

The accent is for actions and key food information, not broad decorative fields. Green means a
positive or safe state. Warning gold should remain legible without reading as an error.

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

