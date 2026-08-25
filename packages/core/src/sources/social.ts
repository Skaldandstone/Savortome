import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "./fetch.js";
import type { SourceKind } from "../recipe.js";
import { socialKind } from "../source-kind.js";

export { socialKind };

export interface SocialMeta {
  title: string | null;
  author: string | null;
  caption: string | null;
  imageUrl: string | null;
}

const ogMeta = (html: string): SocialMeta => {
  const $ = cheerio.load(html);
  const get = (...names: string[]) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"]`).attr("content") ?? $(`meta[name="${n}"]`).attr("content");
      if (v?.trim()) return v.trim();
    }
    return null;
  };
  return {
    title: get("og:title", "twitter:title"),
    author: null,
    caption: get("og:description", "description", "twitter:description"),
    imageUrl: get("og:image", "twitter:image"),
  };
};

/**
 * Social platforms don't expose transcripts, so the caption is the cheap path:
 * a large share of recipe Reels/TikToks put the full ingredient list in the
 * caption precisely because the video moves too fast to follow.
 */
export async function fetchSocial(url: string, kind: SourceKind): Promise<SocialMeta> {
  if (kind === "tiktok") {
    try {
      const o = await fetchJson<{
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      }>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (o.title) {
        return {
          title: o.title.slice(0, 120),
          author: o.author_name ?? null,
          caption: o.title,
          imageUrl: o.thumbnail_url ?? null,
        };
      }
    } catch {
      // oEmbed is rate-limited and geo-flaky; fall through to page metadata
    }
  }

  const html = await fetchText(url);
  const meta = ogMeta(html);

  if (kind === "instagram" && !meta.caption) {
    // Instagram sometimes only exposes the caption inside the embedded JSON payload.
    const m = /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"(.*?)"\}\}\]/s.exec(html);
    if (m?.[1]) {
      try {
        meta.caption = JSON.parse(`"${m[1]}"`) as string;
      } catch {
        /* leave caption null */
      }
    }
  }
  return meta;
}
