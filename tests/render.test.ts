import { test } from "node:test";
import assert from "node:assert/strict";
import { renderScanBlock } from "../src/render";
import type { ScanResult } from "../src/types";

const ts = (h: number, m: number, s: number): Date => {
  const d = new Date(2026, 4, 1);
  d.setHours(h, m, s, 0);
  return d;
};

test("renders a single open todo", () => {
  const scan: ScanResult = {
    items: [{ text: "buy milk", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/2026-05-01-094237.jpg", ts(9, 42, 37));
  assert.equal(
    out,
    [
      "## 09:42",
      "",
      "[whiteboard scan](attachments/2026-05-01-094237.jpg)",
      "",
      "- [ ] buy milk",
    ].join("\n")
  );
});

test("renders done status as [x]", () => {
  const scan: ScanResult = {
    items: [{ text: "ship it", status: "done", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(15, 30, 0));
  assert.match(out, /- \[x\] ship it/);
});

test("renders visually nested children with 4-space indent (no footnote)", () => {
  const scan: ScanResult = {
    items: [
      {
        text: "Q2 launch",
        status: "open",
        children: [
          { text: "lock messaging", status: "open", children: [] },
          { text: "brief sales", status: "open", children: [] },
        ],
      },
    ],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /- \[ \] Q2 launch\n {4}- \[ \] lock messaging\n {4}- \[ \] brief sales/);
  assert.doesNotMatch(out, /\[\^/);
});

test("renders inferred children with footnote markers and definition", () => {
  const scan: ScanResult = {
    items: [
      {
        text: "Q2 launch",
        status: "open",
        children: [
          { text: "brief sales", status: "open", children: [] },
          { text: "brief support", status: "open", children: [] },
        ],
      },
    ],
    inferredGroups: [{ parentPath: [0], reason: "decompose Q2 launch" }],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /- \[ \] brief sales \[\^094237-1\]/);
  assert.match(out, /- \[ \] brief support \[\^094237-1\]/);
  assert.match(out, /^\[\^094237-1\]: decompose Q2 launch$/m);
});

test("multiple inferred groups get sequential suffixes per scan", () => {
  const scan: ScanResult = {
    items: [
      {
        text: "A",
        status: "open",
        children: [{ text: "a1", status: "open", children: [] }],
      },
      {
        text: "B",
        status: "open",
        children: [{ text: "b1", status: "open", children: [] }],
      },
    ],
    inferredGroups: [
      { parentPath: [0], reason: "first reason" },
      { parentPath: [1], reason: "second reason" },
    ],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /- \[ \] a1 \[\^094237-1\]/);
  assert.match(out, /- \[ \] b1 \[\^094237-2\]/);
  assert.match(out, /^\[\^094237-1\]: first reason$/m);
  assert.match(out, /^\[\^094237-2\]: second reason$/m);
});

test("renders unparsed callout when present", () => {
  const scan: ScanResult = {
    items: [{ text: "x", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: ["arrow in upper-right", "faint text near bottom"],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /> \[!note\]- Unparsed/);
  assert.match(out, /> - arrow in upper-right/);
  assert.match(out, /> - faint text near bottom/);
});

test("omits unparsed callout when empty", () => {
  const scan: ScanResult = {
    items: [{ text: "x", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.doesNotMatch(out, /\[!note\]/);
});

test("omits footnote definitions block when no inferences", () => {
  const scan: ScanResult = {
    items: [{ text: "x", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.doesNotMatch(out, /^\[\^/m);
});

test("renders only unparsed callout when items is empty", () => {
  const scan: ScanResult = {
    items: [],
    inferredGroups: [],
    unparsed: ["something"],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /> \[!note\]- Unparsed/);
  assert.doesNotMatch(out, /^- \[/m);
});

test("renders deeply nested children with correct indent depth", () => {
  const scan: ScanResult = {
    items: [
      {
        text: "L0",
        status: "open",
        children: [
          {
            text: "L1",
            status: "open",
            children: [
              { text: "L2", status: "open", children: [] },
            ],
          },
        ],
      },
    ],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(9, 42, 37));
  assert.match(out, /- \[ \] L0\n {4}- \[ \] L1\n {8}- \[ \] L2/);
});

test("zero-pads single-digit hours and minutes in heading", () => {
  const scan: ScanResult = {
    items: [{ text: "x", status: "open", children: [] }],
    inferredGroups: [],
    unparsed: [],
  };
  const out = renderScanBlock(scan, "attachments/img.jpg", ts(7, 5, 9));
  assert.match(out, /^## 07:05$/m);
});
