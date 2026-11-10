import { defineConfig } from "@playwright/test";

/**
 * The on-device suite (`pnpm test:android`; Android plan, phase 5): the
 * debug app on a device Windows' adb sees (ST_ANDROID_SERIAL, else the only
 * one), against the local Foundry on Setup with the test world, as the
 * device reaches it (ST_APP_SERVER, else the emulator's 10.0.2.2). Build
 * first: `pnpm android:build`. No traces: they would hold the admin login.
 */
export default defineConfig({
  testDir: "tests/android",
  testMatch: "*.spec.ts",
  outputDir: "test-results/android",
  forbidOnly: true,
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: { trace: "off", screenshot: "off", video: "off" },
});
