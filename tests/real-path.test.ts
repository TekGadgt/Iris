import { test } from "node:test";
import assert from "node:assert/strict";
import { ImageConsentModal, ScanModal } from "../src/modal";
import { IrisSettingTab } from "../src/settings";
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
