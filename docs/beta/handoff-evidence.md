# Wispling handoff evidence and integration notes

Date: 2026-08-30. Changes are isolated at `C:\Users\James\Documents\GitHub\.worktrees\wispling-second-breakfast`, branch `codex/second-breakfast-handoff`, based on `e9bf7f3`. Canonical Wispling and its unrelated alpha work were not edited. Integration belongs to the parent/alpha owner after review.

**Current-alpha blocker:** the parent inspected the active `wispling-alpha` entry point: `App.tsx` exports `src/alpha/AlphaApp`. This patch's legacy `RootNavigator` and `TalkConversationScreen` are not reachable from that alpha entry point. The alpha milestone explicitly excludes Second Breakfast. The implementation, tests and export below apply to the isolated legacy baseline only. They do not establish a working current-alpha or OS-validated handoff. Current alpha needs a separately reviewed, narrow adaptation; do not reintroduce the legacy emotional-support shell or replace alpha files with this checkout.

## Scope and privacy contract

The optional card appears only in the existing `basics` support conversation when `EXPO_PUBLIC_SECOND_BREAKFAST_BETA=true`. It is off by default, dismissible, and leaves Wispling's standalone support conversation intact. It reports failure without blocking the user. No notifications or proactive reminders were added.

The builder constructs matching `seconds://care` and `https://secondbreakfast.skaldandstone.com/care` links from an explicit allowlist. It accepts only user-selected effort, time, temperature and texture, plus fixed `source=wispling`, `intent=eat_now` and `return_to=wispling://care-return`. It does not read the Wispling store, health history, diagnosis, medication, notes, dietary profile or food selection. Nothing reports eating completion. Unknown and invalid values are discarded.

Installed-app detection uses `Linking.canOpenURL`. A failed check or failed app launch attempts the web link. A failed web launch retains standalone support. The web card explicitly warns that the hosted beta needs an invitation. The Android manifest query for the `seconds` scheme is present after prebuild; the plugin also declares that query for iOS metadata, but there is no iOS release or iOS validation in this work.

The only return maps `wispling://care-return` to Home after store hydration and onboarding. Query, fragment and extra path payloads are rejected. Before onboarding, the return cannot bypass onboarding. Return navigation emits no event and writes no state.

## Validation

| Check | Result | Limit |
| --- | --- | --- |
| Wispling TypeScript | Passed | Source check only |
| Focused handoff Jest tests | 6 passed | Mocked app detection/opening, not real OS dispatch |
| Existing native prebuild | Passed; generated manifest inspected | No interaction implied |
| Android Metro/Hermes export | Passed with handoff flag enabled | A JS/assets export, not an APK or device run |
| Installed/absent-app, bidirectional return | Pure helper cases pass | Actual two-app Android test still required |
| Android emulator | Unavailable on this host | Hypervisor missing; software attempt exposed no adb device |
| Physical devices | Not tested | Must be recorded separately |

Focused tests verify the exact link allowlist, private-field rejection, successful installed-app launch without web navigation, missing app and failed detection/launch fallback, both launches failing, malformed preference values, fixed return rejection and onboarding protection.

From the isolated Wispling worktree:

```powershell
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/jest/bin/jest.js src/integrations/secondBreakfast.test.ts --runInBand
```

Evidence copies are under `checks/handoff-tests.txt` and `checks/handoff-typecheck.txt`. Do not describe these checks as physical-device or live integration success.

The successful Android export is in the isolated worktree at `.expo/handoff-export`. Its Hermes bundle is `_expo/static/js/android/index-79104d2f311b4a71fabe41b405cc952e.hbc` (2,220,183 bytes), SHA-256 `5462f83fa65669f217f71497b399218285efc15bafb183038e050caa91bddb5d`. It was built with `EXPO_PUBLIC_SECOND_BREAKFAST_BETA=true` and `NODE_ENV=production` using `node ./node_modules/expo/bin/cli export --platform android --output-dir .expo/handoff-export`; see `checks/handoff-export.txt`. TypeScript and all six focused tests were rerun successfully after export using direct Node entrypoints.

## Alpha integration package

The handoff patch is limited to `app.json`, `plugins/withSecondBreakfastQueries.js`, `src/integrations/FoodHandoffCard.tsx`, `src/integrations/secondBreakfast.ts`, `src/integrations/secondBreakfast.test.ts`, `src/navigation/RootNavigator.tsx`, and the single card import/render in `src/screens/TalkConversationScreen.tsx`. No package/lockfile changes are required. Do not replace the alpha checkout with this older worktree.

`handoff-integration.patch` was generated using a temporary Git index, leaving the real index untouched. Its seven-file scope and reverse-apply check against the isolated worktree passed. SHA-256: `3d02781dbd2ee419ef1d8445786c2b4b4be7e04fd195a900329fa6185e7c9cfb`. This is a portable review patch, not evidence that it applies cleanly to the concurrently changing alpha branch.

Before applying, review the current-alpha blocker above and obtain an integration decision from the alpha owner. The pure link helpers/tests and manifest query can be ported independently; the legacy screen/navigation hunks must not be applied as if they wire the active alpha. Keep the new card flag off until the alpha owner enables a reviewed private build. Run TypeScript, focused tests and a fresh Android prebuild after adaptation, then rebuild the native application so installed-app visibility is present. Do not send invitations automatically.

A read-only inspection of the active alpha informed `docs/second-breakfast-alpha-adaptation.md` in the isolated handoff worktree. That proposal identifies the existing food branch in `CareScreens.tsx`, an exact return mapping in `model.ts`, and the existing hydration/onboarding-aware `HandoffQueue`. It proposes using alpha's native controls while preserving standalone support. It is not an applied or validated alpha patch; the current alpha milestone remains unchanged.

## Repeatable device checklist

Use disposable test devices/accounts. Confirm `adb devices -l` and target every command with `-s SERIAL`. Install reviewed, appropriately signed builds of both apps with `adb install -r`; stop on a signing mismatch rather than erasing user data. Export/save needed app data before any separately approved uninstall.

1. With both apps installed and Wispling onboarded, enter the existing food/water support conversation. Confirm the standalone support remains available. Tap each optional food handoff. Check selected effort/time on Second Breakfast care and that care works signed out.
2. Open the native link directly, then tap Back to Wispling:

```powershell
adb -s SERIAL shell am start -W -a android.intent.action.VIEW -d "'seconds://care?source=wispling&intent=eat_now&effort=open&time=two&return_to=wispling%3A%2F%2Fcare-return'" com.secondbreakfast.app
adb -s SERIAL shell am start -W -a android.intent.action.VIEW -d 'wispling://care-return' com.skaldandstone.wispling
```

3. Repeat return before Wispling onboarding using a fresh disposable profile. It must remain in onboarding. Reject `wispling://care-return?completed=true`, extra path and arbitrary return destinations; inspect logs/network for absence of a completion write. Do not attach private logs to feedback.
4. Use a separate disposable device/profile without Second Breakfast installed. The card must attempt the matching web fallback and explain invited-account access. Do not uninstall someone's existing app just to test absence.
5. Test failed app launch, no browser/offline fallback, and return with Wispling absent. Both apps must remain usable, with no success/completion assertion and no punitive state.
6. Turn on airplane mode after install. Basic Second Breakfast ideas must remain available. Saved settings must be honestly unavailable, with temporary restrictions; shopping writes must not report success. Reconnect and check the actual list before retrying an ambiguous request.
7. Verify both themes where supported, enlarged text, TalkBack names/order, hardware keyboard if available, reduced decoration, and system reduced motion. Record screenshots as Android captures with actual device/emulator identity.

The URL scheme itself is not proof of another app's identity and is never an authorization channel. The payload deliberately contains no sensitive user state. Hosted access remains governed by Second Breakfast's server allowlist.
