import { test } from "node:test";
import assert from "node:assert/strict";
import { ImageConsentModal, ScanModal } from "../src/modal";
import { IrisSettingTab } from "../src/settings";
import { appendScan } from "../src/file";
import type { ScanResult } from "../src/types";
import { scanWhiteboard } from "../src/api";
import type { ProviderRequestSnapshot } from "../src/request";
import * as Obsidian from "obsidian";
import { Platform, SecretComponent } from "obsidian";

const setRequestUrlHandler = (Obsidian as any).setRequestUrlHandler as (handler: (request: any) => any) => void;

const app = {} as any;
const find = (root: any, tag: string): any => {
  if (root.tagName === tag.toUpperCase()) return root;
  for (const child of root.children ?? []) { const hit = find(child, tag); if (hit) return hit; }
  return undefined;
};
const imageFile = () => new File(["pixels"], "board.png", { type: "image/png" });

test("shipped request path uses the frozen provider model and fixed provider endpoint", async () => {
  let call: any;
  setRequestUrlHandler(async (request) => { call = request; return { status: 200, json: { choices: [{ message: { content: JSON.stringify({ items: [], inferredGroups: [], unparsed: ["note"] }) } }] } }; });
  const snapshot: ProviderRequestSnapshot = Object.freeze({ provider: "openai", model: "frozen-model", secretId: "openai-secret", apiKey: "frozen-key" });
  await scanWhiteboard("image-data", "image/jpeg", snapshot);
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  const body = JSON.parse(call.body);
  assert.equal(body.model, "frozen-model");
  assert.match(body.messages[1].content[0].image_url.url, /^data:image\/jpeg;base64,image-data$/);
});
test("shipped ScanModal freezes provider snapshot shared by consent and request dispatch", async () => {
  const seen: string[] = [];
  const snapshot: ProviderRequestSnapshot = Object.freeze({ provider: "openai", model: "gpt", secretId: "o", apiKey: "key" });
  const modal = new ScanModal(app, async (_image, request) => { seen.push(`scan:${request?.provider}:${request?.model}:${request?.secretId}`); }, "anthropic", async (provider, request) => { seen.push(`consent:${provider}:${request?.provider}`); return true; }, () => snapshot);
  modal.open();
  (modal as any).acceptFile(imageFile());
  await find(modal.contentEl, "button").click();
  await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, ["consent:openai:openai", "scan:openai:gpt:o"]);
    assert.equal(((modal as any).modalEl.listeners.paste ?? []).length, 0);
});

test("shipped ScanModal registers paste, revokes preview URLs on redraw and close, and activates dropzone by keyboard", () => {
  const revoked: string[] = [];
  const originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = ((url: string) => revoked.push(url)) as typeof URL.revokeObjectURL;
  try {
    Platform.isMobile = false;
    const modal = new ScanModal(app, async () => undefined);
    modal.open();
    assert.equal(((modal as any).modalEl.listeners.paste ?? []).length, 1);
    const zone = (modal.contentEl as any).children[0];
    assert.equal(zone.getAttribute("role"), "button");
    assert.equal(zone.getAttribute("tabindex"), "0");
    assert.match(zone.getAttribute("aria-label"), /choose an image/i);
    zone.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    zone.dispatchEvent({ type: "keydown", key: " ", preventDefault() {} });
    (modal as any).acceptFile(imageFile());
    const first = (modal as any).previewUrl;
    (modal as any).renderEmpty();
    modal.close();
    assert.ok(revoked.includes(first));
    assert.equal(((modal as any).modalEl.listeners.paste ?? []).length, 0);
  } finally { URL.revokeObjectURL = originalRevoke; }
});

test("shipped ImageConsentModal settles Send, Cancel, and programmatic close exactly once", async () => {
  const send = new ImageConsentModal(app, "openai");
  const sendResult = send.ask();
  const sendButtons = send.contentEl.querySelectorAll("button");
  (sendButtons[1] as any).dispatchEvent({ type: "click" });
  assert.equal(await sendResult, true);
  const cancel = new ImageConsentModal(app, "anthropic");
  const cancelResult = cancel.ask();
  cancel.close(); cancel.close();
  assert.equal(await cancelResult, false);
});

test("shipped settings API-key callback cannot write another provider slot after switch", async () => {
  const saves: number[] = [];
  const plugin: any = { settings: { provider: "anthropic", anthropicApiKeySecretId: "a", openAIApiKeySecretId: "o", modelOverride: "", outputFolder: "Iris", consentedProviders: [] }, saveSettings: async () => saves.push(1) };
  const tab = new IrisSettingTab(app, plugin);
  tab.display();
  const firstSecret = (SecretComponent as any).instances.at(-1);
  assert.equal(typeof firstSecret.change, "function");
  plugin.settings.provider = "openai";
  await firstSecret.change("wrong-slot");
  assert.equal(plugin.settings.anthropicApiKeySecretId, "a");
  assert.equal(plugin.settings.openAIApiKeySecretId, "o");
  assert.equal(saves.length, 0);
});

const scan: ScanResult = { items: [], inferredGroups: [], unparsed: ["recognized"] };
const timestamp = new Date(2026, 7, 28, 12, 34, 56);

class TestVault {
  files = new Map<string, any>();
  contents = new Map<string, string>();
  createFailures = 0;
  processFailures = 0;
  deleteFailures = 0;
  deleted: string[] = [];
  getAbstractFileByPath(path: string) { return this.files.get(path); }
  async createFolder(path: string) { this.files.set(path, new (Obsidian as any).TFolder(path)); }
  async createBinary(path: string, _bytes: ArrayBuffer) {
    this.files.set(path, new (Obsidian as any).TFile(path));
  }
  async create(path: string, data: string) {
    if (this.createFailures) throw new Error("note create failed");
    const file = new (Obsidian as any).TFile(path); this.files.set(path, file); this.contents.set(path, data); return file;
  }
  async process(file: any, fn: (data: string) => string) {
    if (this.processFailures) throw new Error("note process failed");
    this.contents.set(file.path, fn(this.contents.get(file.path) ?? ""));
    return file;
  }
  async delete(file: any) {
    if (this.deleteFailures) throw new Error("rollback delete failed");
    this.deleted.push(file.path); this.files.delete(file.path);
  }
}

function seededVault() {
  const vault = new TestVault();
  vault.files.set("Iris/attachments/2026-08-28-123456.jpg", new (Obsidian as any).TFile("Iris/attachments/2026-08-28-123456.jpg"));
  vault.files.set("Iris/attachments/2026-08-28-123456-2.jpg", new (Obsidian as any).TFile("Iris/attachments/2026-08-28-123456-2.jpg"));
  return vault;
}

test("shipped appendScan rolls back only its new attachment when note creation fails", async () => {
  const vault = new TestVault(); vault.createFailures = 1;
  await assert.rejects(() => appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp), /note create failed/);
  assert.deepEqual(vault.deleted, ["Iris/attachments/2026-08-28-123456.jpg"]);
});

test("shipped appendScan rolls back only its new attachment when note processing fails", async () => {
  const vault = new TestVault(); vault.processFailures = 1;
  vault.files.set("Iris/2026-08-28.md", new (Obsidian as any).TFile("Iris/2026-08-28.md"));
  await assert.rejects(() => appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp), /note process failed/);
  assert.deepEqual(vault.deleted, ["Iris/attachments/2026-08-28-123456.jpg"]);
});

test("shipped appendScan preserves pre-existing collisions while removing its suffixed attachment", async () => {
  const vault = seededVault(); vault.createFailures = 1;
  await assert.rejects(() => appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp), /note create failed/);
  assert.deepEqual(vault.deleted, ["Iris/attachments/2026-08-28-123456-3.jpg"]);
  assert.ok(vault.files.has("Iris/attachments/2026-08-28-123456.jpg"));
  assert.ok(vault.files.has("Iris/attachments/2026-08-28-123456-2.jpg"));
});

test("shipped appendScan reports rollback deletion failure without deleting unrelated files", async () => {
  const vault = seededVault(); vault.createFailures = 1; vault.deleteFailures = 1;
  await assert.rejects(() => appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp), /rollback delete failed/);
  assert.deepEqual(vault.deleted, []);
  assert.ok(vault.files.has("Iris/attachments/2026-08-28-123456.jpg"));
  assert.ok(vault.files.has("Iris/attachments/2026-08-28-123456-2.jpg"));
});

test("shipped appendScan creates a note, attachment, collision suffix, and output folders on success", async () => {
  const vault = seededVault();
  const file = await appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp);
  assert.equal(file.path, "Iris/2026-08-28.md");
  assert.ok(vault.files.has("Iris/attachments/2026-08-28-123456-3.jpg"));
  assert.ok(vault.files.has("Iris"));
  assert.ok(vault.files.has("Iris/attachments"));
  assert.match(vault.contents.get("Iris/2026-08-28.md") ?? "", /\[whiteboard scan\]\(attachments\/2026-08-28-123456-3\.jpg\)/);
  assert.match(vault.contents.get("Iris/2026-08-28.md") ?? "", /> \[!note\]- Unparsed/);
});

test("shipped appendScan rejects an output path that is a file before creating attachments", async () => {
  const vault = new TestVault();
  vault.files.set("Iris", new (Obsidian as any).TFile("Iris"));
  await assert.rejects(() => appendScan(vault as any, "Iris", scan, new ArrayBuffer(1), timestamp), /is not a folder/);
  assert.deepEqual(vault.deleted, []);
  assert.equal(vault.files.size, 1);
});

test("shipped settings output callback preserves prior state and notices empty, invalid, and non-string values", async () => {
  const notices = (Obsidian as any).Notice.messages as string[];
  const plugin: any = { settings: { provider: "anthropic", anthropicApiKeySecretId: "", openAIApiKeySecretId: "", modelOverride: "", outputFolder: "Existing", consentedProviders: [] }, saveSettings: async () => { throw new Error("must not save invalid output"); } };
  const tab = new IrisSettingTab(app, plugin); tab.display();
  const output = (Obsidian as any).Setting.instances.at(-1).text;
  for (const value of ["", "../outside", null]) { await output.change(value); assert.equal(plugin.settings.outputFolder, "Existing"); }
  assert.equal(notices.slice(-3).length, 3);
  assert.ok(notices.slice(-3).every((message) => /valid output folder/i.test(message)));
});
