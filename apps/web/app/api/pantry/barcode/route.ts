import { lookupBarcodeProduct } from "@seconds/core";
import { withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
import { NotConfiguredError } from "@/lib/session";

export const runtime = "nodejs";
const enabled = () => process.env.BARCODE_LOOKUP_ENABLED === "true" && Boolean(process.env.OPEN_FOOD_FACTS_USER_AGENT?.trim());
const privateResponse = (response: Response) => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};
export async function GET() {
  return privateResponse(await withUser(async () => ({ enabled: enabled() })));
}
export async function POST(request: Request) {
  return privateResponse(await withUser(async () => {
    if (!enabled()) throw new NotConfiguredError("Product lookup is not enabled. Enter the product by hand.");
    // Authentication precedes body decoding and outbound lookup.
    const body = await boundedJson(request, 1024);
    return { product: await lookupBarcodeProduct(body.barcode, { userAgent: process.env.OPEN_FOOD_FACTS_USER_AGENT! }) };
  }));
}
