#!/usr/bin/env node
/**
 * A stand-in for Kroger's API, for developing the cart flow without Kroger
 * developer credentials.
 *
 *   node scripts/kroger-stub.mjs
 *
 * Then, in apps/web/.env.local:
 *
 *   KROGER_CLIENT_ID=stub
 *   KROGER_CLIENT_SECRET=stub
 *   KROGER_REDIRECT_URI=http://localhost:3000/api/grocery/kroger/callback
 *   KROGER_API_BASE=http://127.0.0.1:4600/v1
 *
 * It implements the documented shapes of the four endpoints NomNom uses, and
 * nothing else. It is not a simulator: the catalogue is a dozen items, the
 * sign-in page approves instantly, and every token is the string "stub-token".
 * The point is to exercise our own request and response handling — what the
 * real API does with a real account is still untested.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4600);

/** Enough of a catalogue to hit both the match and the no-match path. */
const CATALOGUE = [
  { upc: "0001111041700", description: "Kroger Whole Milk", size: "1 gal" },
  { upc: "0001111041800", description: "Kroger 2% Reduced Fat Milk", size: "1 gal" },
  { upc: "0004128500222", description: "Almond Breeze Almondmilk Original", size: "64 fl oz" },
  { upc: "0001111060903", description: "Kroger Unsalted Butter", size: "16 oz" },
  { upc: "0001111087314", description: "Kroger Large Grade A Eggs", size: "12 ct" },
  { upc: "0001111085555", description: "Kroger All Purpose Flour", size: "5 lb" },
  { upc: "0007373100017", description: "Filippo Berio Extra Virgin Olive Oil", size: "17 fl oz" },
  { upc: "0001111097531", description: "Kroger Granulated Sugar", size: "4 lb" },
  { upc: "0001111003344", description: "Kroger Yellow Onions", size: "3 lb" },
  { upc: "0001111005566", description: "Kroger Garlic", size: "3 ct" },
  { upc: "0001111009911", description: "Simple Truth Organic Yellow Cornmeal", size: "24 oz" },
  { upc: "0001111022334", description: "Kroger Iodized Salt", size: "26 oz" },
];

const STORES = [
  {
    locationId: "70100123",
    name: "Fred Meyer Interstate",
    chain: "FREDMEYER",
    address: { addressLine1: "3030 NE Weidler St", city: "Portland", state: "OR", zipCode: "97232" },
  },
  {
    locationId: "70100456",
    name: "Fred Meyer Hollywood West",
    chain: "FREDMEYER",
    address: { addressLine1: "3030 NE Weidler St", city: "Portland", state: "OR", zipCode: "97232" },
  },
  {
    locationId: "62000789",
    name: "QFC Hollywood",
    chain: "QFC",
    address: { addressLine1: "4100 NE Halsey St", city: "Portland", state: "OR", zipCode: "97213" },
  },
];

/** Every item added across the session, so you can see what actually landed. */
const cart = [];

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const path = url.pathname.replace(/^\/v1/, "");

    const json = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      console.log(`${req.method} ${url.pathname} -> ${status}`);
    };

    // --- OAuth -------------------------------------------------------------

    if (path === "/connect/oauth2/authorize") {
      // The real thing is a Kroger sign-in page. This approves immediately and
      // bounces straight back, carrying the state as Kroger would.
      const redirect = new URL(url.searchParams.get("redirect_uri") ?? "http://localhost:3000/");
      redirect.searchParams.set("code", "stub-code");
      redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { location: redirect.toString() });
      console.log(`GET ${url.pathname} -> 302 ${redirect}`);
      return res.end();
    }

    if (path === "/connect/oauth2/token") {
      if (!req.headers.authorization?.startsWith("Basic ")) {
        return json(401, { error: "missing basic auth" });
      }
      const grant = new URLSearchParams(raw).get("grant_type");
      return json(200, {
        access_token: `stub-${grant}-token`,
        refresh_token: "stub-refresh-token",
        expires_in: 1800,
        token_type: "bearer",
      });
    }

    // --- reads -------------------------------------------------------------

    if (path === "/locations") {
      const zip = url.searchParams.get("filter.zipCode.near") ?? "";
      // Any ZIP starting 97 is "near"; anything else finds nothing, so the
      // empty case is reachable.
      return json(200, { data: zip.startsWith("97") ? STORES : [] });
    }

    if (path === "/products") {
      const term = (url.searchParams.get("filter.term") ?? "").toLowerCase();
      const limit = Number(url.searchParams.get("filter.limit") ?? 10);
      if (!url.searchParams.get("filter.locationId")) {
        return json(400, { errors: [{ reason: "filter.locationId is required" }] });
      }

      // Deliberately loose, like the real search: a term matches if any of its
      // words appears anywhere, which is exactly why our matcher has to be
      // stricter than "Kroger returned it".
      const words = term.split(/\s+/).filter(Boolean);
      const data = CATALOGUE.filter((p) =>
        words.some((w) => p.description.toLowerCase().includes(w)),
      )
        .slice(0, limit)
        .map((p) => ({
          productId: p.upc,
          upc: p.upc,
          description: p.description,
          items: [{ size: p.size, price: { regular: 3.49 } }],
        }));

      return json(200, { data });
    }

    // --- the cart ----------------------------------------------------------

    if (path === "/cart/add" && req.method === "PUT") {
      if (!req.headers.authorization?.startsWith("Bearer ")) {
        return json(401, { error: "missing bearer token" });
      }
      const items = JSON.parse(raw || "{}").items ?? [];
      cart.push(...items);
      console.log(`PUT ${url.pathname} -> 204, cart now:`);
      for (const item of cart) {
        const product = CATALOGUE.find((p) => p.upc === item.upc);
        console.log(`   ${item.quantity} x ${product?.description ?? item.upc} (${item.modality})`);
      }
      res.writeHead(204);
      return res.end();
    }

    json(404, { error: `no stub for ${req.method} ${url.pathname}` });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Kroger stand-in on http://127.0.0.1:${PORT}/v1`);
  console.log("Set KROGER_API_BASE to that, with any client id and secret.");
});
