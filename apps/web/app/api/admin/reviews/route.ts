import { recentReviews } from "@seconds/db";
import { withAdmin } from "@/lib/admin";

/** Recent free-text reviews across users — the moderation scan surface. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withAdmin(request, (database) => recentReviews(database));
}
