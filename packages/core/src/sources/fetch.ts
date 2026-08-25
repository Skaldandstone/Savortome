import { assertPublicHttpUrl } from "./url-guard.js";

/**
 * Blog platforms and social sites serve very different HTML to obvious bots,
 * so every outbound fetch goes through here with a browser-shaped header set.
 *
 * Redirects are followed by hand rather than by fetch, because each hop has to
 * be re-checked: a public URL is free to redirect to 169.254.169.254, and
 * `redirect: "follow"` would take us there.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MAX_REDIRECTS = 5;

async function guardedFetch(url: string, init: RequestInit, accept: string): Promise<Response> {
  let current = (await assertPublicHttpUrl(url)).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      ...init,
      redirect: "manual",
      headers: {
        "user-agent": UA,
        accept,
        "accept-language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = (await assertPublicHttpUrl(new URL(location, current).toString())).toString();
      continue;
    }

    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${current}`);
    return res;
  }

  throw new Error(`Too many redirects starting at ${url}`);
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await guardedFetch(
    url,
    init,
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  );
  return res.text();
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await guardedFetch(url, init, "application/json");
  return res.json() as Promise<T>;
}
