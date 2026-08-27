import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { CookTimer } from "@seconds/core/format";

/**
 * Timers that go off when the app isn't open.
 *
 * This is the half that actually matters on a phone. The in-app buzz only
 * works while the app is foregrounded, and the reason anyone sets a cook timer
 * is to go and do something else. Handing the alarm to the OS means it fires
 * whether the app is backgrounded, swapped out, or killed outright.
 *
 * Scheduled at the moment the timer starts, cancelled when it's paused, reset,
 * or cleared — so a pause has to actually cancel, or the phone goes off for a
 * timer that isn't running any more.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Per-step, so a step's notification can be cancelled without touching others. */
const identifier = (stepN: number) => `seconds-timer-${stepN}`;

/**
 * Ask when the first timer starts, not at launch.
 *
 * A permission prompt on first open, before anyone knows what the app does,
 * is the one people deny out of reflex — and on iOS a denial is close to
 * permanent.
 */
export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;

    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Hand a timer to the OS so it fires without the app. */
export async function scheduleTimerNotification(
  timer: CookTimer,
  recipeTitle: string,
): Promise<void> {
  if (timer.endsAt === null) return;

  const seconds = Math.round((timer.endsAt - Date.now()) / 1000);
  // Already done, or so close that the OS would fire it late anyway.
  if (seconds < 1) return;

  if (!(await ensureNotifyPermission())) return;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("timers", {
        name: "Cook timers",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    await cancelTimerNotification(timer.stepN);
    await Notifications.scheduleNotificationAsync({
      identifier: identifier(timer.stepN),
      content: {
        title: `${timer.label} — time's up`,
        body: recipeTitle,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: "timers",
      },
    });
  } catch {
    // Notifications unavailable — a simulator without them, or a denial that
    // came back after the check. The in-app tray still works.
  }
}

export async function cancelTimerNotification(stepN: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier(stepN));
  } catch {
    // Nothing scheduled under that id, which is the common case.
  }
}
