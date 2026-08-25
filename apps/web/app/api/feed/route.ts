import { friendsFeed } from "@nomnom/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser((userId, database) => friendsFeed(database, userId));
}
