/**
 * Friends.
 *
 * The `friendships` table stores **one row per direction**, which is what makes
 * the three states cheap to ask about:
 *
 * - `A -> B pending`   A has asked B. Only the requester's row exists.
 * - `A -> B accepted` and `B -> A accepted`   they're friends.
 * - `A -> B blocked`   A has blocked B; B has no row at all.
 *
 * So "who are my friends" and "who has asked me" are both a single indexed
 * lookup, and who initiated a request is never ambiguous.
 */

export const FRIENDSHIP_STATUSES = ["pending", "accepted", "blocked"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export interface PersonSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

/** How the viewer stands with someone, from the viewer's side. */
export type RelationshipState =
  | "self"
  | "friends"
  | "request-sent"
  | "request-received"
  | "blocked"
  | "none";

export interface FriendRequest {
  person: PersonSummary;
  requestedAt: string;
}

export interface FriendsOverview {
  friends: PersonSummary[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export class FriendshipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FriendshipError";
  }
}

export const MIN_HANDLE = 2;
export const MAX_HANDLE = 40;

/**
 * Normalize a typed handle. People paste "@sam", "Sam", or a whole profile URL;
 * all three should find the same person.
 */
export function normalizeHandle(raw: string): string {
  let candidate = raw.trim();

  if (candidate.includes("/")) {
    // A pasted profile URL — with or without a scheme, since
    // "secondbreakfast.app/@sam" is just as common a paste as the full
    // "https://..." version. Real URL parsing rather than a slash-splitting
    // regex, so a trailing slash or a "?ref=..." tracking param a browser's
    // own address bar or share sheet adds doesn't get treated as part of
    // the handle, or leave the whole thing empty.
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      const segments = url.pathname.split("/").filter(Boolean);
      candidate = segments.at(-1) ?? "";
    } catch {
      candidate = "";
    }
  }

  const handle = candidate.replace(/^@/, "").toLowerCase();

  if (handle.length < MIN_HANDLE) {
    throw new FriendshipError("That's too short to be a handle.");
  }
  if (handle.length > MAX_HANDLE) {
    throw new FriendshipError("That's too long to be a handle.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) {
    throw new FriendshipError("Handles are letters, numbers, and dashes.");
  }
  return handle;
}

/**
 * What the viewer can do about someone, given how they currently stand.
 * Keeping this in one place stops the UI and the API disagreeing about
 * whether a button should exist.
 */
export function relationshipFrom(
  outgoing: FriendshipStatus | null,
  incoming: FriendshipStatus | null,
  isSelf: boolean,
): RelationshipState {
  if (isSelf) return "self";
  if (outgoing === "blocked") return "blocked";
  if (outgoing === "accepted" || incoming === "accepted") return "friends";
  if (outgoing === "pending") return "request-sent";
  if (incoming === "pending") return "request-received";
  return "none";
}

/** Guard the transitions, so an API route doesn't have to reason about them. */
export function assertCanRequest(state: RelationshipState): void {
  switch (state) {
    case "self":
      throw new FriendshipError("You don't need to add yourself.");
    case "friends":
      throw new FriendshipError("You're already friends.");
    case "request-sent":
      throw new FriendshipError("You've already asked.");
    case "request-received":
      throw new FriendshipError("They've already asked you — accept instead.");
    case "blocked":
      throw new FriendshipError("You've blocked them.");
    case "none":
      return;
  }
}

// ---------------------------------------------------------------- the feed

export const FEED_KINDS = ["cooked", "rated", "shared"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export interface FeedItem {
  kind: FeedKind;
  person: PersonSummary;
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl: string | null;
  at: string;
  /** Present on "rated". */
  stars?: number;
  review?: string | null;
  /** Present on "cooked". */
  timesCooked?: number;
}

/** One line of past tense, in the words someone would actually use. */
export function describeFeedItem(item: FeedItem): string {
  const name = item.person.displayName;

  switch (item.kind) {
    case "cooked":
      return item.timesCooked && item.timesCooked > 1
        ? `${name} cooked this again`
        : `${name} cooked this`;
    case "rated":
      return `${name} rated it ${item.stars}/5`;
    case "shared":
      return `${name} shared this`;
  }
}
