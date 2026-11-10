// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-app/**",
      "**/coverage/**",
      "release/**",
      "test-results/**",
      "playwright-report/**",
      "design/**",
      "spikes/**",
      "packages/android/**/build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      // Overrides of Foundry methods keep their parameters, unused or not.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    // Command-line tools report to the terminal.
    files: ["tools/**/cli.ts", "scripts/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },
  {
    // House rule: no function longer than 50 lines in source code.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // Foundry 13 stays in one folder (docs/FOUNDRY-13-PLAN.md): only the
    // quirks module and the bundled adapter config may import it, so
    // dropping 13 is deleting compat/v13/ and those two imports.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    ignores: [
      "packages/extension/src/compat/**",
      "packages/extension/src/adapters/config.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/compat/v13/**"],
              message:
                "Foundry 13 code is reached through compat/quirks.ts only.",
            },
          ],
        },
      ],
    },
  },
  {
    // JSX event handlers are idiomatically arrow shorthands.
    files: ["**/*.tsx"],
    rules: {
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
    },
  },
  {
    // Test matchers (expect.any, expect.stringMatching) are typed any.
    files: ["**/test/**/*.{ts,tsx}", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Asserting on vi.fn() methods reads them unbound.
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
