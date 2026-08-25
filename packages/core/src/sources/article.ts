import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";

const NOISE = [
  "script", "style", "noscript", "nav", "header", "footer", "aside", "form",
  "iframe", "svg", "button", "figure figcaption", ".comments", "#comments",
  ".related", ".sidebar", ".advertisement", ".ad", "[aria-hidden='true']",
];

const CONTENT_SELECTORS = [
  "article", "main", '[itemprop="articleBody"]', ".post-content",
  ".entry-content", ".article-body", "#content", ".content",
];

export interface ArticleText {
  title: string | null;
  siteName: string | null;
  author: string | null;
  imageUrl: string | null;
  text: string;
}

/**
 * Reduce a food-blog page to the prose the extractor actually needs.
 * These pages are famously mostly life story and only partly recipe — we keep
 * both, because the recipe is often stated only inside the narrative, and let
 * the model do the separating.
 */
export function extractArticleText(html: string, maxChars = 60_000): ArticleText {
  const $ = cheerio.load(html);

  const meta = (...names: string[]): string | null => {
    for (const n of names) {
      const v =
        $(`meta[property="${n}"]`).attr("content") ??
        $(`meta[name="${n}"]`).attr("content");
      if (v?.trim()) return v.trim();
    }
    return null;
  };

  const title =
    meta("og:title", "twitter:title") ??
    ($("h1").first().text().trim() || $("title").text().trim() || null);
  const siteName = meta("og:site_name");
  const author = meta("author", "article:author");
  const imageUrl = meta("og:image", "twitter:image");

  $(NOISE.join(",")).remove();

  // Prefer the page's main content container, but only when it actually holds
  // the body text — plenty of sites ship an empty <main> and put the post elsewhere.
  let root: cheerio.Cheerio<AnyNode> = $("body");
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 400) {
      root = el;
      break;
    }
  }

  // Force line breaks where the markup implies them; ingredient lists live in <li>.
  root.find("li").each((_, el) => {
    $(el).prepend("\n- ");
  });
  root.find("p, h1, h2, h3, h4, br, tr").each((_, el) => {
    $(el).prepend("\n");
  });

  const text = root
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .slice(0, maxChars);

  return { title, siteName, author, imageUrl, text };
}
