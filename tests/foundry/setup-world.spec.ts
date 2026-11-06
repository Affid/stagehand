// The new Setup page's world page on the local Foundry (build plan, Phase 2):
// module cards with switches that queue changes, the banner's pending line,
// the launch review, Add, and the empty state. The world is not launched here
// (apply.spec.ts covers applying in the world); a snapshot is seeded instead,
// as the companion would report it.
import {
  type APIRequestContext,
  expect,
  type Locator,
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

const shell = (): Locator => page.locator("#ml-shell-root");
const card = (id: string): Locator =>
  shell().locator(`.mlw-card[data-module="${id}"]`);
const banner = (): Locator => shell().locator(".mls-banner");

async function seedSnapshot(active: readonly string[]): Promise<void> {
  const snapshot = {
    worldId: TEST_WORLD.id,
    title: TEST_WORLD.title,
    system: { id: TEST_WORLD.system, version: "1" },
    coreVersion: "14.370",
    active: active.map((id) => ({ id, version: "1.0.0" })),
    companionVersion: "0.1.0",
    takenAt: new Date().toISOString(),
  };
  const key = `snapshots:${env.url}`;
  await ext.worker.evaluate(
    async ([k, s]) => {
      const all = (await chrome.storage.local.get(k))[k] ?? {};
      await chrome.storage.local.set({
        [k]: { ...all, [s.worldId]: s },
      });
    },
    [key, snapshot] as const,
  );
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  await page
    .locator("#ml-modules-root")
    .getByRole("button", { name: "Try the new Setup page" })
    .click();
  await expect(shell().locator(".mls-top")).toBeVisible();
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("a world the companion hasn't reported explains the setup", async () => {
  await shell().locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
  await expect(shell().locator(".mlw-empty h3")).toContainText("isn't set up");
  await page.screenshot({ path: `${SCREENS}/world-not-set-up.png` });
});

test("with a snapshot, the world's modules show as cards", async () => {
  await seedSnapshot(["module-library", "ml-fixture-lib"]);
  await page.reload();
  await exitTour(page);
  await shell().locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
  await expect(
    card("ml-fixture-lib").locator('input[role="switch"]'),
  ).toBeChecked();
  await expect(
    card("ml-fixture-a").locator('input[role="switch"]'),
  ).not.toBeChecked();
  await expect(
    card("module-library").locator('input[role="switch"]'),
  ).toBeDisabled();
  await page.screenshot({ path: `${SCREENS}/world-modules.png` });
});

test("a switch queues a change; the banner and Launch count it", async () => {
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  await expect(card("ml-fixture-a")).toContainText("turns on");
  await expect(
    card("ml-fixture-a").locator('input[role="switch"]'),
  ).toBeChecked();
  await expect(banner()).toContainText("1 change waits for the next launch");
  await expect(banner().locator(".mlc-badge")).toHaveText("1");
  await page.screenshot({ path: `${SCREENS}/world-change-queued.png` });
});

test("Launch opens the review; Cancel keeps everything", async () => {
  await banner()
    .getByRole("button", { name: /^Launch/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: `Launch ${TEST_WORLD.title}`,
  });
  await expect(dialog).toContainText("Turns on · 1");
  await expect(dialog.getByRole("checkbox", { name: /Back up/ })).toBeChecked();
  await page.screenshot({ path: `${SCREENS}/world-launch-review.png` });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(banner().locator(".mlc-badge")).toHaveText("1");
});

test("flipping back undoes the change", async () => {
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  await expect(card("ml-fixture-a")).not.toContainText("turns on");
  await expect(banner().locator(".mlc-pending")).toHaveCount(0);
});

test("Add offers presets and copying another world", async () => {
  await shell().getByRole("button", { name: "Add" }).click();
  const menu = shell().locator(".mlw-addmenu");
  await expect(menu).toContainText("Presets");
  await expect(menu).toContainText("Copy from another world");
  await page.screenshot({ path: `${SCREENS}/world-add-menu.png` });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("Discard cancels every queued change", async () => {
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  await expect(banner().locator(".mlc-badge")).toHaveText("1");
  await banner().getByRole("button", { name: "Discard" }).click();
  await expect(banner().locator(".mlc-pending")).toHaveCount(0);
});

test("About shows Foundry's details for the world", async () => {
  await shell().getByRole("tab", { name: "About" }).click();
  const box = shell().locator(".mlw-about");
  await expect(box).toContainText(TEST_WORLD.system);
  await expect(box.locator(".mlw-next")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/world-about.png` });
  await shell().getByRole("tab", { name: "Modules" }).click();
});

test("About saves the title and next session through Foundry, and they come back", async () => {
  await shell().getByRole("tab", { name: "About" }).click();
  const box = shell().locator(".mlw-about");
  // Title: change it, see it in the banner, put it back.
  await box.getByRole("button", { name: "Change title" }).click();
  await box
    .getByRole("textbox", { name: "Title" })
    .fill(`${TEST_WORLD.title} (edited)`);
  await box.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(shell().locator(".mls-banner h2")).toHaveText(
    `${TEST_WORLD.title} (edited)`,
  );
  await box.getByRole("button", { name: "Change title" }).click();
  await box.getByRole("textbox", { name: "Title" }).fill(TEST_WORLD.title);
  await box.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(shell().locator(".mls-banner h2")).toHaveText(TEST_WORLD.title);
  // Next session: set it, see it, clear it.
  await box.getByRole("button", { name: "Change next session" }).click();
  await box.getByLabel(/Next session in/).fill("2030-01-15T19:30");
  await box.getByRole("button", { name: "Save" }).click();
  await expect(box.locator(".mlw-next")).toContainText("2030");
  await page.screenshot({ path: `${SCREENS}/world-about-edited.png` });
  await box.getByRole("button", { name: "Change next session" }).click();
  await box.getByRole("button", { name: "Clear" }).click();
  await expect(box.locator(".mlw-next")).toContainText("Not set");
  await shell().getByRole("tab", { name: "Modules" }).click();
});
