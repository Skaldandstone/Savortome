"use client";

import type { CookTimer } from "@seconds/core/format";

/**
 * Telling someone their timer went off when they aren't looking at the page.
 *
 * The beep only helps if the speakers are on and the kitchen is quiet. A
 * system notification is what actually reaches someone who has switched to a
 * different tab — which, for a timer, is the whole point.
 *
 * **What this cannot do:** notifications raised this way belong to the page,
 * so they only fire while it is still open, even if backgrounded. Close the
 * tab and the timer dies with it. Surviving that needs a service worker with
 * its own scheduler, which is a much larger thing than a cook timer justifies.
 * The mobile app schedules with the OS instead and has no such limit.
 */

export const notificationsSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

export function notifyPermission(): NotifyPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Ask for permission, at the moment someone starts a timer.
 *
 * Deliberately not on page load. An unprompted permission dialog is the most
 * ignored object on the web, and browsers increasingly punish sites that fire
 * one without a gesture behind it. Starting a timer is exactly the gesture
 * that makes the request make sense.
 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Raise the notification for a timer that has just finished. */
export function notifyTimerDone(timer: CookTimer, recipeTitle: string): void {
  // Nothing to add if they're already looking at the page — the tray is right
  // there, going off.
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  if (notifyPermission() !== "granted") return;

  try {
    const notification = new Notification(`${timer.label} — time's up`, {
      body: recipeTitle,
      // Same tag per step, so a timer can't stack up duplicates.
      tag: `seconds-timer-${timer.stepN}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers throw here rather than resolving the permission promise.
  }
}
