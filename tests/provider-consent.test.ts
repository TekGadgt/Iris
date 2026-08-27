import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchWithConsent, type ProviderRequestSnapshot } from "../src/request";

test("consent and dispatch use the same immutable provider request snapshot", async () => {
  const consented: string[] = [];
  const dispatched: ProviderRequestSnapshot[] = [];
  let activeProvider: "anthropic" | "openai" = "anthropic";
  const snapshots: Record<string, ProviderRequestSnapshot> = {
    anthropic: { provider: "anthropic", model: "claude", secretId: "anthropic-secret", apiKey: "anthropic-key" },
    openai: { provider: "openai", model: "gpt", secretId: "openai-secret", apiKey: "openai-key" },
  };

  const result = await dispatchWithConsent(
    () => ({ ...snapshots[activeProvider] }),
    async (snapshot) => {
      consented.push(snapshot.provider);
      activeProvider = "openai";
      return true;
    },
    async (snapshot) => { dispatched.push(snapshot); return snapshot; },
  );

  assert.equal(consented[0], "anthropic");
  assert.equal(dispatched[0].provider, "anthropic");
  assert.equal(dispatched[0].model, "claude");
  assert.equal(dispatched[0].secretId, "anthropic-secret");
  assert.equal(dispatched[0].apiKey, "anthropic-key");
  assert.deepEqual(result, dispatched[0]);
});
test("consent cancellation does not dispatch and a later retry can proceed", async () => {
  const snapshots: ProviderRequestSnapshot[] = [];
  let attempts = 0;
  const resolve = () => ({ provider: "openai" as const, model: "gpt", secretId: "openai-secret", apiKey: "openai-key" });
  const consent = async (snapshot: ProviderRequestSnapshot) => {
    snapshots.push(snapshot);
    return ++attempts > 1;
  };
  const dispatch = async (snapshot: ProviderRequestSnapshot) => snapshot.provider;
  assert.equal(await dispatchWithConsent(resolve, consent, dispatch), undefined);
  assert.equal(await dispatchWithConsent(resolve, consent, dispatch), "openai");
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].provider, snapshots[1].provider);
});
