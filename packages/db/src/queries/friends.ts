import { and, desc, eq, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import {
  assertCanRequest,
  FriendshipError,
  normalizeHandle,
  relationshipFrom,
  type FeedItem,
  type FriendsOverview,
  type FriendshipStatus,
  type PersonSummary,
  type RelationshipState,
} from "@nomnom/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Friend requests, and the feed of what friends have been cooking.
 *
 * One row per direction — see the note in `@nomnom/core/friends` for why. The
 * short version: an accepted friendship writes both rows, a pending request
 * writes only the requester's, so who asked whom is never ambiguous.
 */

const PERSON_COLUMNS = {
  id: schema.users.id,
  handle: schema.users.handle,
  displayName: schema.users.displayName,
  avatarUrl: schema.users.avatarUrl,
};

export async function findPersonByHandle(
  database: Database,
  rawHandle: string,
): Promise<PersonSummary | null> {
  const handle = normalizeHandle(rawHandle);
  const row = await database
    .select(PERSON_COLUMNS)
    .from(schema.users)
    .where(eq(schema.users.handle, handle))
    .limit(1);
  return row[0] ?? null;
}

/** Both directions at once, which is all `relationshipFrom` needs. */
export async function relationshipWith(
  database: Database,
  userId: string,
  otherId: string,
): Promise<RelationshipState> {
  if (userId === otherId) return "self";

  const rows = await database
    .select({
      userId: schema.friendships.userId,
      status: schema.friendships.status,
    })
    .from(schema.friendships)
    .where(
      or(
        and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, otherId)),
        and(eq(schema.friendships.userId, otherId), eq(schema.friendships.friendId, userId)),
      ),
    );

  const outgoing = rows.find((r) => r.userId === userId)?.status ?? null;
  const incoming = rows.find((r) => r.userId === otherId)?.status ?? null;
  return relationshipFrom(
    outgoing as FriendshipStatus | null,
    incoming as FriendshipStatus | null,
    false,
  );
}

/** Ask someone to be friends, by handle. */
export async function sendFriendRequest(
  database: Database,
  userId: string,
  rawHandle: string,
): Promise<PersonSummary> {
  const person = await findPersonByHandle(database, rawHandle);
  if (!person) throw new FriendshipError("No one here goes by that handle.");

  if (person.id === userId) assertCanRequest("self");
  assertCanRequest(await relationshipWith(database, userId, person.id));

  await database
    .insert(schema.friendships)
    .values({ userId, friendId: person.id, status: "pending" })
    .onConflictDoNothing();

  return person;
}

/**
 * Accept a request. Writes the reverse row so friendship reads the same from
 * either side, and both rows land together.
 */
export async function acceptFriendRequest(
  database: Database,
  userId: string,
  requesterId: string,
): Promise<void> {
  const pending = await database.query.friendships.findFirst({
    where: and(
      eq(schema.friendships.userId, requesterId),
      eq(schema.friendships.friendId, userId),
      eq(schema.friendships.status, "pending"),
    ),
  });
  if (!pending) throw new FriendshipError("There's no request from them to accept.");

  await database.batch([
    database
      .update(schema.friendships)
      .set({ status: "accepted" })
      .where(
        and(
          eq(schema.friendships.userId, requesterId),
          eq(schema.friendships.friendId, userId),
        ),
      ),
    database
      .insert(schema.friendships)
      .values({ userId, friendId: requesterId, status: "accepted" })
      .onConflictDoUpdate({
        target: [schema.friendships.userId, schema.friendships.friendId],
        set: { status: "accepted" },
      }),
  ]);
}

/** Turn down a request, or withdraw one you sent. */
export async function removeFriendship(
  database: Database,
  userId: string,
  otherId: string,
): Promise<void> {
  await database
    .delete(schema.friendships)
    .where(
      or(
        and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, otherId)),
        and(eq(schema.friendships.userId, otherId), eq(schema.friendships.friendId, userId)),
      ),
    );
}

/**
 * Block someone: drop whatever exists between you and record the block on your
 * side only, so they see no relationship at all rather than a rejection.
 */
export async function blockPerson(
  database: Database,
  userId: string,
  otherId: string,
): Promise<void> {
  if (userId === otherId) throw new FriendshipError("You can't block yourself.");

  await removeFriendship(database, userId, otherId);
  await database
    .insert(schema.friendships)
    .values({ userId, friendId: otherId, status: "blocked" })
    .onConflictDoUpdate({
      target: [schema.friendships.userId, schema.friendships.friendId],
      set: { status: "blocked" },
    });
}

export async function unblockPerson(
  database: Database,
  userId: string,
  otherId: string,
): Promise<void> {
  await database
    .delete(schema.friendships)
    .where(
      and(
        eq(schema.friendships.userId, userId),
        eq(schema.friendships.friendId, otherId),
        eq(schema.friendships.status, "blocked"),
      ),
    );
}

/** Friends, requests waiting on you, and requests you're waiting on. */
export async function friendsOverview(
  database: Database,
  userId: string,
): Promise<FriendsOverview> {
  const [friends, incoming, outgoing] = await Promise.all([
    database
      .select(PERSON_COLUMNS)
      .from(schema.friendships)
      .innerJoin(schema.users, eq(schema.users.id, schema.friendships.friendId))
      .where(
        and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, "accepted")),
      )
      .orderBy(schema.users.displayName),

    database
      .select({ ...PERSON_COLUMNS, requestedAt: schema.friendships.createdAt })
      .from(schema.friendships)
      .innerJoin(schema.users, eq(schema.users.id, schema.friendships.userId))
      .where(
        and(eq(schema.friendships.friendId, userId), eq(schema.friendships.status, "pending")),
      )
      .orderBy(desc(schema.friendships.createdAt)),

    database
      .select({ ...PERSON_COLUMNS, requestedAt: schema.friendships.createdAt })
      .from(schema.friendships)
      .innerJoin(schema.users, eq(schema.users.id, schema.friendships.friendId))
      .where(
        and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, "pending")),
      )
      .orderBy(desc(schema.friendships.createdAt)),
  ]);

  const toRequest = (row: (typeof incoming)[number]) => ({
    person: {
      id: row.id,
      handle: row.handle,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    },
    requestedAt: row.requestedAt.toISOString(),
  });

  return {
    friends,
    incoming: incoming.map(toRequest),
    outgoing: outgoing.map(toRequest),
  };
}

// ---------------------------------------------------------------- the feed

/**
 * What friends have been up to: what they cooked, what they rated, what they
 * shared.
 *
 * Every branch requires the recipe to be non-private. The viewer is a friend of
 * the owner, so `friends` and `public` are both visible to them — which keeps
 * this consistent with `canView` without re-deriving it per row.
 */
export async function friendsFeed(
  database: Database,
  userId: string,
  limit = 40,
): Promise<FeedItem[]> {
  const friendRows = await database
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(
      and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, "accepted")),
    );

  const friendIds = friendRows.map((r) => r.friendId);
  if (friendIds.length === 0) return [];

  const visible = ne(schema.recipes.visibility, "private");

  const [cooked, rated, shared] = await Promise.all([
    database
      .select({
        ...PERSON_COLUMNS,
        recipeId: schema.recipes.id,
        recipeTitle: schema.recipes.title,
        recipeImageUrl: schema.recipes.imageUrl,
        at: schema.ratings.lastCookedAt,
        timesCooked: schema.ratings.timesCooked,
      })
      .from(schema.ratings)
      .innerJoin(schema.recipes, eq(schema.recipes.id, schema.ratings.recipeId))
      .innerJoin(schema.users, eq(schema.users.id, schema.ratings.userId))
      .where(
        and(
          inArray(schema.ratings.userId, friendIds),
          isNotNull(schema.ratings.lastCookedAt),
          visible,
        ),
      )
      .orderBy(desc(schema.ratings.lastCookedAt))
      .limit(limit),

    database
      .select({
        ...PERSON_COLUMNS,
        recipeId: schema.recipes.id,
        recipeTitle: schema.recipes.title,
        recipeImageUrl: schema.recipes.imageUrl,
        at: schema.ratings.updatedAt,
        stars: schema.ratings.stars,
        review: schema.ratings.review,
      })
      .from(schema.ratings)
      .innerJoin(schema.recipes, eq(schema.recipes.id, schema.ratings.recipeId))
      .innerJoin(schema.users, eq(schema.users.id, schema.ratings.userId))
      .where(
        and(inArray(schema.ratings.userId, friendIds), gt(schema.ratings.stars, 0), visible),
      )
      .orderBy(desc(schema.ratings.updatedAt))
      .limit(limit),

    database
      .select({
        ...PERSON_COLUMNS,
        recipeId: schema.recipes.id,
        recipeTitle: schema.recipes.title,
        recipeImageUrl: schema.recipes.imageUrl,
        at: schema.recipes.sharedAt,
      })
      .from(schema.recipes)
      .innerJoin(schema.users, eq(schema.users.id, schema.recipes.ownerId))
      .where(
        and(
          inArray(schema.recipes.ownerId, friendIds),
          isNotNull(schema.recipes.sharedAt),
          visible,
        ),
      )
      .orderBy(desc(schema.recipes.sharedAt))
      .limit(limit),
  ]);

  const person = (row: { id: string; handle: string; displayName: string; avatarUrl: string | null }) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  });

  const items: FeedItem[] = [
    ...cooked.map((r) => ({
      kind: "cooked" as const,
      person: person(r),
      recipeId: r.recipeId,
      recipeTitle: r.recipeTitle,
      recipeImageUrl: r.recipeImageUrl,
      at: r.at!.toISOString(),
      timesCooked: r.timesCooked,
    })),
    ...rated.map((r) => ({
      kind: "rated" as const,
      person: person(r),
      recipeId: r.recipeId,
      recipeTitle: r.recipeTitle,
      recipeImageUrl: r.recipeImageUrl,
      at: r.at.toISOString(),
      stars: r.stars,
      review: r.review,
    })),
    ...shared.map((r) => ({
      kind: "shared" as const,
      person: person(r),
      recipeId: r.recipeId,
      recipeTitle: r.recipeTitle,
      recipeImageUrl: r.recipeImageUrl,
      at: r.at!.toISOString(),
    })),
  ];

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Count of requests waiting on the user, for a badge. */
export async function pendingRequestCount(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.friendships)
    .where(
      and(eq(schema.friendships.friendId, userId), eq(schema.friendships.status, "pending")),
    );
  return rows[0]?.n ?? 0;
}
