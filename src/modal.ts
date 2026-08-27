import { App, Modal, Platform } from "obsidian";
import type { Provider } from "./types";

const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export interface PreparedImage {
  base64: string;        // no "data:..." prefix
  mediaType: "image/jpeg";
  bytes: ArrayBuffer;    // re-encoded JPEG
}

export type ScanCallback = (image: PreparedImage) => Promise<void>;
export type ConsentCallback = (provider: Provider) => Promise<boolean>;

export class ImageConsentModal extends Modal {
  private provider: Provider;
  private resolveConsent: (value: boolean) => void = () => undefined;
  constructor(app: App, provider: Provider) { super(app); this.provider = provider; }
  ask(): Promise<boolean> {
    return new Promise((resolve) => { this.resolveConsent = resolve; this.open(); });
  }
  onOpen(): void {
    const name = this.provider === "openai" ? "OpenAI" : "Anthropic";
    this.titleEl.setText("Confirm image upload");
    this.contentEl.createEl("p", { text: `The complete selected image will be sent to ${name} for conversion.` });
    this.contentEl.createEl("p", { text: "Review the provider's privacy and data controls before sending." });
    const link = this.contentEl.createEl("a", { text: "Privacy and data controls", href: this.provider === "openai" ? "https://openai.com/policies/how-your-data-is-used-to-improve-model-performance" : "https://www.anthropic.com/legal/commercial-terms" });
    link.setAttr("target", "_blank");
    const buttons = this.contentEl.createDiv({ cls: "iris-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    const send = buttons.createEl("button", { text: "Send" }); send.addClass("mod-cta");
    cancel.addEventListener("click", () => { this.resolveConsent(false); this.close(); });
    send.addEventListener("click", () => { this.resolveConsent(true); this.close(); });
  }
  onClose(): void { this.contentEl.empty(); }
}

async function downscaleToJpeg(file: File | Blob): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image."));
      i.src = url;
    });
    const longest = Math.max(img.width, img.height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed."))),
        "image/jpeg",
        JPEG_QUALITY
      );
    });
    const bytes = await blob.arrayBuffer();
    const base64 = bufferToBase64(bytes);
    return { base64, mediaType: "image/jpeg", bytes };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class ScanModal extends Modal {
  private onScan: ScanCallback;
  private currentBlob: Blob | null = null;
  private previewUrl: string | null = null;
  private onConsent: ConsentCallback;
  private provider: Provider;

  constructor(app: App, onScan: ScanCallback, provider: Provider = "anthropic", onConsent: ConsentCallback = async () => true) {
    super(app);
    this.onScan = onScan;
    this.provider = provider;
    this.onConsent = onConsent;
  }

  onOpen(): void {
    this.titleEl.setText("Scan whiteboard");
    this.contentEl.addClass("iris-modal");
    this.renderEmpty();
    this.modalEl.addEventListener("paste", this.handlePaste);
  }

  onClose(): void {

    this.clearPreviewUrl();
    this.contentEl.empty();
    this.currentBlob = null;
  }

  private clearPreviewUrl(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  private handlePaste = (e: ClipboardEvent): void => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          this.acceptFile(file);
          return;
        }
      }
    }
  };

  private renderEmpty(): void {
    this.clearPreviewUrl();
    this.contentEl.empty();
    if (Platform.isMobile) {
      this.renderMobileButtons();
    } else {
      this.renderDesktopDropzone();
    }
    const footer = this.contentEl.createDiv({ cls: "iris-footer" });
    footer.setText("Supported image files: jpg, png, webp, and gif");
  }

  private renderMobileButtons(): void {
    const wrap = this.contentEl.createDiv({ cls: "iris-modal-buttons" });

    const takeBtn = wrap.createEl("button", { text: "Take photo" });
    takeBtn.addClass("mod-cta");
    const takeInput = wrap.createEl("input", { type: "file" });
    takeInput.accept = "image/*";
    takeInput.setAttr("capture", "environment");
    takeInput.addClass("iris-hidden");
    takeBtn.addEventListener("click", () => takeInput.click());
    takeInput.addEventListener("change", () => {
      const file = takeInput.files?.[0];
      if (file) this.acceptFile(file);
    });

    const chooseBtn = wrap.createEl("button", { text: "Choose from files" });
    const chooseInput = wrap.createEl("input", { type: "file" });
    chooseInput.accept = "image/*";
    chooseInput.addClass("iris-hidden");
    chooseBtn.addEventListener("click", () => chooseInput.click());
    chooseInput.addEventListener("change", () => {
      const file = chooseInput.files?.[0];
      if (file) this.acceptFile(file);
    });
  }

  private renderDesktopDropzone(): void {
    const dz = this.contentEl.createDiv({ cls: "iris-dropzone" });
    dz.setAttr("role", "button");
    dz.setAttr("tabindex", "0");
    dz.setAttr("aria-label", "Drop image, paste, or choose an image file");
    dz.setText("Drop image, paste, or click to choose");
    const input = dz.createEl("input", { type: "file" });
    input.accept = "image/*";
    input.addClass("iris-hidden");
    dz.addEventListener("click", () => input.click());
    dz.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) this.acceptFile(file);
    });
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.addClass("iris-dropzone-active");
    });
    dz.addEventListener("dragleave", () => dz.removeClass("iris-dropzone-active"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.removeClass("iris-dropzone-active");
      const file = e.dataTransfer?.files?.[0];
      if (file) this.acceptFile(file);
    });
  }

  private acceptFile(file: File): void {
    if (!ACCEPTED_TYPES.has(file.type)) {
      this.renderError(
        "Iris supports JPG, PNG, WebP, and GIF files. HEIC and other formats need conversion first."
      );
      return;
    }
    this.currentBlob = file;
    this.renderPreview(file);
  }

  private renderPreview(blob: Blob): void {
    this.clearPreviewUrl();
    this.contentEl.empty();
    const wrap = this.contentEl.createDiv({ cls: "iris-preview" });
    wrap.createEl("p", { text: `Active provider: ${this.provider}` });
    this.previewUrl = URL.createObjectURL(blob);
    const img = wrap.createEl("img");
    img.src = this.previewUrl;

    const buttons = wrap.createDiv({ cls: "iris-modal-buttons" });

    const convertBtn = buttons.createEl("button", { text: "Convert" });
    convertBtn.addClass("mod-cta");
    convertBtn.addEventListener("click", () => void this.runConvert());

    const resetBtn = buttons.createEl("button", { text: "Choose different image" });
    resetBtn.addEventListener("click", () => {
      this.currentBlob = null;
      this.renderEmpty();
    });
  }

  private renderLoading(text: string): void {
    this.clearPreviewUrl();
    this.contentEl.empty();
    const status = this.contentEl.createDiv({ cls: "iris-status" });
    status.setText(text);
  }

  private renderError(message: string): void {
    if (!this.currentBlob) {
      this.renderEmpty();
      const err = this.contentEl.createDiv({ cls: "iris-error" });
      err.setText(message);
      return;
    }
    this.renderPreview(this.currentBlob);
    const err = this.contentEl.createDiv({ cls: "iris-error" });
    err.setText(message);
  }

  private async runConvert(): Promise<void> {
    if (!this.currentBlob) return;
    try {
      const consented = await this.onConsent(this.provider);
      if (!consented) return;
      this.renderLoading("Reading whiteboard…");
      const prepared = await downscaleToJpeg(this.currentBlob);
      this.renderLoading("Saving…");
      await this.onScan(prepared);
      this.close();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      this.renderError(message);
    }
  }
}
