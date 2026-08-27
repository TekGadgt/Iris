import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type IrisPlugin from "./main";
import type { Provider } from "./types";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};

export interface IrisSettings {
  provider: Provider;
  anthropicApiKeySecretId: string;
  openAIApiKeySecretId: string;
  modelOverride: string;
  outputFolder: string;
  consentedProviders: Provider[];
}

export const DEFAULT_SETTINGS: IrisSettings = {
  provider: "anthropic",
  anthropicApiKeySecretId: "",
  openAIApiKeySecretId: "",
  modelOverride: "",
  outputFolder: "Iris",
  consentedProviders: [],
};

export function normalizeSettings(data: unknown): IrisSettings {
  const saved = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const provider: Provider = saved.provider === "openai" || saved.provider === "anthropic"
    ? saved.provider : DEFAULT_SETTINGS.provider;
  const legacy = typeof saved.apiKeySecretId === "string" ? saved.apiKeySecretId : "";
  const anthropicApiKeySecretId = typeof saved.anthropicApiKeySecretId === "string"
    ? saved.anthropicApiKeySecretId : provider === "anthropic" ? legacy : "";
  const openAIApiKeySecretId = typeof saved.openAIApiKeySecretId === "string"
    ? saved.openAIApiKeySecretId : provider === "openai" ? legacy : "";
  const modelOverride = typeof saved.modelOverride === "string" ? saved.modelOverride.trim() : "";
  const outputFolder = normalizeOutputFolder(saved.outputFolder);
  const consentedProviders = Array.isArray(saved.consentedProviders)
    ? saved.consentedProviders.filter((p): p is Provider => p === "anthropic" || p === "openai")
    : [];
  return { provider, anthropicApiKeySecretId, openAIApiKeySecretId,
    modelOverride: modelOverride || "", outputFolder: outputFolder || DEFAULT_SETTINGS.outputFolder,
    consentedProviders: [...new Set(consentedProviders)] };
}

export function normalizeOutputFolder(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === ".." || new Set(["[", "]", "#", "|", "^"]).has(part))) return "";
  return normalized;
}

export function secretIdForProvider(settings: IrisSettings, provider: Provider): string {
  return provider === "openai" ? settings.openAIApiKeySecretId : settings.anthropicApiKeySecretId;
}

export class IrisSettingTab extends PluginSettingTab {
  plugin: IrisPlugin;

  constructor(app: App, plugin: IrisPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("API").setHeading();

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Which AI service to use for reading whiteboard photos.")
      .addDropdown((dropdown) => {
        for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
          dropdown.addOption(value, label);
        }
        dropdown
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value as Provider;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Your API key, stored securely in Obsidian's secret storage.")
      .addComponent((el) => {
        const secret = new SecretComponent(this.app, el);
        const secretId = secretIdForProvider(this.plugin.settings, this.plugin.settings.provider);
        if (secretId) {
          secret.setValue(secretId);
        }
        secret.onChange(async (secretId) => {
          if (this.plugin.settings.provider === "openai") this.plugin.settings.openAIApiKeySecretId = secretId;
          else this.plugin.settings.anthropicApiKeySecretId = secretId;
          await this.plugin.saveSettings();
        });
        return secret;
      });

    const defaultModel = DEFAULT_MODELS[this.plugin.settings.provider];

    new Setting(containerEl)
      .setName("Model override")
      .setDesc("Leave empty to use the default model for your provider.")
      .addText((text) =>
        text
          .setPlaceholder(defaultModel)
          .setValue(this.plugin.settings.modelOverride)
          .onChange(async (value) => {
            this.plugin.settings.modelOverride = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Privacy").setHeading();
    new Setting(containerEl)
      .setName("Image upload disclosure")
      .setDesc("Iris sends the complete selected image to the active provider for conversion. Consent is stored separately for each provider.")
      .addButton((button) => button.setButtonText("Reset confirmations").onClick(async () => {
        this.plugin.settings.consentedProviders = [];
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl).setName("Output").setHeading();

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder where day files and attachments are saved.")
      .addText((text) =>
        text
          .setPlaceholder("Iris")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            const normalized = normalizeOutputFolder(value);
            if (!normalized) return;
            this.plugin.settings.outputFolder = normalized;
            await this.plugin.saveSettings();
          })
      );
  }
}
