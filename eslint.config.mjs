import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json", sourceType: "module" },
      globals: { console: "readonly", Image: "readonly", document: "readonly", btoa: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },

  {
    // Only the privacy rollback in src/file.ts must hard-delete a newly-created
    // image; all normal file removal should use Obsidian's trash integration.
    files: ["src/file.ts"],
    rules: { "obsidianmd/prefer-file-manager-trash-file": "off" },
  },

  {
    files: ["src/main.ts", "src/modal.ts"],
    rules: { "obsidianmd/ui/sentence-case": "off" },
  },
  {
    // Iris supports Obsidian 1.11.4; declarative setting search was introduced
    // after that minimum, so this legacy tab intentionally keeps the rule off.
    files: ["src/settings.ts"],
    rules: { "obsidianmd/settings-tab/prefer-setting-definitions": "off" },
  },
);
