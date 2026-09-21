import { parseIngredientLine } from "./units.js";

export const PANTRY_INTAKE_SOURCES = ["grocery_order", "receipt"] as const;
export type PantryIntakeSource = (typeof PANTRY_INTAKE_SOURCES)[number];
export type PantryIntakeStatus = "pending" | "accepted" | "dismissed";

export interface PantryIntakeItemInput {
  displayName: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface PantryIntakeInput {
  source: PantryIntakeSource;
  /** A provider order id or locally generated receipt id, used only for deduplication. */
  externalReference?: string | null;
  sourceLabel?: string | null;
  acquiredAt?: string | null;
  items: PantryIntakeItemInput[];
}

export interface NormalizedPantryIntakeItem {
  canonicalItem: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
}

export interface NormalizedPantryIntake extends Omit<PantryIntakeInput, "items"> {
  externalReference: string | null;
  sourceLabel: string | null;
  acquiredAt: string | null;
  items: NormalizedPantryIntakeItem[];
}

export interface PantryIntakeView {
  id: string;
  source: PantryIntakeSource;
  sourceLabel: string | null;
  acquiredAt: string | null;
  status: PantryIntakeStatus;
  createdAt: string;
  items: Array<NormalizedPantryIntakeItem & { id: string }>;
}

export interface PantryIntakeResolution {
  intakeId: string;
  action: "accept" | "dismiss";
  acceptedItemIds: string[];
}

export class PantryIntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PantryIntakeValidationError";
  }
}

/**
 * Accept only already-normalized product lines. Raw receipts, addresses,
 * payment data and provider payloads must be discarded before this boundary.
 */
export function parsePantryIntake(value: unknown, now: Date = new Date()): NormalizedPantryIntake {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PantryIntakeValidationError("Add at least one item to review.");
  }
  const body = value as Record<string, unknown>;
  if (!PANTRY_INTAKE_SOURCES.includes(body.source as PantryIntakeSource)) {
    throw new PantryIntakeValidationError("Choose a known pantry intake source.");
  }
  const externalReference = optionalText(body.externalReference, 200, "Source reference");
  const sourceLabel = optionalText(body.sourceLabel, 80, "Source name");
  const acquiredAt = optionalDate(body.acquiredAt, now);
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new PantryIntakeValidationError("Review between 1 and 100 items at a time.");
  }

  const seen = new Set<string>();
  const items: NormalizedPantryIntakeItem[] = [];
  for (const candidate of body.items) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new PantryIntakeValidationError("Every proposed item needs a name.");
    }
    const item = candidate as Record<string, unknown>;
    if (typeof item.displayName !== "string" || !item.displayName.trim() || item.displayName.length > 160) {
      throw new PantryIntakeValidationError("Every proposed item needs a short name.");
    }
    const parsed = parseIngredientLine(item.displayName.trim());
    if (!parsed.canonicalItem) throw new PantryIntakeValidationError("One proposed item could not be recognized.");
    if (seen.has(parsed.canonicalItem)) continue;
    seen.add(parsed.canonicalItem);

    const quantity = item.quantity === undefined ? parsed.quantity : item.quantity;
    if (quantity !== null && (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0)) {
      throw new PantryIntakeValidationError("Item quantities must be zero or more.");
    }
    const unit = item.unit === undefined ? parsed.unit : item.unit;
    if (unit !== null && (typeof unit !== "string" || unit.length > 40)) {
      throw new PantryIntakeValidationError("Item units must be short text.");
    }
    items.push({
      canonicalItem: parsed.canonicalItem,
      displayName: parsed.item || item.displayName.trim(),
      quantity: quantity as number | null,
      unit: typeof unit === "string" ? unit.trim() || null : null,
    });
  }
  if (items.length === 0) throw new PantryIntakeValidationError("Add at least one distinct item to review.");
  return { source: body.source as PantryIntakeSource, externalReference, sourceLabel, acquiredAt, items };
}

export function parsePantryIntakeResolution(value: unknown): PantryIntakeResolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PantryIntakeValidationError("Choose a pantry review to update.");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.intakeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.intakeId)) {
    throw new PantryIntakeValidationError("Choose a pantry review to update.");
  }
  if (body.action !== "accept" && body.action !== "dismiss") {
    throw new PantryIntakeValidationError("Choose whether to add or dismiss these items.");
  }
  const acceptedItemIds = body.action === "accept" && Array.isArray(body.acceptedItemIds)
    ? [...new Set(body.acceptedItemIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))]
    : [];
  if (body.action === "accept" && acceptedItemIds.length === 0) {
    throw new PantryIntakeValidationError("Choose at least one item to add.");
  }
  return { intakeId: body.intakeId, action: body.action, acceptedItemIds };
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw new PantryIntakeValidationError(`${label} is too long.`);
  return value.trim() || null;
}

function optionalDate(value: unknown, now: Date): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PantryIntakeValidationError("Purchase date is invalid.");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > now.getTime() + 86_400_000 || time < now.getTime() - 366 * 86_400_000) {
    throw new PantryIntakeValidationError("Purchase date is outside the supported range.");
  }
  return new Date(time).toISOString();
}
