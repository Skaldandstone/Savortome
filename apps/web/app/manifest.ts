import type { MetadataRoute } from "next";

/**
 * Installable to a home screen.
 *
 * Only public assets and a generic care shell are available offline.
 * Private recipes and account responses are never stored by the worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Second Breakfast",
    // iOS elides an icon label around twelve characters, so the same
    // contraction the native app uses.
    short_name: "2xBreakfast",
    description: "Every recipe you find, turned into a card you can actually cook from.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf8f4",
    theme_color: "#E89A0C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Its own file: a maskable icon is cropped to the platform shape, so the
      // mark stays inside the safe area instead of losing the skillet handle.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
