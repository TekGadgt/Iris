import { normalizePath, TFile, TFolder, Vault, type FileManager } from "obsidian";
import type { ScanResult } from "./types";
import { renderScanBlock } from "./render";
import { attachmentSlug, dateString } from "./time";
import { normalizeOutputFolder } from "./settings";

async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  const existing = vault.getAbstractFileByPath(normalized);
  if (existing instanceof TFolder) return;
  if (existing) throw new Error(`Output path ${normalized} is not a folder.`);
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
  fileManager: FileManager,
  outputFolder: string,
  scan: ScanResult,
  imageBytes: ArrayBuffer,
  timestamp: Date
): Promise<TFile> {
  const folderValue = normalizeOutputFolder(outputFolder);
  if (!folderValue) throw new Error("Choose a valid, non-empty output folder in Iris settings.");
  const folder = normalizePath(folderValue);
  const attachmentsFolder = normalizePath(`${folder}/attachments`);
  await ensureFolder(vault, folder);
  await ensureFolder(vault, attachmentsFolder);

  const slug = attachmentSlug(timestamp);
  const attachmentPath = findAvailableAttachmentPath(vault, attachmentsFolder, slug);
  await vault.createBinary(attachmentPath, imageBytes);
  try {
    const linkPath = attachmentPath.startsWith(`${folder}/`)
      ? attachmentPath.slice(folder.length + 1) : attachmentPath;
    const block = renderScanBlock(scan, linkPath, timestamp);
    const dateStr = dateString(timestamp);
    const dayFilePath = normalizePath(`${folder}/${dateStr}.md`);
    const existing = vault.getAbstractFileByPath(dayFilePath);
    if (!existing) return await vault.create(dayFilePath, `${frontmatter(dateStr)}\n${block}\n`);
    if (!(existing instanceof TFile)) throw new Error(`Expected ${dayFilePath} to be a file.`);
    await vault.process(existing, (data) => `${data.replace(/\n+$/, "")}\n\n---\n\n${block}\n`);
    return existing;
  } catch (error) {
    const attachment = vault.getAbstractFileByPath(attachmentPath);
    // Roll back only the attachment created by this invocation while honoring
    // the user's configured file deletion preference.
    if (attachment instanceof TFile) await fileManager.trashFile(attachment);
    throw error;
  }
}
