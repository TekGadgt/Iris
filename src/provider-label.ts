import type { Provider } from "./types";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export function providerDisplayName(provider: Provider): string {
  return PROVIDER_LABELS[provider];
}
