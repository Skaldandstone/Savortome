import type { MetadataRoute } from "next";

/**
 * Installable to a home screen.
 *
 * The point isn't the icon — it's that a recipe you've already opened stays
 * readable in a kitchen with no signal, which is exactly where phones lose it.
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
    theme_color: "#b4451f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
