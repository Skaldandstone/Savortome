# Web concept rebuild, 30 August 2026

Status: source handed back for integration. This is the web revision James requested after saying the earlier UI did not match the concept board. No new browser screenshots, production build, Android build, deployment or visual acceptance is claimed in this report.

Subsequent parent work is recorded separately in [web-concept-integration.md](web-concept-integration.md): production build/checks passed, care ingredients and legacy-library boundaries corrected, and pixel-identical WebP derivatives added. The 26-file fingerprint below is the original lane handoff, not the final integrated fingerprint.

## Reference and implementation

The reference is [the approved four-view board](../../design/concepts/woodland-beta-board.png), visually inspected before this rebuild. The earlier palette-only implementation, its browser captures in `web-evidence.md`, and the existing Android APK are prior revisions. They cannot validate this source or demonstrate that Android matches it.

- Library: separate kitchen scene above the real recipe collection; desktop shelf sidebar and three-column recipe cards; narrow layouts use wrapped shelf links and image/text recipe rows. The heading count reports actual entries shown and the actual library total where applicable. Existing search, sorting, export, shelf filters and import use their existing data/API contracts. New shelf exposes the existing authenticated create-shelf API. No concept example recipes or counts were fabricated.
- Care: compact heading and two effort/time controls, optional preference details, and three illustrated native details cards at most. Each expands to the actual catalogue description and steps. A single shared image atlas supplies decorative food art. It is not recipe classification, ingredient evidence or a safety claim. Pantry limitations, saved-profile failure notices, item-specific shopping actions, sign-in restoration and the fixed Wispling return remain. No new outgoing fields or completion events.
- Recipe and cook: quiet parchment ingredient and instruction surfaces with dark readable type, a modest recipe image, brass headings and plum actions. Existing ingredient, timer, step, shelf and shopping controls remain native.
- Shared shell and forms: dark timber, thin brass frames, Georgia headings, system body text, labeled line icons, plum actions and themed panels. The legal footer and server beta authorization were preserved. Existing practical screens inherit the common tokens and controls; they do not receive decorative food scenes behind form fields.

The dark composition is the default for new devices. Existing stored light/system preferences are respected. Light uses pale paper surroundings with the same hierarchy. Layout changes at 1040/760px; care choices become rows at narrow widths. The 200-percent text preference changes the dock to document flow and stacks card/control grids. Native details, links, buttons, labeled selects, focus outlines and the skip link provide the intended keyboard semantics. These are source intentions, not new runtime accessibility findings.

Reduced decoration removes the food/scene artwork, timber/paper textures and ornamental inner rules while retaining cards, text, choices and navigation. Source review caught and corrected a specificity defect where explicit light/system theme variables could have overridden texture removal; missing-image library rows also now reposition their arrow correctly. Reduced motion removes nonessential CSS transitions/animation. Print uses plain paper. Actual browser zoom, screen-reader output and print rendering still require verification.

## Production artwork

Generated with the built-in imagegen tool, not the paid CLI/API fallback. All four generated bitmaps were visually inspected for composition, unwanted text/controls and suitability before wiring them into source. They are standalone artwork; no concept-board controls were cropped. Original source images remain in the thread's generated-images directory. Existing `hearth.png`, `kettle-journal.png`, concept/visitor comparisons and PR #38 skillet icons remain unchanged by this rebuild.

| Asset under `apps/web/public/woodland/` | Dimensions | Bytes | Role |
| --- | --- | ---: | --- |
| `kitchen-scene.png` | 1536 x 1024 | 2,673,084 | Hearth, jars, window and countertop scene |
| `food-atlas.png` | 1254 x 1254 | 2,704,853 | Four-by-four food and neutral journal atlas |
| `parchment.png` | 1254 x 1254 | 2,333,199 | Quiet paper material |
| `timber.png` | 1254 x 1254 | 2,344,565 | Low-contrast timber material |

All asset URLs meet the audited `/woodland/[a-z0-9-]+.(png|webp)` allowlist; no service-worker rule was broadened. This revision keeps the generated PNGs, about 9.59 MiB combined. Network payload/performance has not been benchmarked; production encoding optimization remains worth checking before release. The atlas is fetched as one shared URL, rather than a per-food URL. The requested square image dimensions were not honored exactly by generation; actual dimensions above were read from PNG headers. Atlas positions are percentage-based and do not assume a 2048px output.

## Validation for this source

- Direct Node web TypeScript check passed with incremental caching disabled. [Evidence](checks/web-concept-typecheck.txt).
- Four care-state tests passed, including malformed/fixed return restoration, expiration, local selection retention and outgoing-link privacy. [Evidence](checks/web-concept-care-state.txt). These test existing state helpers, not the new rendered layout or real Clerk login.
- All ten changed stylesheet files parsed/transformed with the installed Next CSS-module plugins in pure mode (the global stylesheet was parsed without module scoping). [Evidence](checks/web-concept-css.txt). This verifies CSS syntax/scoping, not visual layout or browser rendering.
- `git diff --check` on owned source passed, with only Windows line-ending notices. Asset signatures, dimensions, bytes, paths and SHA-256 hashes were checked. [Source and asset fingerprint](checks/web-concept-files.json).
- No package/lockfile changes, dependency installation, shared fixture mutation or heavy build was performed by this reopened lane. Parent integration owns the combined production build and release checks after this handoff.

## Missing evidence and release limits

The earlier explicit browser URL security rejection remains binding. No alternate hostname, port, browser, renderer or access path was used to bypass it. Consequently this rebuild has **no new browser interaction or screenshots**. Visual inspection of the four artwork files is separate from visual inspection of the running UI.

Pending permitted browser review: library shelf/create/search/sort/import interactions; care choices/expanded steps/guest and failed-write messages; recipe/cook parchment and timers; import/editor textareas; planner dialog; pantry/list/profile/friends/discovery/sharing; disabled Plans actions. Review each at narrow/wide widths, light/dark/system, reduced decoration/motion, keyboard, enlarged text and actual browser zoom. Pay particular attention to header text over artwork, framed controls, the fixed dock, native details focus and long recipe/shelf names. Real Clerk invited/non-invited/expired sessions, logout/account switching, sign-in roundtrip, app-return opening, native screen readers and physical devices remain separate requirements.

The offline account-free care document and service-worker authorization/cache boundary were not redesigned here. Prior v3 synthetic worker evidence remains evidence for that separately owned worker revision, not for new visual fidelity. No Android source/build was changed in this lane. Public launch and cohort rollout remain blocked by the integration checklist.

## Exact reopened-lane file handoff

New source:

- `apps/web/modules/woodland/KitchenIcon.tsx`
- `apps/web/modules/woodland/FoodIllustration.tsx`
- `apps/web/modules/library/WoodlandLibrary.tsx`
- `apps/web/modules/library/NewShelf.tsx`
- `apps/web/modules/library/woodland-library.module.css`

Updated source from the earlier beta draft:

- `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- `apps/web/modules/woodland/Woodland.tsx`
- `apps/web/modules/care/CareScreen.tsx`, `apps/web/modules/care/care.module.css`
- `apps/web/modules/library/LibraryItem.tsx`, `LibraryList.tsx`, `library.module.css`
- `apps/web/modules/recipe/RecipeCard.tsx`, `recipe.module.css`, `RecipeHeader.module.css`, `RecipeFacts.module.css`
- `apps/web/modules/cook/cook.module.css`
- `apps/web/ui/woodland.css`, `Panel.module.css`, `Button.module.css`
- `STYLE_GUIDE.md`

Four new PNGs listed above; this report and `checks/web-concept-*` validation/fingerprint files. The earlier web evidence report receives only a pointer marking its UI screenshots as prior revision. Other current worktree changes belong to earlier lane work or concurrent owners. No core, DB, mobile, auth server guard, billing, legal, worker, manifest or lockfile changes were authored in this rebuild.

## Final generation prompts

The exact four prompts used by the built-in tool follow. The concept board was supplied as a style/composition reference for the food atlas and kitchen scene only; paper and timber were generated without reference images.

### Food atlas

Use case: stylized-concept. Create ONE production sprite atlas for the Second Breakfast web app, matching the reference woodland kitchen concept board's richly hand-painted warm food illustrations. Input image is STYLE REFERENCE ONLY, do not reproduce any UI/text/screens. Square 2048x2048 image divided into a precise 4x4 grid of sixteen equally sized square cells, no gutters or dividing lines. Every cell has the same dark worn timber tabletop background, subtle warm hearth light, a centered rustic stoneware dish viewed from an elevated three-quarter angle, each subject fitting inside the central 80% of its own cell. Nothing crosses cell boundaries. No lettering, numbers, labels, icons, interfaces, watermarks or human characters. Row1 left-to-right: unpeeled yellow banana on small plate; red apple slices in small bowl; smooth plain applesauce in ceramic bowl with wooden spoon; plain round rice crackers and sliced cucumber on plate. Row2: plain yogurt and sliced banana in bowl; hummus with cucumber sticks; plain cereal beside small ceramic jug of oat milk; bowl of plain white cooked rice. Row3: plain cooked oatmeal; bowl of plain cooked white beans; plain cooked potato split open without toppings; soft scrambled eggs on small plate. Row4: plain pasta lightly dressed with olive oil; green peas mixed with white rice; closed leather recipe journal on tabletop; empty small rustic plate. Restrained realistic gouache/oil illustration, earthy amber, umber, muted cream, antiqued dark timber. No added garnish or unlisted ingredients for the foods. Tight consistency of perspective, dish scale, background and light across all16cells. Output ONE clean square atlas, not a concept board.

### Parchment

Use case: stylized-concept. One production UI material texture, square seamless tile, no objects or text. Warm aged recipe journal parchment, fine natural paper fibers, extremely subtle mottled cream and sand, softly worn but clean and evenly lit, restrained flat variation so dark native body text is highly readable. Match a finely painted old woodland kitchen field guide, not a yellow grunge poster. Fill entire image edge to edge, no border, no decorations, no symbols, no folded corners, no shadow, no ink, no writing. Desired average color pale beige #dfc89f. 1024square.

### Timber

Use case: stylized-concept. ONE production material texture for a polished woodland kitchen app interface. Square seamless dark almost-black weathered timber and fine old linen grain, very subtle warm umber and charcoal, richly tactile painterly surface. Average extremely dark #141615 with faint warm brown grain, low contrast everywhere to keep gold native type readable. Flat lighting, fills every edge, no scene, no objects, no scratches that resemble letters, no text, no borders, no lines, no UI, no symbols. Fine natural material detail only, understated like the background of an antique woodland recipe journal. 1024square.

### Kitchen scene

Use case: stylized-concept. Production background scene for Second Breakfast. The attached concept board is a STYLE and COMPOSITION REFERENCE ONLY: recreate the kitchen scenery visible in its rightmost desktop Library panel as a standalone high-quality 1536x1024 landscape illustration, no interface. Cozy old woodland cottage kitchen. Stone hearth with warm embers and orange fire on LEFT, dark timber shelves above it crowded with quiet ceramic jars and bundles of hanging herbs; tall arched divided window on RIGHT showing blue-grey forest trees and a little soft daylight. Foreground worn wooden worktop: open blank recipe journal near center, rustic loaf and sliced bread left, small black skillet with two eggs slightly right, worn brass kettle near far right. Botanical details near right edge. Richly hand-painted oil/gouache, subtle canvas grain, warm antique brass, deep umber and charcoal, aged paper, hearth glow. Match the lovingly detailed atmosphere and grounded perspective of the reference kitchen, avoid glossy 3D/cartoon. Frame wide enough to see the whole room and counter, with dark quiet space at upper-left for native heading overlay. No readable text or lettering on journal/jars, no typography, no logo, no border, no UI cards/controls, no people, no mascot, no magical particles. Output scene artwork only.
