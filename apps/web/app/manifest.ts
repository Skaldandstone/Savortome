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
    theme_color: "#E89A0C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Its own file: a maskable icon is cropped to whatever shape the platform
      // fancies, so the mark is drawn well inside the safe area. Reusing the
      // square one here would let a circular mask take the handle off.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
