import type { Provider } from "./types";

export interface IrisSettingsCore {
  provider: Provider;
  anthropicApiKeySecretId: string;
  openAIApiKeySecretId: string;
  modelOverride: string;
  outputFolder: string;
  consentedProviders: Provider[];
}

export const DEFAULT_SETTINGS_CORE: IrisSettingsCore = {
  provider: "anthropic", anthropicApiKeySecretId: "", openAIApiKeySecretId: "",
  modelOverride: "", outputFolder: "Iris", consentedProviders: [],
};

export function normalizeOutputFolder(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === ".." || new Set(["[", "]", "#", "|", "^"]).has(part))) return "";
  return normalized;
}

export function normalizeSettings(data: unknown): IrisSettingsCore {
  const saved = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const provider: Provider = saved.provider === "openai" || saved.provider === "anthropic" ? saved.provider : DEFAULT_SETTINGS_CORE.provider;
  const legacy = typeof saved.apiKeySecretId === "string" ? saved.apiKeySecretId : "";
  const anthropicApiKeySecretId = typeof saved.anthropicApiKeySecretId === "string" ? saved.anthropicApiKeySecretId : provider === "anthropic" ? legacy : "";
  const openAIApiKeySecretId = typeof saved.openAIApiKeySecretId === "string" ? saved.openAIApiKeySecretId : provider === "openai" ? legacy : "";
  const modelOverride = typeof saved.modelOverride === "string" ? saved.modelOverride.trim() : "";
  const outputFolder = normalizeOutputFolder(saved.outputFolder);
  const consentedProviders = Array.isArray(saved.consentedProviders) ? saved.consentedProviders.filter((p): p is Provider => p === "anthropic" || p === "openai") : [];
  return { provider, anthropicApiKeySecretId, openAIApiKeySecretId, modelOverride: modelOverride || "", outputFolder: outputFolder || DEFAULT_SETTINGS_CORE.outputFolder, consentedProviders: [...new Set(consentedProviders)] };
}

export function secretIdForProvider(settings: IrisSettingsCore, provider: Provider): string {
  return provider === "openai" ? settings.openAIApiKeySecretId : settings.anthropicApiKeySecretId;
}
