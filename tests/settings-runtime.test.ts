import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS_CORE as DEFAULT_SETTINGS, normalizeSettings, normalizeOutputFolder, secretIdForProvider } from "../src/settings-core";

test("provider settings retain isolated secret IDs and consent decisions", () => {
  const settings = normalizeSettings({
    provider: "openai",
    anthropicApiKeySecretId: "anthropic-secret",
    openAIApiKeySecretId: "openai-secret",
    consentedProviders: ["openai", "openai", "anthropic"],
  });
  assert.equal(secretIdForProvider(settings, "anthropic"), "anthropic-secret");
  assert.equal(secretIdForProvider(settings, "openai"), "openai-secret");
  assert.deepEqual(settings.consentedProviders, ["openai", "anthropic"]);
  assert.deepEqual(normalizeSettings({ ...settings, consentedProviders: [] }).consentedProviders, []);
});

test("invalid output folder input is rejected without changing the stored value", () => {
  assert.equal(normalizeOutputFolder("../outside"), "");
  assert.equal(normalizeOutputFolder("["), "");
  assert.equal(normalizeSettings({ outputFolder: "../outside" }).outputFolder, DEFAULT_SETTINGS.outputFolder);
  assert.equal(normalizeSettings({ outputFolder: "Projects/Iris" }).outputFolder, "Projects/Iris");
});
