import type { ShoppingLine } from "./shopping.js";
import { formatListAsText } from "./shopping.js";

/**
 * Handing a shopping list to somewhere you can actually buy the food.
 *
 * The honest state of the world, as of writing:
 *
 * - **Instacart** has a public Developer Platform API that takes a list of
 *   items and returns a link to a populated cart page. Real integration.
 * - **Kroger** (which owns Fred Meyer, King Soopers, Ralphs, and others) has a
 *   public Cart API, but it needs per-user OAuth *and* resolved product UPCs,
 *   so items have to be searched before they can be added.
 * - **DoorDash, Uber Eats, Safeway/Albertsons** have no public consumer cart
 *   API. Anything claiming otherwise is scraping a private endpoint.
 *
 * So providers come in two kinds, and the type says which: `api` builds a real
 * cart, `handoff` gets the list in front of you as cleanly as it can — a search
 * deep link plus the list on the clipboard. Both are recorded identically in
 * `cart_handoffs` so the history reads the same.
 */

export const CART_PROVIDERS = [
  "instacart",
  "kroger",
  "doordash",
  "ubereats",
  "safeway",
  "clipboard",
] as const;

export type CartProviderId = (typeof CART_PROVIDERS)[number];

export type CartProviderKind = "api" | "handoff";

export interface CartProvider {
  id: CartProviderId;
  name: string;
  kind: CartProviderKind;
  /** Plain-language statement of what pressing this actually does. */
  description: string;
  /** Set when `kind` is "api" and the key it needs isn't configured. */
  requiresEnv?: string;
}

export const CART_PROVIDERS_BY_ID: Record<CartProviderId, CartProvider> = {
  instacart: {
    id: "instacart",
    name: "Instacart",
    kind: "api",
    description: "Builds a real Instacart cart from your list.",
    requiresEnv: "INSTACART_API_KEY",
  },
  kroger: {
    id: "kroger",
    name: "Kroger / Fred Meyer",
    kind: "api",
    description: "Adds items to your Kroger cart. Needs you to connect a Kroger account.",
    requiresEnv: "KROGER_CLIENT_ID",
  },
  doordash: {
    id: "doordash",
    name: "DoorDash",
    kind: "handoff",
    description: "No public cart API. Opens DoorDash grocery with your list copied.",
  },
  ubereats: {
    id: "ubereats",
    name: "Uber Eats",
    kind: "handoff",
    description: "No public cart API. Opens Uber Eats grocery with your list copied.",
  },
  safeway: {
    id: "safeway",
    name: "Safeway",
    kind: "handoff",
    description: "No public cart API. Opens Safeway with your list copied.",
  },
  clipboard: {
    id: "clipboard",
    name: "Copy the list",
    kind: "handoff",
    description: "Puts the list on your clipboard for wherever you shop.",
  },
};

/** Where a handoff provider should send you. */
const HANDOFF_URLS: Record<string, (query: string) => string> = {
  doordash: () => "https://www.doordash.com/convenience/",
  ubereats: () => "https://www.ubereats.com/category/grocery",
  safeway: (q) => `https://www.safeway.com/shop/search-results.html?q=${encodeURIComponent(q)}`,
  clipboard: () => "",
};

export interface CartHandoff {
  provider: CartProviderId;
  kind: CartProviderKind;
  /** Where to send the shopper. Empty for clipboard-only. */
  url: string;
  /** The list as text, for the clipboard. Always populated. */
  text: string;
  /** Items the provider couldn't match. Empty for handoff providers. */
  unmatched: string[];
  /** What actually happened, in words the UI can show without interpreting. */
  note: string;
}

/**
 * Build a handoff for a provider with no cart API.
 *
 * This is deliberately not dressed up as an integration: it opens the store's
 * own search or grocery page and puts the list on the clipboard, which is the
 * most that can honestly be done without a partnership.
 */
export function buildHandoff(provider: CartProviderId, lines: ShoppingLine[]): CartHandoff {
  const text = formatListAsText(lines);
  const first = lines.find((l) => !l.checked)?.displayName ?? "";
  const builder = HANDOFF_URLS[provider];

  return {
    provider,
    kind: "handoff",
    url: builder ? builder(first) : "",
    text,
    unmatched: [],
    note:
      provider === "clipboard"
        ? "List copied."
        : `${CART_PROVIDERS_BY_ID[provider].name} has no public cart API, so your list is copied and their store is open in a new tab.`,
  };
}

/** The shape Instacart's Developer Platform expects for each line item. */
export interface InstacartLineItem {
  name: string;
  quantity?: number;
  unit?: string;
}

export function toInstacartItems(lines: ShoppingLine[]): InstacartLineItem[] {
  return lines
    .filter((l) => !l.checked)
    .map((l) => ({
      name: l.displayName,
      ...(l.quantity !== null ? { quantity: l.quantity } : {}),
      ...(l.unit ? { unit: l.unit } : {}),
    }));
}

/** Which providers are usable right now, given what's configured. */
export function availableProviders(env: Record<string, string | undefined>): CartProvider[] {
  return CART_PROVIDERS.map((id) => CART_PROVIDERS_BY_ID[id]).filter(
    (p) => !p.requiresEnv || Boolean(env[p.requiresEnv]),
  );
}
