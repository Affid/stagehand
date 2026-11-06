// The new Setup page on the local Foundry (build plan, Phase 1): turn it on,
// open a world, open the Library, reach Foundry's own windows, survive a
// reload, and switch back to Foundry's page.
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  exitTour,
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let admin: APIRequestContext;
let page: Page;

const shell = (p: Page) => p.locator("#ml-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("Try the new Setup page takes over Foundry's layout", async () => {
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  await page
    .locator("#ml-modules-root")
    .getByRole("button", { name: "Try the new Setup page" })
    .click();
  await expect(shell(page).locator(".mls-top")).toBeVisible();
  await expect(page.locator("#setup")).toBeHidden();
  await expect(page.locator("#setup-menu")).toBeHidden();
  await expect(shell(page).locator(".mlh-ver")).toContainText("Version 14");
});

test("a world's page shows its banner, then how to set the world up", async () => {
  await shell(page)
    .locator(`.mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  const banner = shell(page).locator(".mls-banner");
  await expect(banner.locator("h2")).toHaveText(TEST_WORLD.title);
  await expect(banner).toContainText(TEST_WORLD.system);
  // Fresh storage: the companion hasn't reported this world yet.
  await expect(shell(page).locator(".mlw-empty")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/shell-world.png` });
});

test("Edit World opens Foundry's World Configuration above our page", async () => {
  await shell(page)
    .locator(".mls-banner")
    .getByRole("button", { name: "Edit World" })
    .click();
  const form = page
    .locator(".application", { hasText: TEST_WORLD.title })
    .filter({
      has: page.locator('[data-action="close"]'),
    });
  await expect(form.first()).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/shell-edit-world.png` });
  // A click only lands if the window is on top of our page.
  await form.first().locator('[data-action="close"]').click();
  await expect(form).toHaveCount(0);
});

test("the Library shows the module cards", async () => {
  await shell(page)
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(shell(page).locator(".mll-page .mll-tools")).toBeVisible();
  await expect(shell(page).locator(".mls-banner")).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/shell-library.png` });
});

test("Configuration opens Foundry's own window", async () => {
  const before = await page.locator(".application:visible").count();
  await shell(page).getByRole("button", { name: "Configuration" }).click();
  await expect
    .poll(() => page.locator(".application:visible").count())
    .toBeGreaterThan(before);
  await page.screenshot({ path: `${SCREENS}/shell-configuration.png` });
  const config = page.locator(".application", {
    hasText: "Application Configuration",
  });
  await config.locator('[data-action="close"]').first().click();
  await expect(config).toHaveCount(0);
});

test("Shut down asks first, with Foundry's own confirm, above our page", async () => {
  await shell(page)
    .getByRole("button", { name: "Log out or shut down" })
    .click();
  await shell(page)
    .getByRole("button", { name: "Shut down the server" })
    .click();
  const confirm = page.locator(".application.dialog", {
    hasText: "Shut Down",
  });
  await expect(confirm).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/shell-shutdown-confirm.png` });
  // Never accept: "No" keeps the server running.
  await confirm.locator('button[data-action="no"]').click();
  await expect(confirm).toHaveCount(0);
  await expect(shell(page).locator(".mls-top")).toBeVisible();
});

test("the choice survives a reload", async () => {
  await page.reload();
  await exitTour(page);
  await expect(shell(page).locator(".mls-top")).toBeVisible();
  await expect(page.locator("#setup")).toBeHidden();
});

test("Foundry's Setup page switches back", async () => {
  await shell(page)
    .getByRole("button", { name: "Foundry's Setup page" })
    .click();
  await expect(shell(page)).toHaveCount(0);
  await expect(page.locator("#setup")).toBeVisible();
  // Foundry opens on its Game Worlds tab; today's strip is back there.
  await expect(page.locator("#ml-worlds-root .ml-next")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/shell-switched-back.png` });
});
