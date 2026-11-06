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

test("the new Setup page takes over Foundry's layout by itself", async () => {
  await expect(shell(page).locator(".mls-top")).toBeVisible();
  await expect(page.locator("#setup")).toBeHidden();
  await expect(page.locator("#setup-menu")).toBeHidden();
  await expect(shell(page).locator(".mlh-ver")).toContainText("Version 14");
  await expect(
    shell(page).getByRole("button", { name: "Foundry's Setup page" }),
  ).toHaveCount(0);
});

test("the Version chip's menu: the build, the update page, and Help", async () => {
  await shell(page).locator(".mlh-ver").click();
  const menu = shell(page).getByRole("region", {
    name: "Foundry Virtual Tabletop",
  });
  await expect(menu).toContainText("Foundry 14 · build 370");
  await page.screenshot({ path: `${SCREENS}/shell-version-menu.png` });
  await menu.getByRole("button", { name: "Support and issues" }).click();
  // Foundry's own Package Warnings window, in view above our page.
  const warnings = page.locator("#setup-warnings");
  await expect(warnings).toBeInViewport();
  await page.screenshot({ path: `${SCREENS}/shell-warnings.png` });
  await warnings.locator('[data-action="close"]').first().click();
  await expect(warnings).toHaveCount(0);
});

test("a world's page shows its banner, then how to set the world up", async () => {
  await shell(page)
    .locator(`.mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  const banner = shell(page).locator(".mls-banner");
  await expect(banner.locator("h2")).toContainText(TEST_WORLD.title);
  await expect(banner).toContainText(TEST_WORLD.systemTitle);
  // Fresh storage: the companion hasn't reported this world yet.
  await expect(shell(page).locator(".mlw-empty")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/shell-world.png` });
});

test("the pencil opens About", async () => {
  await shell(page)
    .locator(".mls-banner")
    .getByRole("button", { name: "Edit World" })
    .click();
  await expect(shell(page).getByRole("tab", { name: "About" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    shell(page).getByRole("button", { name: "Edit in Foundry" }),
  ).toHaveCount(0);
});

test("the Library shows the module cards", async () => {
  await shell(page)
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(shell(page).locator(".mll-page .mll-toolbar")).toBeVisible();
  await expect(shell(page).locator(".mls-banner")).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/shell-library.png` });
});

test("Configuration opens our page, with no way out to Foundry's window", async () => {
  await shell(page).getByRole("button", { name: "Configuration" }).click();
  await expect(shell(page).locator(".mlc-page .mlc-cols")).toBeVisible();
  await expect(
    shell(page).getByRole("button", {
      name: "Foundry's Application Configuration",
    }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/shell-configuration.png` });
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
