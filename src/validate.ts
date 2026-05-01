import type { ScanResult, TodoItem, InferredGroup, TodoStatus } from "./types";

export class ScanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanValidationError";
  }
}

const STATUSES: ReadonlyArray<TodoStatus> = ["open", "done"];

function fail(message: string): never {
  throw new ScanValidationError(message);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateTodoItem(v: unknown, path: string): TodoItem {
  if (!isObject(v)) fail(`${path}: not an object`);
  if (typeof v.text !== "string") fail(`${path}.text: not a string`);
  if (typeof v.status !== "string" || !STATUSES.includes(v.status as TodoStatus)) {
    fail(`${path}.status: invalid status`);
  }
  if (!Array.isArray(v.children)) fail(`${path}.children: not an array`);
  const children = (v.children as unknown[]).map((c, i) =>
    validateTodoItem(c, `${path}.children[${i}]`)
  );
  return { text: v.text as string, status: v.status as TodoStatus, children };
}

function nodeAtPath(items: TodoItem[], path: number[]): TodoItem | undefined {
  if (path.length === 0) return undefined;
  let node: TodoItem | undefined = items[path[0]];
  for (let i = 1; i < path.length && node; i++) {
    node = node.children[path[i]];
  }
  return node;
}

function validateInferredGroup(
  v: unknown,
  items: TodoItem[],
  path: string
): InferredGroup {
  if (!isObject(v)) fail(`${path}: not an object`);
  if (!Array.isArray(v.parentPath) || v.parentPath.some((n) => typeof n !== "number")) {
    fail(`${path}.parentPath: must be an array of numbers`);
  }
  if (typeof v.reason !== "string") fail(`${path}.reason: not a string`);
  const parentPath = v.parentPath as number[];
  const node = nodeAtPath(items, parentPath);
  if (!node) fail(`${path}.parentPath: out of range`);
  if (node.children.length === 0) {
    fail(`${path}.parentPath: resolves to a node with no children`);
  }
  return { parentPath, reason: v.reason as string };
}

export function validateScanResult(v: unknown): ScanResult {
  if (!isObject(v)) fail("ScanResult: not an object");
  if (!Array.isArray(v.items)) fail("ScanResult.items: not an array");
  if (!Array.isArray(v.inferredGroups)) fail("ScanResult.inferredGroups: not an array");
  if (!Array.isArray(v.unparsed)) fail("ScanResult.unparsed: not an array");
  if ((v.unparsed as unknown[]).some((u) => typeof u !== "string")) {
    fail("ScanResult.unparsed: entries must be strings");
  }
  const items = (v.items as unknown[]).map((i, idx) => validateTodoItem(i, `items[${idx}]`));
  const inferredGroups = (v.inferredGroups as unknown[]).map((g, idx) =>
    validateInferredGroup(g, items, `inferredGroups[${idx}]`)
  );
  return { items, inferredGroups, unparsed: v.unparsed as string[] };
}
