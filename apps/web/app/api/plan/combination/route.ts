import { parseReviewedTemplatePlan } from "@seconds/core";
import { planReviewedTemplate } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 2048);
    let input;
    try { input = parseReviewedTemplatePlan(body); }
    catch { throw new BadRequestError("Review a saved combination's dishes, valid date and breakfast, lunch or dinner."); }
    const confirmed = await planReviewedTemplate(database, userId, input);
    if (!confirmed) throw new BadRequestError("That combination is unavailable or its dishes changed. Nothing was added by this request. Reload saved meals and review again; an earlier request may still have completed.");
    return { confirmed };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
