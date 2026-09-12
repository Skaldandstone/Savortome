"use client";

import { useEffect } from "react";

/**
 * Opt-in production registration. The worker stores only public/static assets
 * and the generic care shell, never account pages or API responses.
 * Local browser installation, updates, and offline fallback were exercised
 * on 30 August 2026; hosted cohort and device checks remain release gates.
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
