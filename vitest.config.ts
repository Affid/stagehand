import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // Thin browser glue, covered by the end-to-end suite (pnpm test:foundry).
        "packages/extension/src/entries/**",
        "packages/extension/src/platform/**",
        "packages/module/src/index.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
