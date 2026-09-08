# Concept rebuild integration, 30 August 2026

The web concept rebuild has passed local integration checks. **Visual acceptance of the running UI is still pending.** The browser URL-policy denial was not bypassed. No new running-UI screenshots, authenticated browser interactions, Android redesign or deployment are claimed.

The [lane handoff](web-concept-rebuild.md) describes the new scene-led library, real shelf sidebar, responsive recipe cards, illustrated care cards, parchment recipe/cook sections, brass/plum shell and labeled navigation. Integration first verified all 26 handoff file hashes with zero drift, then made the specific changes below. The prior palette-only screenshots and previous web build do not validate this revision.

## Integration fixes

- Restored the actual catalogue ingredient list inside expanded care cards. Preparation steps, strict filtering, single-item list writes and all handoff/privacy fields remain unchanged.
- Kept the journal placeholder, arrow and new empty-state wording exclusive to the server-selected woodland library. Shared `LibraryList` and `LibraryItem` now default to the legacy treatment; only `WoodlandLibrary` passes the explicit visual prop. Four tests exercise the actual page and component bodies with synthetic boundaries, including query flags that cannot select the new home and the absence of atlas artwork from the legacy missing-image state.
- Encoded four **lossless WebP derivatives**, preserving every original PNG. Original and encoded images decode to identical RGBA buffers at identical dimensions. Only the image URLs changed, not the compositions, colors, atlas positions or controls. `scripts/encode-woodland-assets.mjs` reproduces the encoding using the Sharp already installed with Next; no dependency was added.

The four asset files fall from 10,055,701 bytes (9.59 MiB) to 7,253,418 bytes (6.92 MiB), a 27.9% reduction. This is a file-size result, **not a network/LCP benchmark**. The lossless textures and atlas remain substantial and need permitted browser performance assessment. The audited worker already permits these flat `/woodland/*.webp` paths; no cache allowlist was broadened.

## Verified checks

| Check | Result | Evidence |
| --- | --- | --- |
| Core suite | 551 tests passed | [Core log](checks/web-concept-core-suite.txt) |
| Core/database/mobile typechecks | All passed again without incremental caching | `checks/web-concept-packages-core-typecheck.txt`, `web-concept-packages-db-typecheck.txt`, `web-concept-apps-mobile-typecheck.txt` |
| Final web typecheck | Passed after integration fixes | [Typecheck log](checks/web-concept-integration-typecheck.txt) |
| Care state, native links and save helpers | 13 tests passed | [Care log](checks/web-concept-care-ui-tests.txt) |
| Actual gate/page, library components and image-report code with mocked boundaries | 13 tests passed, including four new library regressions | [Boundary log](checks/web-concept-auth-library-tests.txt) |
| Generated worker/privacy parity | 10 tests passed after regeneration | [Offline log](checks/web-concept-offline-tests.txt) |
| Production web build | Passed, 35 prerendered pages; `/care` remains dynamic | [Build log](checks/web-concept-production-build.txt) |
| Original/encoded artwork pixel equality | Four pairs identical | [Encoding report](checks/web-concept-encoding.json) |
| Existing Android artifact/source | APK hash unchanged; all 107 source hashes match | [New review manifest](checks/web-concept-review-manifest.json) |

These are source, component-tree, compilation and file checks. Component-tree tests do not render browser pixels or replace interaction/accessibility testing. The fresh web build uses blank Clerk/database/paid-service credentials, beta disabled and worker compilation enabled. It is not an invited-account hosted image.

## Build identity and remaining review

Current local output: `apps/web/.next-build`, build ID `xRryI_oXqVxfyyv5CUkPT`. The [source/artifact fingerprint](checks/web-concept-review-manifest.json) records 330 source/configuration files and 475 generated build files. Six of the lane's original 26 files changed during integration, listed in that manifest. New integration files are four WebP derivatives, the encoder, the library regression script and this evidence. Original PNG hashes are preserved in the encoding report. The earlier `.next-build` contents have been replaced; their logs/fingerprint remain historical only.

All source remains uncommitted on `codex/whimsical-private-beta`. No cloud operation, invitation or paid integration was performed. The Android APK is the previous visual design and must not be represented as matching this web revision. Its native care functionality and existing device/signing limitations are unchanged.

Required next evidence remains permitted browser inspection of the actual narrow/wide UI, both themes, enlarged text, reduced decoration/motion, keyboard/focus, screen-reader output, import and New shelf interactions, care expansion/settings/write failures, and recipe/cook behavior. The [main integration report](INTEGRATION.md) retains the separate real-account, device, current Wispling alpha, signing, AWS/rollback and cohort gates.
