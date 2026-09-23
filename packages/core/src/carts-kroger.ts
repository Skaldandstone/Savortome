import type { CartHandoff } from "./carts.js";
import type { ShoppingLine } from "./shopping.js";
import { formatListAsText } from "./shopping.js";

/**
 * Kroger's public API — which is also Fred Meyer, King Soopers, Ralphs, QFC,
 * Smith's, and the rest of the family.
 *
 * This is a genuinely different shape from Instacart. Instacart takes a list of
 * names and does its own matching; Kroger takes UPCs, which means every line
 * has to be searched against a *specific store's* catalogue before it can go in
 * a cart. So the flow is:
 *
 *   1. client_credentials token  -> product search (no customer involved)
 *   2. the shopper picks a store -> because price and stock are per location
 *   3. authorization_code token  -> the shopper's own cart
 *   4. PUT /v1/cart/add          -> UPCs and quantities
 *
 * Anything that can't be matched to a UPC is reported rather than guessed at.
 * A wrong item quietly added to someone's shopping is worse than a line they
 * have to add themselves.
 *
 * Docs: https://developer.kroger.com/api-products/api/product-api-public
 *
 * NOTE: written against the documented schemas and exercised against a local
 * stand-in, but never run against the live API — that needs Kroger developer
 * credentials this project doesn't have.
 */

const API = "https://api.kroger.com/v1";

/** Scope for searching the catalogue. No customer is involved. */
const PRODUCT_SCOPE = "product.compact";
/** Scope for writing to a customer's own cart. */
const CART_SCOPE = "cart.basic:write";

/** Refresh this long before expiry, so a slow request can't land on a dead token. */
const EXPIRY_MARGIN_SECONDS = 60;

export class KrogerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KrogerError";
  }
}

export interface KrogerCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /**
   * Where the API lives. Only ever anything but Kroger when pointed at the
   * local stand-in — see `scripts/kroger-stub.mjs`, which is the only way to
   * exercise this flow without Kroger developer credentials.
   */
  apiBase: string;
}

/** Everything stored about a shopper's connection to Kroger. */
export interface KrogerConnection {
  accessToken: string;
  refreshToken: string | null;
  /** ISO timestamp. */
  expiresAt: string;
  locationId: string | null;
  locationName: string | null;
}

export interface KrogerToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export interface KrogerStore {
  locationId: string;
  name: string;
  chain: string;
  address: string;
}

export interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  /** "1 gal", "16 oz" — Kroger's own wording for the pack size. */
  size: string | null;
  brand: string | null;
}

export type Modality = "PICKUP" | "DELIVERY";

// ---------------------------------------------------------------- credentials

export function krogerCredentials(
  env: Record<string, string | undefined> = process.env,
): KrogerCredentials | null {
  const clientId = env.KROGER_CLIENT_ID;
  const clientSecret = env.KROGER_CLIENT_SECRET;
  const redirectUri = env.KROGER_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, apiBase: env.KROGER_API_BASE || API };
}

/**
 * Where to send the shopper to authorise us against their Kroger account.
 *
 * `state` is theirs to generate and check on the way back — without it, anyone
 * can hand a victim a callback URL carrying their own authorisation code and
 * quietly attach their Kroger account to the victim's session.
 */
export function krogerAuthorizeUrl(credentials: KrogerCredentials, state: string): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope: CART_SCOPE,
    state,
  });
  return `${credentials.apiBase}/connect/oauth2/authorize?${params.toString()}`;
}

const basicAuth = (c: KrogerCredentials): string =>
  `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

async function requestToken(
  credentials: KrogerCredentials,
  body: URLSearchParams,
  baseUrl: string,
): Promise<KrogerToken> {
  const res = await fetch(`${baseUrl}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: basicAuth(credentials),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new KrogerError(`Kroger refused the token request (${res.status}): ${detail}`, res.status);
  }

  const payload = (await res.json()) as TokenResponse;
  if (!payload.access_token) throw new KrogerError("Kroger returned no access token.");

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 1800) * 1000).toISOString(),
  };
}

export interface KrogerOptions {
  /** Overridable so the whole client can be pointed at a local stand-in. */
  baseUrl?: string;
}

/** A token for searching the catalogue. Nothing customer-specific. */
export function productToken(
  credentials: KrogerCredentials,
  options: KrogerOptions = {},
): Promise<KrogerToken> {
  return requestToken(
    credentials,
    new URLSearchParams({ grant_type: "client_credentials", scope: PRODUCT_SCOPE }),
    options.baseUrl ?? credentials.apiBase,
  );
}

/** Trade the code from the callback for the shopper's own token. */
export function exchangeCode(
  credentials: KrogerCredentials,
  code: string,
  options: KrogerOptions = {},
): Promise<KrogerToken> {
  return requestToken(
    credentials,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: credentials.redirectUri,
    }),
    options.baseUrl ?? credentials.apiBase,
  );
}

export function refreshToken(
  credentials: KrogerCredentials,
  token: string,
  options: KrogerOptions = {},
): Promise<KrogerToken> {
  return requestToken(
    credentials,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: token }),
    options.baseUrl ?? credentials.apiBase,
  );
}

/** True when a stored token is close enough to expiry to be worth replacing. */
export function needsRefresh(expiresAt: string, now: number = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true;
  return expiry - now <= EXPIRY_MARGIN_SECONDS * 1000;
}

// ---------------------------------------------------------------- stores

interface LocationResponse {
  data?: {
    locationId?: string;
    name?: string;
    chain?: string;
    address?: { addressLine1?: string; city?: string; state?: string; zipCode?: string };
  }[];
}

/**
 * Stores near a postcode.
 *
 * A location has to be chosen before anything else happens: Kroger prices,
 * stocks, and even *carries* different things per store, so searching without
 * one answers a question nobody asked.
 */
export async function findStores(
  accessToken: string,
  zipCode: string,
  options: KrogerOptions & { limit?: number } = {},
): Promise<KrogerStore[]> {
  const params = new URLSearchParams({
    "filter.zipCode.near": zipCode,
    "filter.limit": String(options.limit ?? 10),
  });

  const res = await fetch(`${options.baseUrl ?? API}/locations?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });

  if (!res.ok) {
    throw new KrogerError(`Kroger couldn't look up stores (${res.status}).`, res.status);
  }

  const payload = (await res.json()) as LocationResponse;
  return (payload.data ?? [])
    .filter((l) => l.locationId)
    .map((l) => ({
      locationId: l.locationId as string,
      name: l.name ?? "Kroger store",
      chain: l.chain ?? "KROGER",
      address: [l.address?.addressLine1, l.address?.city, l.address?.state]
        .filter(Boolean)
        .join(", "),
    }));
}

// ---------------------------------------------------------------- products

interface ProductResponse {
  data?: {
    productId?: string;
    upc?: string;
    description?: string;
    brand?: string;
    items?: { size?: string }[];
  }[];
}

export async function searchProducts(
  accessToken: string,
  term: string,
  locationId: string,
  options: KrogerOptions & { limit?: number } = {},
): Promise<KrogerProduct[]> {
  const params = new URLSearchParams({
    "filter.term": term,
    "filter.locationId": locationId,
    "filter.limit": String(options.limit ?? 10),
  });

  const res = await fetch(`${options.baseUrl ?? API}/products?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });

  if (!res.ok) {
    throw new KrogerError(`Kroger product search failed (${res.status}).`, res.status);
  }

  const payload = (await res.json()) as ProductResponse;
  return (payload.data ?? [])
    .filter((p) => p.upc && p.description)
    .map((p) => ({
      productId: p.productId ?? (p.upc as string),
      upc: p.upc as string,
      description: p.description as string,
      size: p.items?.[0]?.size ?? null,
      brand: p.brand ?? null,
    }));
}

/**
 * Pick the product a shopping line means, or nothing.
 *
 * The rule that matters is the negative one: the item's name has to appear in
 * the product's description as a whole phrase. Kroger's search is fuzzy and
 * happily returns almond milk for "milk", oat flour for "flour", and turkey
 * bacon for "bacon" — and a wrong item that ends up in someone's actual
 * shopping is far worse than a line they have to add themselves.
 *
 * Past that guard, Kroger's own ranking is trusted, with a nudge towards the
 * plainest description: "Kroger Milk" over "Horizon Organic Whole Milk DHA
 * Omega-3" when the line just said milk.
 */
export function bestProductMatch(
  line: Pick<ShoppingLine, "canonicalItem" | "displayName">,
  products: KrogerProduct[],
): KrogerProduct | null {
  const wanted = normalize(line.canonicalItem || line.displayName);
  if (!wanted) return null;

  let best: KrogerProduct | null = null;
  let fewestExtra = Number.POSITIVE_INFINITY;

  for (const product of products) {
    const description = normalize(product.description);
    if (!containsPhrase(description, wanted)) continue;

    // Earlier results win ties, which is Kroger's own ranking left intact.
    const extra = description.split(" ").length - wanted.split(" ").length;
    if (extra < fewestExtra) {
      fewestExtra = extra;
      best = product;
    }
  }

  return best;
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    // Product descriptions write it "Half & Half"; a shopping list writes it
    // out. Dropping the ampersand instead of reading it loses the match.
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Whole-phrase, whole-word containment. "milk" must not match "buttermilk". */
function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

// ---------------------------------------------------------------- the cart

export interface KrogerCartItem {
  upc: string;
  quantity: number;
  modality: Modality;
}

/**
 * Kroger takes whole units, and everything on a Savortome list is either an
 * amount in some cooking unit or nothing at all. Neither converts: two
 * tablespoons of oil is still one bottle. So every matched line is one of
 * whatever the store sells, and the shopper adjusts.
 */
export function toCartItems(
  matches: { product: KrogerProduct }[],
  modality: Modality = "PICKUP",
): KrogerCartItem[] {
  const byUpc = new Map<string, KrogerCartItem>();
  for (const { product } of matches) {
    const existing = byUpc.get(product.upc);
    if (existing) existing.quantity += 1;
    else byUpc.set(product.upc, { upc: product.upc, quantity: 1, modality });
  }
  return [...byUpc.values()];
}

export async function addToCart(
  accessToken: string,
  items: KrogerCartItem[],
  options: KrogerOptions = {},
): Promise<void> {
  if (items.length === 0) throw new KrogerError("Nothing matched, so there's nothing to add.");

  const res = await fetch(`${options.baseUrl ?? API}/cart/add`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  // A successful add returns 204 with no body.
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new KrogerError(`Kroger rejected the cart (${res.status}): ${detail}`, res.status);
  }
}

export interface SendToKrogerOptions extends KrogerOptions {
  modality?: Modality;
  /** For searching the catalogue. Separate from the shopper's own token. */
  productAccessToken: string;
}

/**
 * Search every line, add what matched, and say plainly what didn't.
 *
 * Searches run in sequence rather than all at once: this is a handful of
 * requests against someone else's rate limit, and a shopping list is not
 * latency-critical enough to justify hammering it.
 */
export async function sendListToKroger(
  lines: ShoppingLine[],
  connection: KrogerConnection,
  options: SendToKrogerOptions,
): Promise<CartHandoff> {
  if (!connection.locationId) {
    throw new KrogerError("Pick a Kroger store first — prices and stock are per store.");
  }

  const wanted = lines.filter((l) => !l.checked);
  if (wanted.length === 0) throw new KrogerError("There's nothing on the list to send.");

  const matches: { line: ShoppingLine; product: KrogerProduct }[] = [];
  const unmatched: string[] = [];

  for (const line of wanted) {
    const products = await searchProducts(
      options.productAccessToken,
      line.canonicalItem || line.displayName,
      connection.locationId,
      options,
    );
    const product = bestProductMatch(line, products);
    if (product) matches.push({ line, product });
    else unmatched.push(line.displayName);
  }

  if (matches.length === 0) {
    throw new KrogerError(
      `Nothing on the list could be matched at ${connection.locationName ?? "that store"}.`,
    );
  }

  await addToCart(
    connection.accessToken,
    toCartItems(matches, options.modality ?? "PICKUP"),
    options,
  );

  return {
    provider: "kroger",
    kind: "api",
    // Kroger has no per-cart URL to link to, so this is their cart page.
    url: "https://www.kroger.com/cart",
    text: formatListAsText(lines),
    unmatched,
    note: unmatched.length
      ? `Added ${matches.length} ${matches.length === 1 ? "item" : "items"} to your ${connection.locationName ?? "Kroger"} cart. ${unmatched.length} couldn't be matched — add ${unmatched.length === 1 ? "it" : "them"} yourself.`
      : `Added all ${matches.length} items to your ${connection.locationName ?? "Kroger"} cart.`,
  };
}
