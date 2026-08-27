/**
 * Shelves are Second Breakfast's answer to Goodreads' want-to-read / reading / read.
 * Pure domain types and rules, shared by both clients and the server.
 */

/**
 * The three built-in shelves every account gets. They are mutually exclusive —
 * a recipe is at exactly one point in its lifecycle — which is what separates
 * them from custom shelves, where a recipe can sit on as many as you like.
 */
export const STATUS_SHELVES = ["want_to_cook", "cooking", "cooked"] as const;
export type StatusShelf = (typeof STATUS_SHELVES)[number];

export const SHELF_TYPES = [...STATUS_SHELVES, "custom"] as const;
export type ShelfType = (typeof SHELF_TYPES)[number];

export const isStatusShelf = (type: ShelfType): type is StatusShelf =>
  (STATUS_SHELVES as readonly string[]).includes(type);

export const DEFAULT_SHELVES: { type: StatusShelf; name: string }[] = [
  { type: "want_to_cook", name: "Want to cook" },
  { type: "cooking", name: "Cooking" },
  { type: "cooked", name: "Cooked" },
];

export const SHELF_LABEL: Record<StatusShelf, string> = {
  want_to_cook: "Want to cook",
  cooking: "Cooking",
  cooked: "Cooked",
};

/** Short verb for the button that moves a recipe onto this shelf. */
export const SHELF_ACTION: Record<StatusShelf, string> = {
  want_to_cook: "Want to cook",
  cooking: "Cooking now",
  cooked: "Cooked it",
};

export const VISIBILITIES = ["private", "friends", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Only me",
  friends: "Friends",
  public: "Anyone with the link",
};

export interface ShelfSummary {
  id: string;
  name: string;
  type: ShelfType;
  visibility: Visibility;
  recipeCount: number;
}

export interface RecipeRating {
  stars: number;
  review: string | null;
  timesCooked: number;
  lastCookedAt: string | null;
}

/** Everything the UI needs to render the shelf and rating controls for one recipe. */
export interface RecipeShelfState {
  /** Ids of every shelf this recipe currently sits on. */
  shelfIds: string[];
  /** The status shelf it's on, if any. Null means unshelved. */
  status: StatusShelf | null;
  rating: RecipeRating | null;
}

export const MAX_STARS = 5;
export const MIN_SHELF_NAME = 1;
export const MAX_SHELF_NAME = 60;

export class ShelfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShelfValidationError";
  }
}

/** Trim and validate a user-supplied shelf name. Throws with a message worth showing. */
export function normalizeShelfName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < MIN_SHELF_NAME) throw new ShelfValidationError("Give the shelf a name.");
  if (name.length > MAX_SHELF_NAME) {
    throw new ShelfValidationError(`Shelf names are limited to ${MAX_SHELF_NAME} characters.`);
  }
  return name;
}

export function assertValidStars(stars: number): void {
  if (!Number.isInteger(stars) || stars < 1 || stars > MAX_STARS) {
    throw new ShelfValidationError(`Ratings run from 1 to ${MAX_STARS} stars.`);
  }
}

/**
 * Marking something cooked is the one shelf move that carries a side effect:
 * it bumps the times-cooked counter, which is a better signal of what someone
 * actually makes than stars are.
 */
export const shouldCountAsCook = (from: StatusShelf | null, to: StatusShelf): boolean =>
  to === "cooked" && from !== "cooked";

// ---------------------------------------------------------------- optimistic updates

/**
 * The pure "what should the UI show immediately" half of each shelf action.
 *
 * Both clients apply these before the write lands and roll back if it fails,
 * so the rules live here once rather than being re-derived per platform.
 */

/** Pressing the shelf a recipe is already on takes it off — the same gesture in reverse. */
export const nextStatus = (
  current: StatusShelf | null,
  pressed: StatusShelf,
): StatusShelf | null => (current === pressed ? null : pressed);

export function applyStatus(
  state: RecipeShelfState,
  status: StatusShelf | null,
): RecipeShelfState {
  return { ...state, status };
}

export function applyShelfMembership(
  state: RecipeShelfState,
  shelfId: string,
  member: boolean,
): RecipeShelfState {
  return {
    ...state,
    shelfIds: member
      ? [...new Set([...state.shelfIds, shelfId])]
      : state.shelfIds.filter((id) => id !== shelfId),
  };
}

export function applyRating(
  state: RecipeShelfState,
  stars: number,
  review: string | null = null,
): RecipeShelfState {
  return {
    ...state,
    rating: {
      stars,
      review,
      // The cook counter belongs to the shelf flow, not to rating.
      timesCooked: state.rating?.timesCooked ?? 0,
      lastCookedAt: state.rating?.lastCookedAt ?? null,
    },
  };
}
