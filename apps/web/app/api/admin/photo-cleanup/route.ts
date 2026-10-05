import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuthorized, withAdmin } from "@/lib/admin";
import { processPendingRecipePhotos } from "@/lib/photo-cleanup";

export const runtime = "nodejs";

function reply(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function reviewedTargetMatches(): boolean {
  const expectedHash = process.env.PHOTO_CLEANUP_EXPECTED_DATABASE_SHA256;
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash) || !process.env.DATABASE_URL) return false;
  const actualHash = createHash("sha256").update(process.env.DATABASE_URL).digest("hex");
  return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash))
    && Boolean(process.env.PHOTO_CLEANUP_EXPECTED_R2_ACCOUNT_ID)
    && Boolean(process.env.PHOTO_CLEANUP_EXPECTED_R2_BUCKET)
    && process.env.PHOTO_CLEANUP_EXPECTED_R2_ACCOUNT_ID === process.env.R2_ACCOUNT_ID
    && process.env.PHOTO_CLEANUP_EXPECTED_R2_BUCKET === process.env.R2_BUCKET_NAME;
}

/** Staff-only, explicit one batch. No scheduler, arbitrary key or user selection.
 * Configuration pins do not replace deployment/runtime identity review.
 */
export async function POST(request: Request) {
  if (!adminAuthorized(request)) return reply("Admin token required", 401);
  if (process.env.PHOTO_CLEANUP_ENABLED !== "true") return reply("Photo cleanup is disabled.", 501);
  if (!reviewedTargetMatches()) return reply("Photo cleanup target requires review.", 501);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 512)) return reply("Invalid cleanup request.", 400);
  // Bounded stream read, including callers omitting or misreporting length.
  const reader = request.body?.getReader();
  let text = "";
  if (reader) {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 512) { await reader.cancel(); return reply("Invalid cleanup request.", 400); }
        chunks.push(value);
      }
      text = Buffer.concat(chunks).toString("utf8");
    } catch {
      return reply("Invalid cleanup request.", 400);
    } finally { reader.releaseLock(); }
  }
  let input: unknown;
  try { input = JSON.parse(text); } catch { return reply("Invalid cleanup request.", 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => key !== "limit" && key !== "timeoutMs")) return reply("Invalid cleanup request.", 400);
  const { limit = 5, timeoutMs = 3000 } = input as { limit?: unknown; timeoutMs?: unknown };
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 10
      || typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3000) {
    return reply("Invalid cleanup request.", 400);
  }
  const response = await withAdmin(request, async database => {
    return processPendingRecipePhotos(database, { limit, timeoutMs });
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
