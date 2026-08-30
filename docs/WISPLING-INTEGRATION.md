# Second Breakfast and Wispling self-care handoff

## Purpose

Wispling helps neurodivergent users notice and respond to self-neglect caused by hyperfocus, time blindness, forgetfulness, low interoception, task switching costs, and decision paralysis. Second Breakfast can provide the practical food half of that loop without turning either product into a diet, calorie, or compliance tracker.

- Wispling owns the gentle body check and no-shame support.
- Second Breakfast owns food suggestions, pantry context, dietary restrictions, and shopping-list actions.
- Both apps remain fully useful on their own.

The full product boundary and proposed flow live in Wispling's `docs/second-breakfast-integration.md`. This document records what Second Breakfast needs to receive.

## Feed me gently route

Add a dedicated mobile route opened by a device-local link:

`seconds://care?source=wispling&intent=eat_now`

It should not land on recipe discovery. It should present a low-demand screen with optional tap choices for effort, time, temperature, texture, appetite, and whether to use the saved pantry.

Return no more than three suggestions:

- Right now: open, assemble, or reheat
- A little more: minimal preparation
- Future me: optionally add one reliable food to the shopping list

Convenience food is a valid result. The ranking goal is "most likely to be eaten soon," not culinary ambition.

## Data contract

Accepted link fields:

- `source=wispling`
- `intent=eat_now`
- `effort=open|microwave|one_pan|cook`
- `time=two|ten|twenty`
- optional broad `temperature` or `texture` selected by the user
- `return_to=wispling://...`

Do not accept or request diagnosis, mood, medication, support-conversation history, heart rate, sleep, steps, or a reason for the prompt. Dietary restrictions, allergies, pantry contents, and food history remain inside Second Breakfast.

If a return event is added later, it is opt-in and neutral: `opened_suggestion` or `made_choice`. Never send Wispling the food selected, calories, ingredients, or whether the user ate it.

## Safety and tone

- No calorie, weight, fasting, or food-morality language.
- No claim that the user is hungry, dehydrated, deficient, or medically unwell.
- No rewards, streaks, compliance scores, or failure state.
- Medication advice is out of scope.
- Eating-disorder support is out of scope and must redirect to qualified human resources under Wispling's permanent safety boundary.

## Build order

1. Add the `/care` Expo Router screen with static low-effort choices.
2. Reuse pantry and dietary settings without requiring either.
3. Add deterministic ranking for effort and time before considering personalized ranking.
4. Add the Wispling return link.
5. Test signed-out, empty-pantry, offline, and Second-Breakfast-not-installed paths.
6. Complete neurodivergent usability and eating-disorder safety review before launch.

