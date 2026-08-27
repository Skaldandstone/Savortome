import {
  acceptFriendRequest,
  blockPerson,
  friendsOverview,
  removeFriendship,
  unblockPerson,
} from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Every way one person's relationship with another can change, keyed by the
 * other person's id. Accepting, declining, withdrawing, removing, and blocking
 * are all edits to the same pair of rows.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ action: "accept" | "remove" | "block" | "unblock" }>(request);

  return withUser(async (userId, database) => {
    switch (body.action) {
      case "accept":
        await acceptFriendRequest(database, userId, id);
        break;
      case "block":
        await blockPerson(database, userId, id);
        break;
      case "unblock":
        await unblockPerson(database, userId, id);
        break;
      // Declining a request, withdrawing one, and un-friending are the same
      // operation on the same rows.
      case "remove":
      default:
        await removeFriendship(database, userId, id);
        break;
    }
    return friendsOverview(database, userId);
  });
}
