/**
 * Planning what to cook, and when.
 *
 * A recipe collection answers "what could I make". A plan answers "what am I
 * making on Tuesday", which is the question that actually gets someone to the
 * shops.
 *
 * Every date here is an ISO `YYYY-MM-DD` string rather than a `Date`. A meal
 * planned for Tuesday must stay on Tuesday for someone in Auckland and someone
 * in Los Angeles, and the moment a local `Date` meets a UTC boundary it starts
 * drifting a day. The database column is `date` for the same reason.
 */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const isMealSlot = (value: string | null | undefined): value is MealSlot =>
  typeof value === "string" && (MEAL_SLOTS as readonly string[]).includes(value);

/** Fall back rather than throw: a hand-edited URL shouldn't be an error page. */
export const mealSlotOr = (value: string | null | undefined): MealSlot =>
  isMealSlot(value) ? value : "dinner";

/** A recipe planned for a particular meal, as the week grid shows it. */
export interface PlannedMeal {
  recipeId: string;
  date: string;
  slot: MealSlot;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
}

export const SUGGESTION_STATUSES = ["pending", "accepted", "dismissed"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * A friend's proposal for your calendar — never a write to it. Shows up on
 * your own plan page until you accept it (which copies the recipe into your
 * library and plans it, same as saving a shared recipe) or dismiss it.
 */
export interface PlanSuggestion {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string;
  title: string;
  imageUrl: string | null;
  suggestedBy: { handle: string; displayName: string; avatarUrl: string | null };
  status: SuggestionStatus;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isISODate = (value: string): boolean =>
  ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Today, as a plain date, in whatever zone the person is actually standing in. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Date arithmetic done in UTC on purpose.
 *
 * The strings carry no zone, so treating them as UTC midnight makes adding a
 * day exactly adding a day — no daylight-saving Sunday where the week has
 * twenty-three hours in it and a date quietly repeats.
 */
function addDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** The Monday of the week containing this date. */
export function weekStart(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`);
  // getUTCDay is 0 for Sunday; a week that starts on Monday wants that to be 6.
  const offset = (at.getUTCDay() + 6) % 7;
  return addDays(iso, -offset);
}

export const shiftWeeks = (startIso: string, weeks: number): string =>
  addDays(startIso, weeks * 7);

export const weekEnd = (startIso: string): string => addDays(startIso, 6);

export function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Tue 1 Sep" — short enough for a column heading. */
export function dayLabel(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`);
  const weekday = WEEKDAY[(at.getUTCDay() + 6) % 7];
  return `${weekday} ${at.getUTCDate()} ${MONTH[at.getUTCMonth()]}`;
}

/** "1–7 Sep", or "28 Aug – 3 Sep" when the week straddles a month. */
export function weekLabel(startIso: string): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${weekEnd(startIso)}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();

  const left = sameMonth
    ? `${start.getUTCDate()}`
    : `${start.getUTCDate()} ${MONTH[start.getUTCMonth()]}`;
  return `${left}–${end.getUTCDate()} ${MONTH[end.getUTCMonth()]}`;
}

/**
 * The week's meals, bucketed for a grid.
 *
 * Returns every day and every slot, empty ones included — the grid needs the
 * gaps as much as the entries, since an empty Thursday is the thing a plan is
 * meant to make visible.
 */
export function groupByDay(
  meals: readonly PlannedMeal[],
  startIso: string,
): { date: string; slots: { slot: MealSlot; meals: PlannedMeal[] }[] }[] {
  return weekDays(startIso).map((date) => ({
    date,
    slots: MEAL_SLOTS.map((slot) => ({
      slot,
      meals: meals.filter((m) => m.date === date && m.slot === slot),
    })),
  }));
}

/** Every distinct recipe in a plan — what the shopping list is built from. */
export const recipeIdsIn = (meals: readonly PlannedMeal[]): string[] => [
  ...new Set(meals.map((m) => m.recipeId)),
];
