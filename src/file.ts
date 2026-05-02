import { normalizePath, TFile, TFolder, Vault } from "obsidian";
import type { ScanResult } from "./types";
import { renderScanBlock } from "./render";
import { attachmentSlug, dateString } from "./time";

async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  const existing = vault.getAbstractFileByPath(normalized);
  if (existing instanceof TFolder) return;
  await vault.createFolder(normalized);
}

function findAvailableAttachmentPath(
  vault: Vault,
  attachmentsFolder: string,
  slug: string
): string {
  const basePath = normalizePath(`${attachmentsFolder}/${slug}.jpg`);
  if (!vault.getAbstractFileByPath(basePath)) return basePath;
  let counter = 2;
  while (true) {
    const candidate = normalizePath(`${attachmentsFolder}/${slug}-${counter}.jpg`);
    if (!vault.getAbstractFileByPath(candidate)) return candidate;
    counter++;
  }
}

function frontmatter(date: string): string {
  return ["---", `date: ${date}`, "tags:", "  - whiteboard", "---", ""].join("\n");
}

export async function appendScan(
  vault: Vault,
  outputFolder: string,
  scan: ScanResult,
  imageBytes: ArrayBuffer,
  timestamp: Date
): Promise<TFile> {
  const folder = normalizePath(outputFolder);
  const attachmentsFolder = normalizePath(`${folder}/attachments`);
  await ensureFolder(vault, folder);
  await ensureFolder(vault, attachmentsFolder);

  const slug = attachmentSlug(timestamp);
  const attachmentPath = findAvailableAttachmentPath(vault, attachmentsFolder, slug);
  await vault.createBinary(attachmentPath, imageBytes);

  const linkPath = attachmentPath.startsWith(`${folder}/`)
    ? attachmentPath.slice(folder.length + 1)
    : attachmentPath;
  const block = renderScanBlock(scan, linkPath, timestamp);

  const dateStr = dateString(timestamp);
  const dayFilePath = normalizePath(`${folder}/${dateStr}.md`);
  const existing = vault.getAbstractFileByPath(dayFilePath);

  if (!existing) {
    return await vault.create(dayFilePath, `${frontmatter(dateStr)}\n${block}\n`);
  }
  if (!(existing instanceof TFile)) {
    throw new Error(`Expected ${dayFilePath} to be a file.`);
  }
  await vault.process(existing, (data) => `${data.replace(/\n+$/, "")}\n\n---\n\n${block}\n`);
  return existing;
}
