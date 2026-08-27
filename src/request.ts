import type { Provider } from "./types";

export interface ProviderRequestSnapshot {
  readonly provider: Provider;
  readonly model: string;
  readonly secretId: string;
  readonly apiKey: string;
}

export async function dispatchWithConsent<T>(
  resolveSnapshot: () => ProviderRequestSnapshot,
  requestConsent: (snapshot: ProviderRequestSnapshot) => Promise<boolean>,
  dispatch: (snapshot: ProviderRequestSnapshot) => Promise<T>,
): Promise<T | undefined> {
  const snapshot = Object.freeze(resolveSnapshot());
  if (!(await requestConsent(snapshot))) return undefined;
  return dispatch(snapshot);
}
