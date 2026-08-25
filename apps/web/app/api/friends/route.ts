import { friendsOverview, sendFriendRequest } from "@nomnom/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser((userId, database) => friendsOverview(database, userId));
}

/** Ask someone to be friends, by handle. */
export async function POST(request: Request) {
  const body = await readJson<{ handle: string }>(request);
  return withUser(async (userId, database) => {
    await sendFriendRequest(database, userId, body.handle ?? "");
    return friendsOverview(database, userId);
  });
}
