import type { ScanResult, TodoItem } from "./types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function timeString(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timestampSlug(d: Date): string {
  return `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function pathKey(path: number[]): string {
  return path.join(".");
}

function renderItem(
  item: TodoItem,
  path: number[],
  footnoteForParent: Map<string, string>,
  depth: number,
  out: string[]
): void {
  const indent = "    ".repeat(depth);
  const checkbox = item.status === "done" ? "[x]" : "[ ]";
  const parentKey = pathKey(path.slice(0, -1));
  const fnId = path.length > 1 ? footnoteForParent.get(parentKey) : undefined;
  const marker = fnId ? ` [^${fnId}]` : "";
  out.push(`${indent}- ${checkbox} ${item.text}${marker}`);
  for (let i = 0; i < item.children.length; i++) {
    renderItem(item.children[i], [...path, i], footnoteForParent, depth + 1, out);
  }
}

export function renderScanBlock(
  scan: ScanResult,
  imagePath: string,
  timestamp: Date
): string {
  const slug = timestampSlug(timestamp);

  const footnoteForParent = new Map<string, string>();
  scan.inferredGroups.forEach((g, idx) => {
    footnoteForParent.set(pathKey(g.parentPath), `${slug}-${idx + 1}`);
  });

  const lines: string[] = [];
  lines.push(`## ${timeString(timestamp)}`);
  lines.push("");
  lines.push(`[whiteboard scan](${imagePath})`);
  lines.push("");

  if (scan.items.length > 0) {
    for (let i = 0; i < scan.items.length; i++) {
      renderItem(scan.items[i], [i], footnoteForParent, 0, lines);
    }
    lines.push("");
  }

  if (scan.inferredGroups.length > 0) {
    scan.inferredGroups.forEach((g, idx) => {
      lines.push(`[^${slug}-${idx + 1}]: ${g.reason}`);
    });
    lines.push("");
  }

  if (scan.unparsed.length > 0) {
    lines.push("> [!note]- Unparsed");
    for (const u of scan.unparsed) {
      lines.push(`> - ${u}`);
    }
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
