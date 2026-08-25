import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import {
  addToCart,
  bestProductMatch,
  exchangeCode,
  findStores,
  krogerAuthorizeUrl,
  krogerCredentials,
  needsRefresh,
  productToken,
  searchProducts,
  sendListToKroger,
  toCartItems,
  type KrogerConnection,
  type KrogerProduct,
} from "../src/carts-kroger.js";
import type { ShoppingLine } from "../src/shopping.js";

const credentials = {
  clientId: "nomnom-test",
  clientSecret: "shhh",
  redirectUri: "https://nomnom.test/api/grocery/kroger/callback",
  apiBase: "https://api.kroger.com/v1",
};

const product = (description: string, upc = description): KrogerProduct => ({
  productId: upc,
  upc,
  description,
  size: null,
  brand: null,
});

const line = (canonicalItem: string, displayName = canonicalItem): ShoppingLine => ({
  canonicalItem,
  displayName,
  quantity: null,
  unit: null,
  recipeIds: [],
  amountUnknown: true,
  mayAlreadyHave: false,
  checked: false,
});

describe("credentials", () => {
  it("needs all three or none", () => {
    assert.equal(
      krogerCredentials({
        KROGER_CLIENT_ID: "a",
        KROGER_CLIENT_SECRET: "b",
        KROGER_REDIRECT_URI: "c",
      })?.clientId,
      "a",
    );
    // Only ever anything but Kroger when pointed at the local stand-in.
    assert.equal(
      krogerCredentials({
        KROGER_CLIENT_ID: "a",
        KROGER_CLIENT_SECRET: "b",
        KROGER_REDIRECT_URI: "c",
      })?.apiBase,
      "https://api.kroger.com/v1",
    );
    assert.equal(
      krogerCredentials({
        KROGER_CLIENT_ID: "a",
        KROGER_CLIENT_SECRET: "b",
        KROGER_REDIRECT_URI: "c",
        KROGER_API_BASE: "http://127.0.0.1:4600/v1",
      })?.apiBase,
      "http://127.0.0.1:4600/v1",
    );
    assert.equal(krogerCredentials({ KROGER_CLIENT_ID: "a", KROGER_CLIENT_SECRET: "b" }), null);
    assert.equal(krogerCredentials({}), null);
  });

  it("asks only for the cart scope, and carries the state through", () => {
    const url = new URL(krogerAuthorizeUrl(credentials, "abc123"));
    assert.equal(url.origin + url.pathname, "https://api.kroger.com/v1/connect/oauth2/authorize");
    assert.equal(url.searchParams.get("scope"), "cart.basic:write");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("state"), "abc123");
    assert.equal(url.searchParams.get("redirect_uri"), credentials.redirectUri);
  });
});

describe("needsRefresh", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");

  it("leaves a token with time on it alone", () => {
    assert.equal(needsRefresh("2026-08-25T12:30:00.000Z", now), false);
  });

  it("replaces one that's expired", () => {
    assert.equal(needsRefresh("2026-08-25T11:59:00.000Z", now), true);
  });

  it("replaces one about to expire, rather than racing it", () => {
    assert.equal(needsRefresh("2026-08-25T12:00:30.000Z", now), true);
  });

  it("treats nonsense as expired", () => {
    assert.equal(needsRefresh("not a date", now), true);
  });
});

describe("bestProductMatch", () => {
  it("prefers the plainest description that still contains the item", () => {
    const match = bestProductMatch(line("milk"), [
      product("Horizon Organic Whole Milk DHA Omega-3"),
      product("Kroger Milk"),
    ]);
    assert.equal(match?.description, "Kroger Milk");
  });

  it("refuses anything that doesn't actually contain the item", () => {
    // The failure that matters. Kroger's search is fuzzy and will happily
    // return these; putting one in someone's shopping is worse than a gap.
    assert.equal(bestProductMatch(line("milk"), [product("Almond Breeze Almondmilk")]), null);
    assert.equal(bestProductMatch(line("flour"), [product("Bob's Red Mill Oat Flours")]), null);
    assert.equal(bestProductMatch(line("bacon"), [product("Buttermilk Pancake Mix")]), null);
  });

  it("matches whole words, not fragments", () => {
    assert.equal(bestProductMatch(line("milk"), [product("Kroger Buttermilk")]), null);
  });

  it("keeps a multi-word name together", () => {
    assert.equal(
      bestProductMatch(line("olive oil"), [
        product("Kroger Vegetable Oil"),
        product("Filippo Berio Olive Oil"),
      ])?.description,
      "Filippo Berio Olive Oil",
    );
    // "olive" and "oil" both present, but not as the thing being sold.
    assert.equal(
      bestProductMatch(line("olive oil"), [product("Oil Cured Olive Tapenade")]),
      null,
    );
  });

  it("ignores punctuation and case in either", () => {
    assert.equal(
      bestProductMatch(line("half and half"), [product("Kroger Half & Half")])?.upc,
      "Kroger Half & Half",
    );
  });

  it("keeps Kroger's own order when descriptions are equally plain", () => {
    assert.equal(
      bestProductMatch(line("butter"), [product("Kroger Butter"), product("Land Butter")])
        ?.description,
      "Kroger Butter",
    );
  });

  it("falls back to the display name when there's no canonical one", () => {
    assert.equal(
      bestProductMatch({ canonicalItem: "", displayName: "sourdough" }, [
        product("Kroger Sourdough Bread"),
      ])?.description,
      "Kroger Sourdough Bread",
    );
  });

  it("has nothing to match against an empty name or an empty search", () => {
    assert.equal(bestProductMatch(line(""), [product("Kroger Milk")]), null);
    assert.equal(bestProductMatch(line("milk"), []), null);
  });
});

describe("toCartItems", () => {
  it("asks for one of whatever the store sells", () => {
    // Two tablespoons of oil is still one bottle; there's no conversion to make.
    assert.deepEqual(toCartItems([{ product: product("Kroger Olive Oil", "001") }]), [
      { upc: "001", quantity: 1, modality: "PICKUP" },
    ]);
  });

  it("collapses two lines that resolved to the same product", () => {
    assert.deepEqual(
      toCartItems([
        { product: product("Kroger Milk", "002") },
        { product: product("Kroger Milk", "002") },
      ]),
      [{ upc: "002", quantity: 2, modality: "PICKUP" }],
    );
  });

  it("can be asked for delivery instead", () => {
    assert.equal(toCartItems([{ product: product("x", "003") }], "DELIVERY")[0]?.modality, "DELIVERY");
  });
});

// --- against a stand-in for the API ----------------------------------------

let server: Server;
let baseUrl: string;
const requests: { method: string; path: string; auth: string; body: string }[] = [];
let catalogue: Record<string, KrogerProduct[]> = {};
let cartStatus = 204;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      requests.push({
        method: req.method ?? "GET",
        path: url.pathname,
        auth: req.headers.authorization ?? "",
        body: raw,
      });

      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      if (url.pathname.endsWith("/connect/oauth2/token")) {
        return json(200, {
          access_token: `token-for-${new URLSearchParams(raw).get("grant_type")}`,
          refresh_token: "refresh-me",
          expires_in: 1800,
        });
      }

      if (url.pathname.endsWith("/locations")) {
        return json(200, {
          data: [
            {
              locationId: "70100123",
              name: "Fred Meyer Interstate",
              chain: "FREDMEYER",
              address: { addressLine1: "3030 NE Weidler St", city: "Portland", state: "OR" },
            },
            { name: "A store with no id" },
          ],
        });
      }

      if (url.pathname.endsWith("/products")) {
        const term = url.searchParams.get("filter.term") ?? "";
        return json(200, {
          data: (catalogue[term] ?? []).map((p) => ({
            productId: p.productId,
            upc: p.upc,
            description: p.description,
            items: [{ size: p.size ?? "each" }],
          })),
        });
      }

      if (url.pathname.endsWith("/cart/add")) {
        res.writeHead(cartStatus);
        return res.end(cartStatus === 204 ? "" : "no");
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/v1`;
});

after(() => server.close());

describe("talking to the API", () => {
  it("asks for a client_credentials token with basic auth", async () => {
    requests.length = 0;
    const token = await productToken(credentials, { baseUrl });

    assert.equal(token.accessToken, "token-for-client_credentials");
    assert.equal(token.refreshToken, "refresh-me");
    assert.equal(Date.parse(token.expiresAt) > Date.now(), true);

    const sent = requests[0]!;
    assert.equal(sent.method, "POST");
    assert.equal(sent.auth, `Basic ${Buffer.from("nomnom-test:shhh").toString("base64")}`);
    assert.equal(new URLSearchParams(sent.body).get("scope"), "product.compact");
  });

  it("trades a code for the shopper's own token, quoting the same redirect back", async () => {
    requests.length = 0;
    const token = await exchangeCode(credentials, "the-code", { baseUrl });

    assert.equal(token.accessToken, "token-for-authorization_code");
    const body = new URLSearchParams(requests[0]!.body);
    assert.equal(body.get("code"), "the-code");
    assert.equal(body.get("redirect_uri"), credentials.redirectUri);
  });

  it("reads stores, and drops any without an id", async () => {
    const stores = await findStores("t", "97212", { baseUrl });
    assert.equal(stores.length, 1);
    assert.deepEqual(stores[0], {
      locationId: "70100123",
      name: "Fred Meyer Interstate",
      chain: "FREDMEYER",
      address: "3030 NE Weidler St, Portland, OR",
    });
  });

  it("searches products at a specific store", async () => {
    catalogue = { butter: [product("Kroger Unsalted Butter", "111")] };
    requests.length = 0;

    const found = await searchProducts("t", "butter", "70100123", { baseUrl });
    assert.equal(found[0]?.upc, "111");
    assert.equal(found[0]?.size, "each");
    assert.equal(requests[0]!.auth, "Bearer t");
  });

  it("says so when the cart is rejected", async () => {
    cartStatus = 400;
    await assert.rejects(
      () => addToCart("t", [{ upc: "1", quantity: 1, modality: "PICKUP" }], { baseUrl }),
      /rejected the cart \(400\)/,
    );
    cartStatus = 204;
  });

  it("refuses to send an empty cart rather than calling with nothing", async () => {
    await assert.rejects(() => addToCart("t", [], { baseUrl }), /nothing to add/i);
  });
});

describe("sending a whole list", () => {
  const connection: KrogerConnection = {
    accessToken: "shopper-token",
    refreshToken: null,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    locationId: "70100123",
    locationName: "Fred Meyer Interstate",
  };

  it("adds what it matched and names what it didn't", async () => {
    catalogue = {
      butter: [product("Kroger Unsalted Butter", "111")],
      milk: [product("Kroger Milk", "222")],
      // Kroger has nothing under this name, which is the normal case for
      // anything a recipe describes rather than names.
      "harissa paste": [],
    };
    requests.length = 0;

    const handoff = await sendListToKroger(
      [line("butter"), line("milk"), line("harissa paste", "harissa paste"), { ...line("salt"), checked: true }],
      connection,
      { baseUrl, productAccessToken: "product-token" },
    );

    assert.equal(handoff.provider, "kroger");
    assert.equal(handoff.kind, "api");
    assert.deepEqual(handoff.unmatched, ["harissa paste"]);
    assert.match(handoff.note, /Added 2 items/);
    assert.match(handoff.note, /1 couldn't be matched/);

    // The ticked-off line is never searched for.
    assert.equal(requests.filter((r) => r.path.endsWith("/products")).length, 3);

    const add = requests.find((r) => r.path.endsWith("/cart/add"))!;
    assert.equal(add.auth, "Bearer shopper-token");
    assert.deepEqual(JSON.parse(add.body), {
      items: [
        { upc: "111", quantity: 1, modality: "PICKUP" },
        { upc: "222", quantity: 1, modality: "PICKUP" },
      ],
    });
  });

  it("says which store when nothing matches, instead of an empty cart", async () => {
    catalogue = { butter: [] };
    await assert.rejects(
      () =>
        sendListToKroger([line("butter")], connection, {
          baseUrl,
          productAccessToken: "product-token",
        }),
      /Fred Meyer Interstate/,
    );
  });

  it("insists on a store first", async () => {
    await assert.rejects(
      () =>
        sendListToKroger([line("butter")], { ...connection, locationId: null }, {
          baseUrl,
          productAccessToken: "p",
        }),
      /Pick a Kroger store first/,
    );
  });

  it("has nothing to do with an empty list", async () => {
    await assert.rejects(
      () =>
        sendListToKroger([{ ...line("salt"), checked: true }], connection, {
          baseUrl,
          productAccessToken: "p",
        }),
      /nothing on the list/i,
    );
  });
});
