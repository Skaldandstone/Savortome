"use client";

import { useEffect, useState } from "react";
import styles from "./offline.module.css";

/**
 * Says when the app is reading from the cache.
 *
 * Without this, an offline recipe looks exactly like an online one, and the
 * first thing someone notices is that importing silently fails. Better to say
 * what's happening before they try.
 */
export function OfflineBanner() {
  // Starts optimistic: navigator.onLine is unavailable during the server
  // render, and flashing a warning at every visitor while hydrating is worse
  // than being a moment late to a real outage.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <p className={styles.banner} role="status" data-print="hide">
      <strong>Offline.</strong> Recipes you&rsquo;ve already opened are readable. Importing,
      shopping lists and anything shared will need a signal.
    </p>
  );
}
