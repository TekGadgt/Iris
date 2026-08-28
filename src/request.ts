import type { Provider } from "./types";

export interface ProviderRequestSnapshot {
  readonly provider: Provider;
  readonly model: string;
  readonly secretId: string;
  readonly apiKey: string;
}
