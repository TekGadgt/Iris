import { App, Notice, PluginSettingTab, SecretComponent, Setting, type SettingDefinitionItem } from "obsidian";
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "API",
        items: [
          {
            name: "Provider",
            desc: "Which AI service to use for reading whiteboard photos.",
            render: (setting) => { this.addProviderControl(setting); },
          },
          {
            name: "API key",
            desc: "Your API key, stored securely in Obsidian's secret storage.",
            render: (setting) => { this.addApiKeyControl(setting); },
          },
          {
            name: "Model override",
            desc: "Leave empty to use the default model for your provider.",
            render: (setting) => { this.addModelControl(setting); },
          },
        ],
      },
      {
        type: "group",
        heading: "Privacy",
        items: [
          {
            name: "Image upload disclosure",
            desc: "Iris sends the complete selected image to the active provider for conversion. Consent is stored separately for each provider.",
            render: (setting) => { this.addPrivacyControl(setting); },
          },
        ],
      },
      {
        type: "group",
        heading: "Output",
        items: [
          {
            name: "Output folder",
            desc: "Folder where day files and attachments are saved.",
            render: (setting) => { this.addOutputFolderControl(setting); },
          },
        ],
      },
    ];
  }

  display(): void {
    this.renderLegacySettings();
  }

  private renderLegacySettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("API").setHeading();

    const providerSetting = new Setting(containerEl)
      .setName("Provider")
      .setDesc("Which AI service to use for reading whiteboard photos.");
    this.addProviderControl(providerSetting);

    const apiKeySetting = new Setting(containerEl)
      .setName("API key")
      .setDesc("Your API key, stored securely in Obsidian's secret storage.");
    this.addApiKeyControl(apiKeySetting);

    const modelSetting = new Setting(containerEl)
      .setName("Model override")
      .setDesc("Leave empty to use the default model for your provider.");
    this.addModelControl(modelSetting);

    new Setting(containerEl).setName("Privacy").setHeading();
    const privacySetting = new Setting(containerEl)
      .setName("Image upload disclosure")
      .setDesc("Iris sends the complete selected image to the active provider for conversion. Consent is stored separately for each provider.");
    this.addPrivacyControl(privacySetting);

    new Setting(containerEl).setName("Output").setHeading();

    const outputSetting = new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder where day files and attachments are saved.");
    this.addOutputFolderControl(outputSetting);
  }

  private addProviderControl(setting: Setting): void {
    setting.addDropdown((dropdown) => {
      for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
        dropdown.addOption(value, label);
      }
      dropdown
        .setValue(this.plugin.settings.provider)
        .onChange(async (value) => {
          this.plugin.settings.provider = value as Provider;
          this.controlGeneration++;
          await this.plugin.saveSettings();
          const update = Reflect.get(this, "update") as unknown;
          if (typeof update === "function") update.call(this);
          else this.renderLegacySettings();
        });
    });
  }

  private addApiKeyControl(setting: Setting): void {
    setting.addComponent((el) => {
      // Capture the provider for this DOM control so delayed callbacks cannot
      // follow a later dropdown change into another provider's secret slot.
      const providerForControl = this.plugin.settings.provider;
      const generationForControl = this.controlGeneration;
      const secret = new SecretComponent(this.app, el);
      const secretId = secretIdForProvider(this.plugin.settings, providerForControl);
      if (secretId) secret.setValue(secretId);
      secret.onChange(async (secretId) => {
        if (this.plugin.settings.provider !== providerForControl || this.controlGeneration !== generationForControl) return;
        if (providerForControl === "openai") this.plugin.settings.openAIApiKeySecretId = secretId;
        else this.plugin.settings.anthropicApiKeySecretId = secretId;
        await this.plugin.saveSettings();
      });
      return secret;
    });
  }

  private addModelControl(setting: Setting): void {
    const defaultModel = DEFAULT_MODELS[this.plugin.settings.provider];
    setting.addText((text) =>
      text
        .setPlaceholder(defaultModel)
        .setValue(this.plugin.settings.modelOverride)
        .onChange(async (value) => {
          this.plugin.settings.modelOverride = value;
          await this.plugin.saveSettings();
        })
    );
  }

  private addPrivacyControl(setting: Setting): void {
    setting.addButton((button) => button.setButtonText("Reset confirmations").onClick(async () => {
      this.plugin.settings.consentedProviders = [];
      await this.plugin.saveSettings();
    }));
  }

  private addOutputFolderControl(setting: Setting): void {
    setting.addText((text) =>
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
