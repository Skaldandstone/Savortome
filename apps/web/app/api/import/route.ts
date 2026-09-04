import { NextResponse } from "next/server";
import {
  detectSourceKind,
  ExtractionError,
  ingestDocument,
  isPhotoMediaType,
  MAX_PHOTO_BASE64_CHARS,
  methodForTextKind,
  outOfCreditsMessage,
  nextResetISO,
  photoSource,
  PHOTO_MEDIA_TYPES,
  resolveSource,
  ResolveError,
  textSource,
  UnsafeUrlError,
  willCallModel,
  type IngestResult,
  type PhotoMediaType,
} from "@seconds/core";
import { canSpendCredit, creditsFor, db, ensureInitialStatus, saveRecipe, spendCredit } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, requireUserId } from "@/lib/session";

// yt-dlp, cheerio, and DNS lookups all need the Node runtime, not Edge.
export const runtime = "nodejs";
// Transcribing a video is slow; give the pipeline room before the platform cuts it off.
export const maxDuration = 300;

interface ImportBody {
  url?: string;
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
  title?: string;
  forceModel?: boolean;
}

export async function POST(request: Request) {
  // Resolve the user before doing any work: an import is expensive, and a
  // signed-out request should cost nothing.
  let userId: string | null = null;
  if (databaseConfigured()) {
    try {
      userId = await requireUserId(db());
    } catch (err) {
      return errorResponse(err);
    }
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const url = body.url?.trim();
  const text = body.text?.trim();
  const imageBase64 = body.imageBase64?.trim();
  if (!url && !text && !imageBase64) {
    return NextResponse.json(
      { error: "Send a url, some text, or a photo to import." },
      { status: 400 },
    );
  }
  if (imageBase64) {
    if (!isPhotoMediaType(body.imageMediaType)) {
      return NextResponse.json(
        { error: `imageMediaType must be one of: ${PHOTO_MEDIA_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    if (imageBase64.length > MAX_PHOTO_BASE64_CHARS) {
      return NextResponse.json({ error: "That photo is too large. Try a smaller image." }, { status: 400 });
    }
  }

  // Resolve first, then decide whether this will cost anything: a page might
  // publish its own recipe data, and those imports are free however empty the
  // balance is. Extracting is the part that spends money.
  //
  // The exception is video. No video platform publishes schema.org recipes, so
  // one of those always needs a model — and resolving it means a page fetch and
  // a yt-dlp call first. Someone out of credits should hear so immediately
  // rather than after eighteen seconds of work that was never going to be used.
  let result: IngestResult;
  try {
    if (userId && url) {
      const kind = detectSourceKind(url);
      if (kind !== "web" && kind !== "text" && kind !== "manual") {
        const balance = await creditsFor(db(), userId);
        if (!balance.canSpend) {
          return NextResponse.json(
            { error: outOfCreditsMessage(balance, nextResetISO()), credits: balance },
            { status: 402 },
          );
        }
      }
    }

    const doc = url
      ? await resolveSource(url)
      : imageBase64
        ? photoSource(imageBase64, body.imageMediaType as PhotoMediaType, body.title)
        : textSource(text as string, body.title);

    if (userId && willCallModel(doc, { forceModel: body.forceModel })) {
      // The real cost is now known — a transcript costs 2 credits, an article
      // or caption 1 — so this is the precise check, not the courtesy one
      // above. Someone with exactly 1 credit left must not be let into an
      // extraction that needs 2.
      const method = methodForTextKind(doc.textKind);
      if (!(await canSpendCredit(db(), userId, method))) {
        const balance = await creditsFor(db(), userId);
        // 402 rather than 403: this isn't a permission problem, it's a
        // "top up and try again" one, and the client tells them apart.
        return NextResponse.json(
          { error: outOfCreditsMessage(balance, nextResetISO()), credits: balance },
          { status: 402 },
        );
      }
    }

    result = await ingestDocument(doc, {
      forceModel: body.forceModel,
      ...(url ? {} : { title: body.title }),
    });
  } catch (err) {
    return NextResponse.json(errorPayload(err), { status: statusFor(err) });
  }

  // Persistence is optional so the importer is usable before Neon is wired up.
  let savedId: string | null = null;
  let saveError: string | null = null;
  if (userId) {
    try {
      const database = db();
      savedId = await saveRecipe(database, userId, result.recipe);
      // Anything you bothered to import is something you want to cook — but
      // re-importing to refresh a card must not undo a status you already set.
      await ensureInitialStatus(database, userId, savedId, "want_to_cook");
    } catch (err) {
      // A failed write shouldn't throw away a recipe we already paid to extract.
      saveError = err instanceof Error ? err.message : "Could not save the recipe.";
    }
  }

  // Charged after the extraction succeeded, never before. A failed import that
  // had already taken a credit would be charging for nothing, and refunding is
  // more moving parts than simply not charging.
  let credits = null;
  if (userId) {
    try {
      const database = db();
      credits =
        (await spendCredit(database, userId, result.recipe.source.extractionMethod, savedId)) ??
        (await creditsFor(database, userId));
    } catch {
      // Never fail an import over the meter. An uncounted credit costs cents;
      // throwing away a recipe someone already waited for costs a customer.
    }
  }

  return NextResponse.json({
    recipe: savedId ? { ...result.recipe, id: savedId } : result.recipe,
    trace: result.trace,
    freeExtraction: result.freeExtraction,
    saved: savedId !== null,
    saveError,
    credits,
  });
}

function statusFor(err: unknown): number {
  if (err instanceof UnsafeUrlError) return 400;
  if (err instanceof ResolveError) return 422;
  if (err instanceof ExtractionError) return 502;
  return 500;
}

function errorPayload(err: unknown): { error: string; trace?: string[] } {
  if (err instanceof ResolveError) return { error: err.message, trace: err.trace };
  if (err instanceof Error) {
    // The SDK says this when no key is configured, which is confusing out of context.
    if (/authentication method/i.test(err.message)) {
      return {
        error:
          "No Anthropic API key is configured, so this source needs the model but can't reach it. " +
          "Set ANTHROPIC_API_KEY in .env.local.",
      };
    }
    return { error: err.message };
  }
  return { error: "The import failed for an unknown reason." };
}
