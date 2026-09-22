# Neurodivergent-first usability audit

Date: 2026-09-22

## Scope and evidence boundary

This pass reviewed the current web source and the public signed-out production surfaces at
`https://savortome.skaldandstone.com/`. The live checks covered wide and narrow layouts for the
home, Care, and onboarding surfaces. No authenticated browser session was available, so the
signed-in recipe editor, plan, pantry, and shopping-list interactions remain a separate acceptance
gate. Automated and browser checks do not replace assistive-technology, physical-device, or owner
acceptance.

No billing, grocery ordering, reminders, dietary inference, or diagnostic behavior changed in this
pass.

The read-only AWS check used account `051722405355` in `us-east-2`. The preserved compatibility
service is still named `secondbreakfast-web`; it was healthy and running at the time of this
read-only recheck (`desired=1`, `running=1`, `pending=0`). Its task definition points to immutable image digest
`sha256:4fb60cc81481edea8386655ad1f8ee8bb82e29f63b4c1f55e024753a929da76a`, runs as UID 65532 with a
read-only root filesystem, and carries public-cache policy label version 3. Its source tree matches
the current main application source; only release-evidence documents differ. This check did not
change AWS resources or prove a running ECS task.

## Existing supports retained

- Onboarding can be skipped and revisited, and its progress is kept locally.
- Cooking mode presents one step at a time, shows step-specific ingredient amounts, supports swipe,
  keyboard, and labeled button navigation, and preserves an interrupted cooking session.
- Cooking mode includes timers, technique explanations, reduced-motion handling, and a deliberate
  start-over action.
- Pantry items can be confirmed, reduced, removed, hidden, or deferred without shame-oriented copy.
- Display controls include theme and reduced-decoration options.
- Care starts with useful suggestions and keeps optional preference controls secondary.

## Changes from this pass

- Recipe editing now keeps an unfinished recovery draft in session storage. Storage is isolated by
  an opaque account-derived scope and recipe ID; malformed recovery data is discarded. A person can
  restore the draft or explicitly keep the saved version.
- Clearing the full shopping list, pantry, or meal-plan week now requires an inline confirmation.
  Individual item controls remain immediate so routine work is not burdened.
- The global error page now distinguishes saved data from possibly unsaved text instead of making an
  absolute safety claim.
- The public accessibility page now describes attention, memory, motion, and display supports in
  plain language without requiring a person to disclose a diagnosis.
- The meal-plan clear control has an explicit keyboard focus treatment consistent with the woodland
  theme.
- Protected editor, plan, pantry, search, and shopping-list actions now recognize a 401 as a likely
  ended session, explain the recovery step without blame, and provide an app-local sign-in return
  link. Recipe text remains in the tab recovery draft while the person signs in again.
- A failed shopping-list checkbox write now rolls the optimistic checkmark back. The screen no
  longer claims an item reached the basket when the server rejected the change.
- A plan sign-in return keeps the selected week through a validated local `week` parameter. Unknown,
  malformed, or external return destinations are rejected.
- Pantry add and remaining-amount forms now wait for a confirmed write before clearing typed text or
  closing the correction form. A rejected bulk clear keeps its confirmation and context visible.
  Pending writes disable only the relevant controls and use explicit “Adding,” “Saving,” or
  “Clearing” labels, reducing duplicate actions without freezing unrelated pantry choices.
- Removing one planned meal now presents a clearly focused Undo action on web and an equally visible
  recovery callout on mobile. Undo restores the same recipe, day, and meal slot. A failed restore
  keeps the action available and reports the current failure instead of claiming success.
- Mobile now confirms before clearing an entire week, matching the existing web safeguard. Both
  confirmations remain open after a rejected write, so a network interruption does not erase the
  person's context. Old success messages are cleared when a new plan action begins.

## Product parity observations

Official product documentation was used for feature-shape comparison, not for claims of clinical
effectiveness:

- [Paprika's Android guide](https://www.paprikaapp.com/help/android/) documents reversible grocery
  purchase state, selective clearing, pantry tracking, and meal planning. Those recovery patterns
  informed keeping Undo and clear-week context available until Savortome confirms a write.
- [AnyList's getting-started guide](https://help.anylist.com/articles/getting-started/) documents
  checking off cooking steps and moving meals within a plan. It reinforces visible progress and
  reversible planning actions without requiring a complex history screen.
- [Samsung Food](https://support.samsungfood.com/hc/en-us/articles/35369657798548-Getting-Started-with-Meal-Planner)
  connects saved recipes to weekly planning and shopping lists; its food-list guidance also uses
  pantry state and use-by timing for suggestions.
- [Tiimo](https://www.tiimoapp.com/) demonstrates the value of a visible timeline and restrained
  focus tools for neurodivergent routines.

Savortome already has the main recipe-to-plan-to-list loop, a calmer Care entrance, cooking-session
re-entry, and bounded meal-plan recovery. The next highest-value usability work is validated re-entry
across devices, notification controls that remain opt-in, and hands-on assistive-technology testing
of the signed-in workflows.

## Remaining acceptance gates

1. Sign into the production Clerk test account and exercise recipe draft restore/discard, meal-plan
   undo, the three bulk confirmations, account switching, and session expiry.
2. Run keyboard-only and screen-reader passes on the signed-in editor, plan, pantry, and list.
3. Repeat narrow-layout and enlarged-text checks on a physical phone or tablet.
4. Complete owner visual and copy acceptance. Successful compilation or automated checks do not
   close these gates.
