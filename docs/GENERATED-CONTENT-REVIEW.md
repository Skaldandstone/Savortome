# Savortome generated-content review

Reviewed 2026-09-14 against Skald & Stone policy
`sands-generated-content-v1`. The canonical company standard is maintained in
the Studio repository at `docs/GENERATED-CONTENT-STANDARD.md`. This product note
records how Savortome applies it and what remains unverified.

## Runtime generation inventory

| Path | Backend prompt | Validation and fallback | Trace |
|---|---|---|---|
| Recipe extraction from prose, transcripts, captions, and photos | `savortome-recipe-extraction-v2` | Anthropic structured output, recipe schema revalidation, canonical ingredient and step normalization, explicit empty-result rejection | Import trace plus server generation audit |
| Natural-language pantry search | `savortome-pantry-query-v2` | Bounded schema and course allowlist; any refusal, provider failure, or unsupported filter uses the local ingredient parser | Server generation audit records `passed` or `fallback` |
| Grocery receipt review | `savortome-receipt-extraction-v2` | Bounded schema, hidden-control removal, canonical deduplication, no empty result; every item remains in a mandatory review queue | Server generation audit |
| Nutrition estimate for unmatched ingredients | `savortome-nutrition-guess-v2` | Finite nonnegative numbers, input-item allowlist, duplicate removal, sensible displayed precision; USDA remains primary and missing estimates become zero contribution | Server generation audit |
| Open-web recipe search | `savortome-web-recipe-search-v2` | Returned cards can only originate in validated search-tool result blocks; unsupported URLs and roundups are removed; model prose only ranks those candidates, with deterministic index-order fallback | Server generation audit records ranking fallback separately |

All five Anthropic paths receive the backend-owned company instruction before
their product-specific instructions. It requires direct human writing, clear
separation of evidence, calculations, unknowns, interpretations and
recommendations, no invented facts or precision, visible source limits,
prompt-injection resistance, and accountable human review for consequential
content. User and retrieved content cannot weaken these rules.

Deepgram and Groq Whisper transcription endpoints do not offer a developer or
system-instruction channel. Savortome therefore treats ASR as an untrusted input
adapter, not a final content generator. Provider cues are stripped of hidden
controls, constrained to finite nonnegative timestamps, and bounded by cue,
per-cue and total-text limits before recipe extraction. The transcript is never
rendered as an answer. Recipe extraction then receives it under the standard's
prompt-injection boundary. The adapter records Deepgram's response identifier or
Groq's request-id header when supplied. Neither endpoint currently returns token
usage in this response shape, so ASR usage remains unavailable in the audit.

USDA FoodData Central is a factual data lookup rather than a generation model.
The UI distinguishes published nutrition, USDA-computed values, and model
estimates. A missing database match is an unknown, not permission to present a
model estimate as measured data.

## Customer-facing material review

The review covered generated or agent-authored content currently reachable from
the product:

- Recipe import notes, confidence and provenance labels preserve uncertainty and
  ask the cook to review extracted material.
- Receipt results enter a review queue. They do not directly change pantry
  quantities, infer consumption, or retain the receipt image.
- Care, pantry resurfacing, meal-planning and onboarding copy does not infer a
  diagnosis, medication, nutrition deficiency, eating completion, or pantry
  certainty. Dietary and allergen matching retains its visible non-certification
  wording.
- Cook-mode technique help and divided ingredient amounts are deterministic,
  bundled source material. They do not claim live AI review.
- The offline care catalogue and suggestions are deterministic. They keep strict
  filters and visibly state that account settings are unavailable offline.
- The woodland kitchen scene, food atlas, parchment and timber artwork under
  `apps/web/public/woodland/` were generated during the prior design pass. Exact
  prompts and initial visual inspection are recorded in
  `docs/beta/web-concept-rebuild.md`. The art contains no flattened controls or
  factual food-safety guidance. WebP derivatives preserve the reviewed source
  images. `hearth.png` and `kettle-journal.png` predate that four-asset pass and
  retain their existing source record rather than receiving invented provenance.
- Mobile woodland assets are product artwork, not evidence or guidance. Their
  presence does not imply current physical-device or owner visual acceptance.

No customer-facing surface claims that deterministic suggestions were reviewed
by a model. No generated result is described as verified safe.

## Validation and privacy boundary

Generation audit records contain only policy and prompt versions, provider,
model, provider response ID, token counts when returned, UTC time, a generic
source-version reference, and validation outcome. They omit prompts, source
content, output, receipt images, pantry data, dietary data and user identity.
Operational audit failure cannot turn the pantry parser's deterministic fallback
into an outage.

Relevant tests exercise the company instruction in real request bodies, recipe
trace records, unsupported pantry filters, receipt control characters and
duplicates, unrequested nutrition rows, web-search injection attempts, metadata
shape, and malformed transcript cues. These tests use local stand-ins and make no
paid provider requests.

Integration evidence from 2026-09-14:

- `docs/beta/checks/generated-content-tests.txt`: 688 core tests passed across
  140 suites.
- `docs/beta/checks/generated-content-typechecks.txt`: core, database, web and
  mobile TypeScript checks passed.
- `docs/beta/checks/generated-content-web-build.txt`: the production Next.js
  build passed and emitted the full web route table.
- The shared read-only repository-hygiene check inspected 32 repositories. It
  found no Savortome-specific preservation issue. Its 14 wider-workspace
  findings remain outside this change; disk headroom was 198.81 GiB, below the
  300 GiB review threshold, so no generated files were deleted automatically.

## Still unverified

- A live Anthropic, Deepgram or Groq response under the new instructions has not
  been purchased or inspected.
- Server log retention, access control and correlation in the deployed hosting
  environment need an operational review before these records are treated as a
  durable audit ledger.
- Older generated art has source prompts and prior visual inspection, but no new
  owner visual acceptance was inferred from this source review.
- Human review quality for real recipe photos, adversarial webpages, unusual
  receipts and nutrition estimates needs representative usability testing.
- The historical competitor statements in `docs/COOK_MODE_GUIDANCE_SPEC.md` are
  design research notes, not current customer claims or independently refreshed
  market evidence.
