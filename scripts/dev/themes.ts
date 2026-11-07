// Dev aid: the new Setup page in each of Foundry's Setup themes. Sets the
// theme as Foundry's Configuration does (adminConfigure), reloads Setup
// without a restart, saves screenshots to test-results/screens/theme-*, and
// puts the theme that was set back at the end.
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
} from "../foundry/admin.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";

const env = loadFoundryEnv();
const THEMES = ["dark", "fantasy", "scifi"] as const;
const out = (theme: string, view: string): string =>
  `test-results/screens/theme-${theme}-${view}.png`;

async function views(page: Page, theme: string): Promise<void> {
  const shell = page.locator("#ml-shell-root");
  await shell.locator(".mls-world").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(theme, "world") });
  await shell.locator(".mlh-ver").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(theme, "menu") });
  await page.keyboard.press("Escape");
  await shell.locator(".mls-lib").click();
  await shell.locator(".mls-main button.t").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(theme, "library") });
  await shell
    .locator(".mls-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await shell.getByRole("tab", { name: /By world/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out(theme, "grid") });
  await shell.getByRole("tab", { name: /^Modules/ }).click();
  for (const name of ["Backups", "Configuration"]) {
    await shell.locator(".mls-top").getByRole("button", { name }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: out(theme, name.toLowerCase()) });
  }
  await shell
    .locator(".mls-main")
    .getByRole("button", { name: /Create a snapshot/i })
    .click()
    .catch(() => undefined);
}

const api = await createAdminClient(env.url);
await loginAsAdmin(api, env.adminPassword, join(env.dataDir, "Config"));
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const before = await page.evaluate(
  () =>
    (window as unknown as { game: { data: { options: { cssTheme: string } } } })
      .game.data.options.cssTheme,
);
console.log(`theme before: ${before}`);
try {
  for (const theme of THEMES) {
    await setupPost(api, {
      action: "adminConfigure",
      config: { cssTheme: theme },
    });
    await page.goto(`${env.url}/setup`);
    await page.locator("#ml-shell-root .mls-rail").waitFor();
    const body = await page.evaluate(() => document.body.className);
    console.log(`${theme}: body "${body}"`);
    await views(page, theme);
  }
} finally {
  await setupPost(api, {
    action: "adminConfigure",
    config: { cssTheme: before },
  });
  await ext.context.close();
  await api.dispose();
  console.log(`theme restored: ${before}`);
}
