import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Obsidian test shim is an explicit ESM module with required constructors", async () => {
  const packagePath = path.resolve("node_modules/obsidian/package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  assert.equal(packageJson.type, "module");

  const obsidian = await import("obsidian") as unknown as Record<string, unknown>;
  for (const exportName of ["Element", "Modal", "PluginSettingTab", "SecretComponent", "Setting"]) {
    assert.equal(typeof obsidian[exportName], "function", `${exportName} must be a constructor`);
  }

  assert.equal(globalThis.document.body.constructor, obsidian.Element);
});
