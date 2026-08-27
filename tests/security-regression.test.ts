import { test } from "node:test";
import assert from "node:assert/strict";
import { plainText, renderScanBlock } from "../src/render";
import { validateScanResult } from "../src/validate";

test("neutralizes adversarial model text without changing its meaning into Markdown", () => {
  const hostile = "![embed](x) [link](javascript:bad) <img src=x> [[secret]] > [!warning] ^note | `code`\n```js\nrun\n```";
  const out = renderScanBlock({ items: [{ text: hostile, status: "open", children: [] }], inferredGroups: [], unparsed: [hostile] }, "attachments/x.jpg", new Date(2026, 4, 1, 9, 42));
  assert.doesNotMatch(out, /!\[/);
  assert.doesNotMatch(out, /\[link\]\(/);
  assert.match(out, /\\<img/);
  assert.doesNotMatch(out, /^```/m);
  assert.ok(out.includes("\\[\\!warning\\]"));
});

test("plainText normalizes CRLF and bounds model-controlled output", () => {
  const out = plainText("a\r\nb\n\n" + "x".repeat(1000));
  assert.ok(out.length <= 500);
  assert.doesNotMatch(out, /\r|\n/);
});

test("inferred groups require a real non-empty path and reject duplicates", () => {
  const base = { items: [{ text: "p", status: "open", children: [{ text: "c", status: "open", children: [] }] }], unparsed: [] };
  assert.throws(() => validateScanResult({ ...base, inferredGroups: [{ parentPath: [], reason: "x" }] }), /parentPath/);
  assert.throws(() => validateScanResult({ ...base, inferredGroups: [{ parentPath: [0], reason: "x" }, { parentPath: [0], reason: "y" }] }), /duplicate/);
  assert.throws(() => validateScanResult({ ...base, inferredGroups: [{ parentPath: [-1], reason: "x" }] }), /non-negative/);
  assert.throws(() => validateScanResult({ ...base, inferredGroups: [{ parentPath: [1.5], reason: "x" }] }), /non-negative/);
});
