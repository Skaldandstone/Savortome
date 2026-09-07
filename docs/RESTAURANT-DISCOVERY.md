# Restaurant and dish discovery

Status: feature proposal captured 2026-08-30. Not implemented or scheduled for the private beta. This document records James's idea and proposed design choices, not approved implementation scope.

## Purpose

Help someone find a good version of the food they want, at a restaurant that fits their dietary requirements, budget, and preferred dining environment. A restaurant's overall star average is insufficient evidence for either a particular dish or a person's needs.

The core search could be: "Find excellent mushroom ramen nearby, with vegetarian broth, booths, and a room where we can talk comfortably on Friday evening."

This extends Second Breakfast's food discovery naturally: cook something, find somewhere that serves it, or save a reliable meal for another day. Restaurant discovery should be optional and should not displace recipes, pantry tools, or the low-effort care flow.

## What the user selects

| Area | Proposed selectors |
|---|---|
| Dish | Name, regional style, favorite preparation, ingredient likes/dislikes, texture, spice preference, and optionally a saved favorite dish |
| Dietary needs | Vegetarian/vegan, religious requirements, intolerances, allergies, and other user-authored exclusions; let people mark requirements explicitly |
| Room and seating | Quiet conversation, music/TVs, booths, high-backed booths, standard tables, communal seating, open floor plan, separate rooms, outdoor seating, lighting, and crowding |
| Access | Step-free entry, suitable seating, and accessible restroom information, each with its own source and unknown state |
| Practical | Area or optional current location, distance, price, visit day/time, dine-in/takeout, and party size |

Keep "must have" separate from "prefer." Do not assume a dietary tag is always a soft preference: for example, gluten avoidance may be a medical requirement. Do not infer diagnoses from choices or require disclosure. Open floor plans and booths are explicit preferences, not proxies for noise or accessibility.

Let people start with a dish and a few choices rather than complete a long profile. Save preferences only when requested. Existing Second Breakfast settings can prefill a reviewable selection, but the current recipe keyword matcher must not become a restaurant safety checker.

## Three separate kinds of evidence

1. **Food requirements:** What does this branch say about this dish's ingredients, modifications, and preparation? What is missing or conflicting?
2. **Dish quality:** Do recent, specific reports describe a good version of this dish? Does its style match the user's stated taste?
3. **Dining environment:** What is reported about the relevant seating area and visit time?

Never combine these into a single reassuring safety or trust percentage. Every material claim needs a source, an observation or publication date where available, a retrieval date, and a clear evidence type: restaurant statement, diner report, or extracted information. Retrieval today does not mean the underlying observation is current.

Dish records belong to a specific restaurant branch and menu version. Preserve style differences and distinguish "on the menu" from "people recommend it." Do not transfer a chain's menu, handling practices, or dish reputation automatically between locations.

## Allergy and dietary boundaries

- Show known conflicts prominently and exclude them from matching recommendations. Popularity, convenience, and price must never compensate for a hard conflict.
- Missing, stale, or contradictory ingredient/preparation evidence remains "needs confirmation." It must not pass a strict requirement filter or silently count as a match. An explicit option may show such candidates separately for investigation.
- A menu omission, a dish name, or an AI inference cannot establish that an allergen is absent. A requested substitution is not a confirmed accommodation.
- Keep ingredient information separate from cross-contact information, including shared fryers, utensils, and preparation areas. Restaurant statements are attributed claims, not certification by Second Breakfast.
- No "allergy-safe" badge or medical clearance. Offer a concise, user-reviewed list of questions for the restaurant and a call link. Never contact a restaurant or transmit a dietary profile without explicit authorization.
- If nothing qualifies, explain which information is missing. Do not relax allergies, medical requirements, or other must-haves automatically.

FARE recommends speaking directly with a restaurant's manager or chef about ingredients and preparation, including separate preparation areas and utensils. That supports a confirmation workflow rather than an automated clearance claim. [FARE: Calling Restaurants](https://www.foodallergy.org/resources/calling-restaurants)

## Better evidence than a star average

The product promise is transparent evidence and personal relevance, not guaranteed detection of fake reviews. The FTC advises looking across sources, checking recency and reviewer context, and treating sudden clusters of reviews cautiously. [FTC: How To Evaluate Online Reviews](https://consumer.ftc.gov/articles/how-evaluate-online-reviews)

Proposed ranking and moderation principles:

- Prioritize the user's own saved favorites and explicit taste preferences, then recent dish-specific reports. Restaurant-wide stars provide secondary context.
- Show sample size, freshness, disagreement, and source coverage. A dish with two enthusiastic reports has limited evidence, not proven superiority.
- Avoid double-counting syndicated reviews or repeated reports from the same contributor as independent corroboration. Do not simply average incompatible provider rating scales.
- Treat unusual bursts and repeated wording as review signals needing investigation, not proof that a reviewer or restaurant is fraudulent. Apply moderation consistently to positive and negative reports, with corrections and appeals.
- Separate dish taste, service, and room observations. "Great service" should not establish "excellent ramen."
- If optional visit evidence is introduced later, label precisely what was verified. A receipt cannot prove truthful taste judgments or safe food handling. Avoid retaining raw receipts or collecting continuous location history.
- Paid placement must be visibly separate and must not change organic relevance, evidence labels, or requirement filtering.

Start with explainable rules. AI may extract dish mentions or summarize cited observations, but must not invent menu items, infer safety, manufacture consensus, or declare reviews fake.

## Room details need context

Noise changes with time, occupancy, events, and seating area. Prefer "three diners described the rear room as conversational on weekday lunches" over a permanent "quiet" label. Conflicting reports should remain visible.

Distinguish booths existing from booths being available for the planned visit. Seating availability remains unknown without a current reservation or restaurant confirmation. A proposed result can offer "ask for a booth" without promising one.

Post-visit feedback can be short: what dish did you order, would you order it again, where did you sit, when did you visit, and could you converse comfortably? Contributions are optional. Public notes must not expose private dietary profiles by default.

## First useful version

1. Pilot one limited area with a small, source-attributed restaurant and dish catalog. Use permitted restaurant information and voluntary reports; do not assume access to commercial review datasets.
2. Support dish/name search, basic dietary choices, price/distance, quietness, booths, and open-layout preferences. Include unknown states from the beginning.
3. Return a short list with the dish, why it fits, conflicts, unanswered questions, evidence dates, and links to the menu and contact details.
4. Let users privately save "want to try," "reliable favorite," and dish-specific notes. Collect optional structured room observations to improve sparse coverage.
5. Add richer taste matching, more locations, and optional group planning only after the catalog proves useful. Group planning must use consented requirements without exposing an individual's profile.

The difficult dependency is reliable, sufficiently detailed data. Provider coverage, licensing, attribution, caching permissions, and pricing have not been evaluated. No API integration, subscription, or scraping commitment is approved by this proposal. Begin with deterministic search and permitted caching; perform extraction on changed source content rather than paying for a model call on every search. Estimate provider and operating costs before implementation.

## Fit with existing work and release checks

Keep dietary information inside Second Breakfast and preserve the privacy boundary in [WISPLING-INTEGRATION.md](WISPLING-INTEGRATION.md). Do not send restaurant searches, selected meals, or allergy details back to Wispling. Restaurant browsing should not automatically replace immediate low-effort food suggestions.

Before release, validate stale/contradictory menus, chain branches, dishes no longer served, unknown cross-contact handling, seating availability, conflicting noise reports, sparse dish reviews, duplicate evidence, and zero-result searches. Confirm that no hard requirement is traded away, no unsupported claim appears as verified, and no private profile leaks through search links, analytics, public notes, or provider requests. Allergy-related copy and behavior require qualified review before launch.

Success means users can find a dish they want, understand why a venue fits, and see what still needs checking. Click-through rate and a high average rating alone do not establish success.
