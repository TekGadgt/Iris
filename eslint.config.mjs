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
    files: ["src/file.ts"],
    rules: { "obsidianmd/prefer-file-manager-trash-file": "off" },
  },
  {
    files: ["src/main.ts", "src/modal.ts"],
    rules: { "obsidianmd/ui/sentence-case": "off" },
  },
);
