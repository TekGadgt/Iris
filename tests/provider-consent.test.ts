import { test } from "node:test";
import assert from "node:assert/strict";
import { providerDisplayName } from "../src/provider-label";

test("recipient display names the provider selected by the Convert snapshot", () => {
  assert.equal(providerDisplayName("anthropic"), "Anthropic");
  assert.equal(providerDisplayName("openai"), "OpenAI");
});
