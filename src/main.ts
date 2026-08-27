import { Notice, Plugin } from "obsidian";
import {
  IrisSettings,
  IrisSettingTab,
  DEFAULT_SETTINGS,
  normalizeSettings,
  secretIdForProvider,
} from "./settings";
import { scanWhiteboard, ApiCallError } from "./api";
import { ScanValidationError } from "./validate";
import { appendScan } from "./file";
import { ImageConsentModal, ScanModal } from "./modal";

export default class IrisPlugin extends Plugin {
  settings: IrisSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "scan-whiteboard",
      name: "Scan whiteboard",
      checkCallback: (checking: boolean) => {
        if (!this.getApiKey()) return false;
        if (!checking) this.openScanModal();
        return true;
      },
    });

    this.addRibbonIcon("scan-eye", "Scan whiteboard", () => {
      this.openScanModal();
    });

    this.addSettingTab(new IrisSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getApiKey(): string {
    const secretId = secretIdForProvider(this.settings, this.settings.provider);
    if (!secretId) return "";
    return this.app.secretStorage.getSecret(secretId) ?? "";
  }

  private openScanModal(): void {
    const provider = this.settings.provider;
    const secretId = secretIdForProvider(this.settings, provider);
    const apiKey = secretId ? this.app.secretStorage.getSecret(secretId) ?? "" : "";
    if (!apiKey) {
      new Notice("Set your API key in Iris settings.");
      return;
    }
    const modal = new ScanModal(this.app, async (image) => {
      try {
        const scan = await scanWhiteboard(
          image.base64,
          image.mediaType,
          { provider, model: this.settings.modelOverride, secretId, apiKey }
        );
        if (
          scan.items.length === 0 &&
          scan.unparsed.length === 0
        ) {
          throw new Error(
            "Nothing detected on the whiteboard. Try a clearer photo or different angle."
          );
        }
        const file = await appendScan(
          this.app.vault,
          this.settings.outputFolder,
          scan,
          image.bytes,
          new Date()
        );
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, { state: { mode: "source" } });
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 401) {
            new Notice("Invalid API key. Check your settings.");
            throw new Error("Invalid API key.");
          }
          if (err.status === 429) {
            new Notice("Rate limited. Try again in a moment.");
            throw new Error("Rate limited.");
          }
          if (err.status === 400) {
            throw new Error("This image couldn't be read. Try a different photo.");
          }
          throw err;
        }
        if (err instanceof ScanValidationError) {
          new Notice("Iris received an unexpected response. Try again — and please report if this keeps happening.");
          throw new Error("Unexpected response from the model.");
        }
        throw err;
      }
    }, provider, async (selectedProvider) => {
      if (this.settings.consentedProviders.includes(selectedProvider)) return true;
      const confirmed = await new ImageConsentModal(this.app, selectedProvider).ask();
      if (confirmed) {
        this.settings.consentedProviders = [...new Set([...this.settings.consentedProviders, selectedProvider])];
        await this.saveSettings();
      }
      return confirmed;
    });
    modal.open();
  }
}
