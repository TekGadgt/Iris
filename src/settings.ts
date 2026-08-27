import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type IrisPlugin from "./main";
import type { Provider } from "./types";
import type { IrisSettingsCore } from "./settings-core";
import { normalizeOutputFolder, secretIdForProvider, DEFAULT_SETTINGS_CORE } from "./settings-core";
export { normalizeSettings, normalizeOutputFolder, secretIdForProvider } from "./settings-core";

const PROVIDER_LABELS: Record<Provider, string> = { anthropic: "Anthropic", openai: "OpenAI" };
export const DEFAULT_MODELS: Record<Provider, string> = { anthropic: "claude-sonnet-4-6", openai: "gpt-4o" };
export type IrisSettings = IrisSettingsCore;
export const DEFAULT_SETTINGS: IrisSettings = DEFAULT_SETTINGS_CORE;

export class IrisSettingTab extends PluginSettingTab {
  plugin: IrisPlugin;
  private controlGeneration = 0;

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
            this.controlGeneration++;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Your API key, stored securely in Obsidian's secret storage.")
      .addComponent((el) => {
        // Capture the provider for this DOM control so delayed callbacks cannot
        // follow a later dropdown change into another provider's secret slot.
        const providerForControl = this.plugin.settings.provider;
        const generationForControl = this.controlGeneration;
        const secret = new SecretComponent(this.app, el);
        const secretId = secretIdForProvider(this.plugin.settings, providerForControl);
        if (secretId) {
          secret.setValue(secretId);
        }
        secret.onChange(async (secretId) => {
          if (this.plugin.settings.provider !== providerForControl || this.controlGeneration !== generationForControl) return;
          if (providerForControl === "openai") this.plugin.settings.openAIApiKeySecretId = secretId;
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
            if (!normalized) {
              new Notice("Choose a valid output folder inside your vault.");
              return;
            }
            this.plugin.settings.outputFolder = normalized;
            await this.plugin.saveSettings();
          })
      );
  }
}
