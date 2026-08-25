import type { Visibility } from "./shelves.js";

/**
 * Who can see a recipe.
 *
 * These rules decide what a stranger with a link gets, so they're kept here as
 * pure functions with tests rather than being spread across route handlers
 * where a missed case leaks somebody's library.
 */

export interface ViewerContext {
  /** Internal user id, or null for a signed-out visitor. */
  viewerId: string | null;
  /** Ids the viewer is accepted friends with. */
  friendIds?: Set<string>;
}

export interface OwnedResource {
  ownerId: string;
  visibility: Visibility;
}

/** The single question every read path asks before returning a recipe. */
export function canView(resource: OwnedResource, viewer: ViewerContext): boolean {
  if (viewer.viewerId && resource.ownerId === viewer.viewerId) return true;

  switch (resource.visibility) {
    case "public":
      return true;
    case "friends":
      // A signed-out visitor is nobody's friend, so this is also the guard
      // against a friends-only recipe leaking to an anonymous link.
      return Boolean(viewer.viewerId && viewer.friendIds?.has(resource.ownerId));
    case "private":
      return false;
  }
}

/** Only the owner may change anything. */
export const canEdit = (resource: OwnedResource, viewer: ViewerContext): boolean =>
  Boolean(viewer.viewerId) && resource.ownerId === viewer.viewerId;

/** True once a recipe is reachable by anyone holding its link. */
export const isShared = (visibility: Visibility): boolean => visibility !== "private";

export const SHARE_PATH = "/r";

/** The link to hand someone. Relative, so the caller supplies the origin. */
export const sharePath = (recipeId: string): string => `${SHARE_PATH}/${recipeId}`;

export function shareUrl(recipeId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${sharePath(recipeId)}`;
}

/**
 * What a viewer is allowed to see about a shared recipe.
 *
 * A shared recipe is the card, not the owner's relationship with it: their
 * shelves, private rating, and notes stay theirs. This type is what the public
 * page renders, and it deliberately has no field for any of that.
 */
export interface SharedRecipeView {
  recipeId: string;
  /** The handle and name of whoever shared it. */
  sharedBy: { handle: string; displayName: string; avatarUrl: string | null };
  /** How many people have saved a copy. Social proof, and it's not private. */
  saveCount: number;
  /** Set when the viewer already has their own copy of this recipe. */
  alreadySaved: boolean;
  /** Whether the viewer may save it — signed in, and not the owner. */
  canSave: boolean;
}

export const VISIBILITY_HELP: Record<Visibility, string> = {
  private: "Only you can see this.",
  friends: "Anyone you're friends with can see this.",
  public: "Anyone with the link can see this.",
};
