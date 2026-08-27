"use client";

import { useEffect } from "react";

/**
 * Registers the service worker — off unless explicitly switched on.
 *
 * Two gates, and the second one deserves an explanation.
 *
 * Not in development, because a worker that caches the shell makes an editing
 * loop lie to you: you change a file, the page doesn't move, and you spend
 * twenty minutes debugging code that already works.
 *
 * And not at all until `NEXT_PUBLIC_ENABLE_SW` is set, because a service
 * worker is *sticky*. A bad one keeps serving its cache to everyone who has
 * already visited, and clearing it means shipping another worker to undo the
 * first. That's a poor thing to switch on for the whole world on the strength
 * of code review alone — `sw.js` has been read and served correctly but its
 * registration has never actually been exercised in a browser, so it stays
 * behind a flag until someone has watched it work and watched it update.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (process.env.NEXT_PUBLIC_ENABLE_SW !== "true") return;
    if (!("serviceWorker" in navigator)) return;

    // After load, so registering never competes with the first render for
    // bandwidth on the connection that most needs it.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Private windows and some enterprise policies refuse workers. The app
        // works fine without one; it just doesn't work offline.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
