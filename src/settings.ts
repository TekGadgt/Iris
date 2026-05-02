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
  apiKeySecretId: string;
  modelOverride: string;
  outputFolder: string;
}

export const DEFAULT_SETTINGS: IrisSettings = {
  provider: "anthropic",
  apiKeySecretId: "",
  modelOverride: "",
  outputFolder: "Iris",
};

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
        if (this.plugin.settings.apiKeySecretId) {
          secret.setValue(this.plugin.settings.apiKeySecretId);
        }
        secret.onChange(async (secretId) => {
          this.plugin.settings.apiKeySecretId = secretId;
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

    new Setting(containerEl).setName("Output").setHeading();

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder where day files and attachments are saved.")
      .addText((text) =>
        text
          .setPlaceholder("Iris")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
