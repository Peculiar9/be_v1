import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Base JS recommendations
  js.configs.recommended,
  // TypeScript specific recommendations (spread the array of configs)
  ...tseslint.configs.recommended,
  // Custom configuration
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node // Adding node globals since this is a backend project
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
