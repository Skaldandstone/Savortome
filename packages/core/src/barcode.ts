/** Consumer product GTINs only. Never treat scanner content as a URL to fetch. */
export class BarcodeValidationError extends Error {
  constructor() {
    super("Enter a valid 8, 12, 13 or 14 digit product barcode.");
    this.name = "BarcodeValidationError";
  }
}

export function parseProductBarcode(value: unknown): string {
  if (typeof value !== "string") throw new BarcodeValidationError();
  const digits = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) || /^0+$/.test(digits)) {
    throw new BarcodeValidationError();
  }
  let sum = 0;
  // GS1 weights are counted from the right, excluding the final check digit.
  for (let offset = 1; offset < digits.length; offset++) {
    sum += Number(digits[digits.length - 1 - offset]) * (offset % 2 === 1 ? 3 : 1);
  }
  if ((10 - sum % 10) % 10 !== Number(digits.at(-1))) throw new BarcodeValidationError();
  return digits;
}

/** A product match is an editable label draft, not evidence of purchase or safety. */
export interface BarcodeProductDraft {
  barcode: string;
  displayName: string;
  brand: string | null;
  packageLabel: string | null;
  source: "open_food_facts";
  sourceUrl: string;
  // Purchased package count deliberately belongs to human review, not lookup.
}
