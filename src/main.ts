import { Notice, Plugin } from "obsidian";
import {
  IrisSettings,
  IrisSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";
import { scanWhiteboard, ApiCallError } from "./api";
import { ScanValidationError } from "./validate";
import { appendScan } from "./file";
import { ScanModal } from "./modal";

export default class IrisPlugin extends Plugin {
  settings: IrisSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "scan-whiteboard",
      name: "Scan whiteboard",
      callback: () => this.openScanModal(),
    });

    this.addRibbonIcon("scan-eye", "Scan whiteboard", () => {
      this.openScanModal();
    });

    this.addSettingTab(new IrisSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<IrisSettings> | null
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getApiKey(): string {
    if (!this.settings.apiKeySecretId) return "";
    return this.app.secretStorage.getSecret(this.settings.apiKeySecretId) ?? "";
  }

  private openScanModal(): void {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      new Notice("Set your Iris API key in settings.");
      return;
    }
    const modal = new ScanModal(this.app, async (image) => {
      try {
        const scan = await scanWhiteboard(
          image.base64,
          image.mediaType,
          this.settings,
          apiKey
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
          throw new Error(err.message);
        }
        if (err instanceof ScanValidationError) {
          new Notice(
            "Iris received an unexpected response. Try again — and please report if this keeps happening."
          );
          console.error("Iris schema validation failed:", err);
          throw new Error("Unexpected response from the model.");
        }
        throw err;
      }
    });
    modal.open();
  }
}
