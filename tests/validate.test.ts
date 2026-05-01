import { test } from "node:test";
import assert from "node:assert/strict";
import { validateScanResult } from "../src/validate";
import type { ScanResult } from "../src/types";

test("accepts a minimal valid result", () => {
  const valid: ScanResult = { items: [], inferredGroups: [], unparsed: [] };
  assert.deepEqual(validateScanResult(valid), valid);
});

test("accepts a single open todo", () => {
  const result: ScanResult = {
    items: [{ text: "buy milk", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  assert.deepEqual(validateScanResult(result), result);
});

test("accepts nested children", () => {
  const result: ScanResult = {
    items: [
      {
        text: "Q2 launch",
        status: "open",
        children: [{ text: "lock messaging", status: "open", children: [] }],
      },
    ],
    inferredGroups: [],
    unparsed: [],
  };
  assert.deepEqual(validateScanResult(result), result);
});

test("accepts inferredGroups whose parentPath resolves to a node with children", () => {
  const result: ScanResult = {
    items: [
      {
        text: "parent",
        status: "open",
        children: [{ text: "child", status: "open", children: [] }],
      },
    ],
    inferredGroups: [{ parentPath: [0], reason: "decomposes parent" }],
    unparsed: [],
  };
  assert.deepEqual(validateScanResult(result), result);
});

test("rejects null", () => {
  assert.throws(() => validateScanResult(null), /not an object/i);
});

test("throws ScanValidationError, not generic Error", async () => {
  const { ScanValidationError } = await import("../src/validate");
  assert.throws(
    () => validateScanResult(null),
    (err: unknown) => err instanceof ScanValidationError
  );
});

test("rejects missing items", () => {
  assert.throws(
    () => validateScanResult({ inferredGroups: [], unparsed: [] }),
    /items/i
  );
});

test("rejects bad status enum", () => {
  assert.throws(
    () =>
      validateScanResult({
        items: [{ text: "x", status: "maybe", children: [] }],
        inferredGroups: [],
        unparsed: [],
      }),
    /status/i
  );
});

test("rejects non-string text", () => {
  assert.throws(
    () =>
      validateScanResult({
        items: [{ text: 42, status: "open", children: [] }],
        inferredGroups: [],
        unparsed: [],
      }),
    /text/i
  );
});

test("rejects inferredGroup with out-of-range parentPath", () => {
  assert.throws(
    () =>
      validateScanResult({
        items: [{ text: "x", status: "open", children: [] }],
        inferredGroups: [{ parentPath: [5], reason: "..." }],
        unparsed: [],
      }),
    /parentPath/i
  );
});

test("rejects inferredGroup whose parentPath resolves to a node with no children", () => {
  assert.throws(
    () =>
      validateScanResult({
        items: [{ text: "x", status: "open", children: [] }],
        inferredGroups: [{ parentPath: [0], reason: "..." }],
        unparsed: [],
      }),
    /no children/i
  );
});

test("rejects non-string unparsed entry", () => {
  assert.throws(
    () =>
      validateScanResult({
        items: [],
        inferredGroups: [],
        unparsed: [42],
      }),
    /unparsed/i
  );
});
