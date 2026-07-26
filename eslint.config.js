import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "public", "vendor", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts", "vite.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
);
