// The settings panel (toolbar popup and options dialog), on the local
// Foundry: it lists the server, Remove takes Stagehand off it, adding
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
import { ON_APP } from "./target.ts";

const env = loadFoundryEnv();
const HOST = new URL(env.url).host;
let ext: LoadedExtension;
let page: Page;
let panel: Page;

// The extension's toolbar panel; the app's home screen: app-home.spec.ts.
test.skip(ON_APP, "extension only");
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

const shell = () => page.locator("#st-shell-root");

test("the panel lists the server, the Release history permission and the build", async () => {
  await panel.goto(settingsUrl(ext));
  const row = panel.locator(".stp-servers li").filter({ hasText: HOST });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: `Remove ${HOST}` }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Allow foundryvtt.com" }),
  ).toBeVisible();
  await expect(panel.locator("footer")).toContainText("Build 0.2.0");
  await panel.screenshot({ path: `${SCREENS}/settings-panel.png` });
  await audit(panel, "settings panel", ".stp");
});

test("Remove takes Stagehand off the server: Setup is Foundry's own again", async () => {
  await panel.getByRole("button", { name: `Remove ${HOST}` }).click();
  await expect(panel.getByText(/No servers yet/)).toBeVisible();
  await page.reload();
  await page.locator("#setup-packages").waitFor({ state: "attached" });
  await expect(shell()).toHaveCount(0);
});

test("adding it back by address brings the new Setup page back", async () => {
  await addServer(ext, panel, env.url);
  await page.reload();
  await expect(shell().locator(".sts-top")).toBeVisible();
});

test("Setup's rail opens the settings panel", async () => {
  await panel.goto("about:blank");
  await shell().getByRole("button", { name: "Stagehand settings" }).click();
  await waitForSettingsPanel(ext, page);
});

/** As Chrome on an update or reload: the servers' scripts are gone. */
async function dropScripts(): Promise<void> {
  await panel.goto(settingsUrl(ext));
  await panel.evaluate(() => chrome.scripting.unregisterContentScripts());
}

test("scripts the browser dropped show as Off; Turn on brings Setup back (owner's bug)", async () => {
  await dropScripts();
  await panel.reload();
  const row = panel.locator(".stp-servers li").filter({ hasText: HOST });
  await expect(row.getByText("Off")).toBeVisible();
  await page.reload();
  await page.locator("#setup-packages").waitFor({ state: "attached" });
  await expect(shell()).toHaveCount(0);
  await row.getByRole("button", { name: `Turn ${HOST} back on` }).click();
  await expect(row.getByText("Off")).toHaveCount(0);
  await page.reload();
  await expect(shell().locator(".sts-top")).toBeVisible();
});

test("when the background starts again it puts the dropped scripts back by itself", async () => {
  await dropScripts();
  const cdp = await ext.context.newCDPSession(panel);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await cdp.detach();
  // Anything that wakes the background starts it again (here, the panel).
  await panel.reload();
  await expect
    .poll(() =>
      panel.evaluate(
        async () =>
          (await chrome.scripting.getRegisteredContentScripts()).length,
      ),
    )
    .toBeGreaterThanOrEqual(4);
  await page.reload();
  await expect(shell().locator(".sts-top")).toBeVisible();
});
