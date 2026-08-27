/**
 * Keeps the app readable without a signal.
 *
 * The kitchen is where a phone loses reception and where a recipe is least
 * replaceable, so what this caches is the reading path: the app shell, the
 * static bundle, and any recipe already opened. Everything else is left alone.
 *
 * What it deliberately does NOT do:
 *
 * - It does not cache anything that costs money or changes state. Imports,
 *   checkout, and every non-GET go straight to the network, because a cached
 *   import is either a lie or a double charge.
 * - It does not make cook-mode timers survive a closed tab. Nothing here can:
 *   that needs the Notification Triggers API or Web Push, and a service worker
 *   on its own gets neither. The phone app has no such limit.
 */

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

// Kept deliberately short. A precache list that names pages goes stale the
// moment a route is added; everything else is cached the first time it's seen.
const PRECACHE = ["/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      // A failed precache must not leave the worker uninstalled forever; the
      // offline page is a nicety, not a precondition.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Requests that must always hit the network, cache or no cache. */
function mustBeLive(url, request) {
  if (request.method !== "GET") return true;
  return (
    url.pathname.startsWith("/api/import") ||
    url.pathname.startsWith("/api/billing") ||
    url.pathname.startsWith("/api/credits") ||
    url.pathname.startsWith("/sign-in") ||
    url.pathname.startsWith("/sign-up") ||
    url.pathname.includes("/clerk")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Someone else's origin is their business.
  if (url.origin !== self.location.origin) return;
  if (mustBeLive(url, request)) return;

  // Hashed build output never changes under its own name, so the cache is
  // always right and the network is never worth waiting for.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  // Pages and read-only API calls: network first, so an online reader always
  // sees the truth, with the cache as the answer when there isn't one.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, PAGES));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    // Only successful, complete responses are worth keeping. A 404 or a
    // redirect cached as a recipe is worse than nothing.
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // A navigation with nothing cached gets the offline page rather than the
    // browser's dinosaur, so at least the app says what happened.
    if (request.mode === "navigate") {
      const fallback = await caches.match("/offline");
      if (fallback) return fallback;
    }
    throw err;
  }
}
