import { failedImportBuckets } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/**
 * Failed imports across all users in a recent window, grouped by error.
 * One tall bucket = an upstream break; scattered singletons = per-recipe bugs.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const hours = Number(new URL(request.url).searchParams.get("hours") ?? "48");
  const sinceHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 720) : 48;
  return withAdmin(request, (database) => failedImportBuckets(database, sinceHours));
}
