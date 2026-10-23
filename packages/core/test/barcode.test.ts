import assert from "node:assert/strict";
import test from "node:test";
import { BarcodeValidationError, parseProductBarcode } from "../src/barcode.js";

test("accepts GTIN formats without losing leading zeros", () => {
  for (const value of ["96385074", "036000291452", "3017620422003", "10012345000017"]) {
    assert.equal(parseProductBarcode(` ${value} `), value);
  }
});

test("rejects damaged check digits, scanner URLs and unsuitable payloads", () => {
  for (const value of ["96385075", "036000291453", "3017620422004", "10012345000018", "00000000", "123", "3017 620422003", "https://example.test/3017620422003", "3017620422003?host=other", 3017620422003, null]) {
    assert.throws(() => parseProductBarcode(value), BarcodeValidationError);
  }
});
