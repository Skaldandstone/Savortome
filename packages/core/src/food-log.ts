export const FOOD_LOG_SOURCES = ["text", "photo", "voice", "repeat"] as const;
export type FoodLogSource = typeof FOOD_LOG_SOURCES[number];
export interface FoodLogInput {
  id: string;
  date: string;
  title: string;
  portion: string | null;
  source: FoodLogSource;
}
export interface FoodLogEntry extends FoodLogInput { createdAt: string; updatedAt: string; }
/** A generated draft has no eating-completion, inventory or nutrition fields. */
export interface FoodNoteDraft { title: string; portion: string | null; uncertainty: string; }
export class FoodLogValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FoodLogValidationError"; }
}
export function foodLogDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FoodLogValidationError("Choose a calendar date.");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "2000-01-01" || value > "2100-12-31") {
    throw new FoodLogValidationError("Choose a valid calendar date.");
  }
  return value;
}
export function localFoodDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function foodLogId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new FoodLogValidationError("That food note could not be identified.");
  return value;
}
export function parseFoodLogInput(value: unknown): FoodLogInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FoodLogValidationError("Review a food note before saving.");
  const body = value as Record<string, unknown>;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) throw new FoodLogValidationError("Enter a food name up to 160 characters.");
  if (body.portion !== null && body.portion !== undefined && (typeof body.portion !== "string" || body.portion.length > 120)) throw new FoodLogValidationError("Use a short portion description, or leave it unknown.");
  if (!FOOD_LOG_SOURCES.includes(body.source as FoodLogSource)) throw new FoodLogValidationError("Choose a known food-note source.");
  return { id: foodLogId(body.id), date: foodLogDate(body.date), title: body.title.trim(), portion: typeof body.portion === "string" ? body.portion.trim() || null : null, source: body.source as FoodLogSource };
}

/** A resolved request alone is not proof that the reviewed note was saved. */
export function foodLogReceiptMatches(expected: FoodLogInput, received: unknown): received is FoodLogEntry {
  try {
    const input = parseFoodLogInput(expected);
    if (!received || typeof received !== "object" || Array.isArray(received)) return false;
    const entry = received as Record<string, unknown>;
    const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    // UUID case is formatting only. Other fields must match the reviewed
    // normalized request exactly; missing/trimmed/different values fail.
    return typeof entry.id === "string" && foodLogId(entry.id).toLowerCase() === input.id.toLowerCase()
      && entry.date === input.date && entry.title === input.title && entry.portion === input.portion && entry.source === input.source
      && timestamp(entry.createdAt) && timestamp(entry.updatedAt);
  } catch { return false; }
}
