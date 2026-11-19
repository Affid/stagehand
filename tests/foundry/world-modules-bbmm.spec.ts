// Stagehand's view with BBMM in the same world (docs/IN-WORLD-LIBRARY-PLAN.md,
// "Other module managers"; decided 2026-11-18): the first full Gamemaster is
// asked once which view Module Management opens. Keeping BBMM leaves its
// window on the sidebar button and ours on Shift-click, with BBMM's header
// button beside our view; choosing Stagehand turns BBMM's window off for the
// world. Installs BBMM from its release (needs the internet) and removes it
// again if it wasn't there.
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type APIRequestContext,
  type Browser,
  chromium,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  installPackage,
  launchWorld,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import {
  enableModules,
  joinAs,
  reloadWorld,
} from "../../scripts/foundry/session.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import { CORE } from "./core.ts";
import { SCREENS } from "./extension.ts";
import { ON_APP } from "./target.ts";
import {
  dialog,
  getSetting,
  placeLibrary,
  setSetting,
  win,
} from "./world-view.ts";

test.skip(ON_APP, "the companion's view: one run, with the extension's suite");
test.describe.configure({ mode: "serial" });

const env = loadFoundryEnv();
const BBMM = "bbmm";
const BBMM_MANIFEST =
  "https://github.com/thejoester/bbmm/releases/latest/download/module.json";
const BBMM_FILE = join(env.dataDir, "Data", "modules", BBMM, "module.json");
const PROMPT = "Two Module Views";
const shot = (name: string): string =>
  join(SCREENS, `world-modules-bbmm-${String(CORE.generation)}-${name}.png`);

let restoreLibrary: () => void = () => undefined;
let installedHere = false;
let admin: APIRequestContext;
let browser: Browser;
let gm: Page;

/** BBMM's own windows (its changelog opens after an install) are closed. */
async function closeBbmmWindows(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { id: string; close(): Promise<unknown> }>;
        };
      };
    };
    for (const app of [...g.foundry.applications.instances.values()])
      if (app.id.startsWith("bbmm")) await app.close();
  });
}

/** The sidebar's Module Management button, in the Settings tab. */
async function moduleButton(page: Page) {
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      ui: {
        sidebar: { expand(): void; changeTab(t: string, g: string): void };
      };
    };
    g.ui.sidebar.expand();
    g.ui.sidebar.changeTab("settings", "primary");
  });
  const button = page
    .locator(
      '#sidebar button[data-app="modules"], #sidebar button[data-action="moduleManagement"]',
    )
    .first();
  await button.waitFor();
  return button;
}

test.beforeAll(async () => {
  restoreLibrary = placeLibrary(env.dataDir);
  await resetWorldModules(env);
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  if (!existsSync(BBMM_FILE)) {
    await installPackage(
      admin,
      { id: BBMM, manifest: BBMM_MANIFEST },
      "module",
      BBMM_FILE,
    );
    installedHere = true;
  }
  await launchWorld(admin, TEST_WORLD.id);
  browser = await chromium.launch();
  gm = await joinAs(browser, env.url, "Gamemaster");
  if (await enableModules(gm, ["stagehand", BBMM])) await reloadWorld(gm);
  // As BBMM ships it, and nobody asked yet (an earlier run may have changed both).
  await setSetting(gm, BBMM, "enableModuleManagement", true);
  await setSetting(gm, "stagehand", "bbmmAnswer", "");
  await reloadWorld(gm);
});

test.afterAll(async () => {
  restoreLibrary();
  // BBMM's world setting outlives BBMM: leave it as BBMM ships it.
  await setSetting(gm, BBMM, "enableModuleManagement", true).catch(
    () => undefined,
  );
  await browser.close();
  try {
    await shutdownWorld(admin, env.adminPassword);
    if (installedHere)
      await setupPost(admin, {
        action: "uninstallPackage",
        type: "module",
        id: BBMM,
      });
  } finally {
    await admin.dispose();
  }
  await resetWorldModules(env);
});

test("asked once; keeping BBMM leaves its window on the button and ours on Shift-click", async () => {
  // BBMM's enhanced management is on by default: the prompt comes at load.
  const prompt = dialog(gm, PROMPT);
  await expect(prompt).toBeVisible();
  await gm.screenshot({ path: shot("prompt") });
  await prompt.getByRole("button", { name: "Keep BBMM's View" }).click();
  await expect
    .poll(() => getSetting(gm, "stagehand", "bbmmAnswer"))
    .toBe("bbmm");
  expect(await getSetting(gm, BBMM, "enableModuleManagement")).toBe(true);

  await closeBbmmWindows(gm);
  const button = await moduleButton(gm);
  await button.click();
  await expect(gm.locator("#bbmm-module-manager")).toBeVisible();
  await expect(win(gm)).toHaveCount(0);
  await closeBbmmWindows(gm);

  await button.click({ modifiers: ["Shift"] });
  await expect(win(gm).locator(".stagehand-view")).toBeVisible();
  await expect(win(gm).locator(".bbmm-header-menu-btn")).toBeVisible();
  await gm.screenshot({ path: shot("shift-click") });

  await reloadWorld(gm);
  await gm.waitForTimeout(2_000);
  await expect(dialog(gm, PROMPT)).toHaveCount(0);
});

test("choosing Stagehand's view turns BBMM's window off for the world", async () => {
  await setSetting(gm, "stagehand", "bbmmAnswer", "");
  await reloadWorld(gm);
  const prompt = dialog(gm, PROMPT);
  await expect(prompt).toBeVisible();

  await prompt.getByRole("button", { name: "Use Stagehand's View" }).click();
  await gm.waitForEvent("load", { timeout: 60_000 });
  await reloadWorld(gm);

  expect(await getSetting(gm, BBMM, "enableModuleManagement")).toBe(false);
  await closeBbmmWindows(gm);
  await (await moduleButton(gm)).click();
  await expect(win(gm).locator(".stagehand-view")).toBeVisible();
});
