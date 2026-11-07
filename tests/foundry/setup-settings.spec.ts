// The settings panel (toolbar popup and options dialog), on the local
// Foundry: it lists the server, Remove takes Module Library off it, adding
// it back by address restores it, and Setup's rail opens the panel. Ends
// with the server added, as it began.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { audit } from "./axe.ts";
import {
  addServer,
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
  settingsUrl,
  waitForSettingsPanel,
} from "./extension.ts";

const env = loadFoundryEnv();
const HOST = new URL(env.url).host;
let ext: LoadedExtension;
let page: Page;
let panel: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  panel = await ext.context.newPage();
  await panel.setViewportSize({ width: 380, height: 640 });
});

test.afterAll(async () => {
  await ext.context.close();
});

const shell = () => page.locator("#ml-shell-root");

test("the panel lists the server, the Release history permission and the build", async () => {
  await panel.goto(settingsUrl(ext));
  const row = panel.locator(".mlp-servers li").filter({ hasText: HOST });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: `Remove ${HOST}` }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Allow foundryvtt.com" }),
  ).toBeVisible();
  await expect(panel.locator("footer")).toContainText("Build 0.2.0");
  await panel.screenshot({ path: `${SCREENS}/settings-panel.png` });
  await audit(panel, "settings panel", ".mlp");
});

test("Remove takes Module Library off the server: Setup is Foundry's own again", async () => {
  await panel.getByRole("button", { name: `Remove ${HOST}` }).click();
  await expect(panel.getByText(/No servers yet/)).toBeVisible();
  await page.reload();
  await page.locator("#setup-packages").waitFor({ state: "attached" });
  await expect(shell()).toHaveCount(0);
});

test("adding it back by address brings the new Setup page back", async () => {
  await addServer(ext, panel, env.url);
  await page.reload();
  await expect(shell().locator(".mls-top")).toBeVisible();
});

test("Setup's rail opens the settings panel", async () => {
  await panel.goto("about:blank");
  await shell()
    .getByRole("button", { name: "Module Library settings" })
    .click();
  await waitForSettingsPanel(ext, page);
});
