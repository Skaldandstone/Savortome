import type { CartHandoff } from "./carts.js";
import type { ShoppingLine } from "./shopping.js";
import { formatListAsText } from "./shopping.js";

/**
 * Instacart's Developer Platform, the one grocery service here with a real
 * public cart API.
 *
 * `POST /idp/v1/products/products_link` takes a list of items and returns a
 * link to a shopping list page on Instacart Marketplace, where the shopper
 * picks a store and checks out. Their docs note that `quantity`/`unit` on a
 * line item are deprecated in favour of `line_item_measurements`, so that's
 * what this sends.
 *
 * Docs: https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page
 *
 * NOTE: written against the documented schema but never run against the live
 * API — that needs an Instacart partner key this project doesn't have.
 */

const ENDPOINT = "https://connect.instacart.com/idp/v1/products/products_link";

/** Days the generated link stays valid. Their maximum is 365. */
const EXPIRES_IN_DAYS = 30;

interface LineItemMeasurement {
  quantity: number;
  unit: string;
}

interface InstacartLineItem {
  name: string;
  display_text?: string;
  line_item_measurements?: LineItemMeasurement[];
}

interface ProductsLinkResponse {
  products_link_url?: string;
}

export class InstacartError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "InstacartError";
  }
}

export function toInstacartLineItems(lines: ShoppingLine[]): InstacartLineItem[] {
  return lines
    .filter((l) => !l.checked)
    .map((line) => ({
      name: line.canonicalItem || line.displayName,
      // The canonical name matches their catalogue better; the display name is
      // what the shopper recognises on the page.
      display_text: line.displayName,
      ...(line.quantity !== null
        ? {
            line_item_measurements: [
              { quantity: line.quantity, unit: line.unit ?? "each" },
            ],
          }
        : {}),
    }));
}

export interface InstacartOptions {
  apiKey?: string;
  title?: string;
  /** Shown above the list on the Instacart page. */
  instructions?: string[];
  signal?: AbortSignal;
}

/**
 * Create a populated Instacart shopping list page.
 *
 * Their guidance is to cache the returned URL and only regenerate it when the
 * list actually changes, which is why the caller stores it in `cart_handoffs`
 * rather than calling this on every render.
 */
export async function createInstacartList(
  lines: ShoppingLine[],
  options: InstacartOptions = {},
): Promise<CartHandoff> {
  const apiKey = options.apiKey ?? process.env.INSTACART_API_KEY;
  if (!apiKey) {
    throw new InstacartError("INSTACART_API_KEY is not set.");
  }

  const lineItems = toInstacartLineItems(lines);
  if (lineItems.length === 0) {
    throw new InstacartError("There's nothing on the list to send.");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      title: options.title ?? "NomNom shopping list",
      link_type: "shopping_list",
      expires_in: EXPIRES_IN_DAYS,
      ...(options.instructions?.length ? { instructions: options.instructions } : {}),
      line_items: lineItems,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new InstacartError(`Instacart rejected the list (${res.status}): ${detail}`, res.status);
  }

  const payload = (await res.json()) as ProductsLinkResponse;
  if (!payload.products_link_url) {
    throw new InstacartError("Instacart returned no link.");
  }

  return {
    provider: "instacart",
    kind: "api",
    url: payload.products_link_url,
    text: formatListAsText(lines),
    // Instacart matches items on their side, so nothing is reported unmatched
    // here — the shopper sees any gaps on the page itself.
    unmatched: [],
    note: "Opened an Instacart list. Pick a store there and it fills your cart.",
  };
}
