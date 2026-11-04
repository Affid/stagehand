import { defineConfig } from "@playwright/test";

/**
 * End to end against the local Foundry (`pnpm test:foundry`): Foundry must
 * be running on Setup with the test world (`pnpm foundry:start`,
 * `pnpm build && pnpm foundry:link && pnpm foundry:setup`).
 */
export default defineConfig({
  testDir: "tests/foundry",
  testMatch: "*.spec.ts",
  outputDir: "test-results/foundry-e2e",
  forbidOnly: true,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
});
