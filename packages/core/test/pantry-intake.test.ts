import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePantryIntake, parsePantryIntakeResolution } from "../src/pantry-intake.js";

const now = new Date("2026-09-13T12:00:00.000Z");

describe("parsePantryIntake", () => {
  it("keeps only normalized food lines needed for human review", () => {
    assert.deepEqual(parsePantryIntake({
      source: "receipt",
      externalReference: "receipt-local-1",
      sourceLabel: "Neighborhood market",
      acquiredAt: "2026-09-12T15:30:00Z",
      items: [
        { displayName: "6 ripe bananas" },
        { displayName: "bananas", quantity: 99 },
        { displayName: "1 pint blueberries" },
      ],
      cardLastFour: "must be ignored",
      address: "must be ignored",
    }, now), {
      source: "receipt",
      externalReference: "receipt-local-1",
      sourceLabel: "Neighborhood market",
      acquiredAt: "2026-09-12T15:30:00.000Z",
      items: [
        { canonicalItem: "banana", displayName: "ripe bananas", quantity: 6, unit: null },
        { canonicalItem: "blueberry", displayName: "blueberries", quantity: 1, unit: "pint" },
      ],
    });
  });

  it("rejects unknown sources, unsafe dates, invalid quantities, and oversized batches", () => {
    assert.throws(() => parsePantryIntake({ source: "email", items: [{ displayName: "milk" }] }, now), /known pantry intake source/);
    assert.throws(() => parsePantryIntake({ source: "receipt", acquiredAt: "2030-01-01", items: [{ displayName: "milk" }] }, now), /outside/);
    assert.throws(() => parsePantryIntake({ source: "receipt", items: [{ displayName: "milk", quantity: -2 }] }, now), /zero or more/);
    assert.throws(() => parsePantryIntake({ source: "receipt", items: Array.from({ length: 101 }, () => ({ displayName: "milk" })) }, now), /between 1 and 100/);
  });
});

describe("parsePantryIntakeResolution", () => {
  const intakeId = "00000000-0000-0000-0000-000000000001";
  const itemId = "00000000-0000-0000-0000-000000000002";

  it("deduplicates accepted ids and ignores unrelated fields", () => {
    assert.deepEqual(parsePantryIntakeResolution({
      intakeId, action: "accept", acceptedItemIds: [itemId, itemId], completionEvent: true,
    }), { intakeId, action: "accept", acceptedItemIds: [itemId] });
  });

  it("allows dismissal without accepting anything and rejects an empty acceptance", () => {
    assert.deepEqual(parsePantryIntakeResolution({ intakeId, action: "dismiss" }), {
      intakeId, action: "dismiss", acceptedItemIds: [],
    });
    assert.throws(() => parsePantryIntakeResolution({ intakeId, action: "accept", acceptedItemIds: [] }), /at least one/);
  });
});
