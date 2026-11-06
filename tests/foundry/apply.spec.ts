// M1 in-world end to end: presets queued on Setup are applied by the
// companion module after GM confirmation (PRD 8.4, 8.5), with the two-phase
// acknowledgement, remove safety and role checks, on the local Foundry.
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import { COMPANION_ID, TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  joinWorld,
  type LoadedExtension,
  loadExtension,
  mlWindow,
  openSetupAsAdmin,
  SCREENS,
  storage,
  waitReady,
  worldMenu,
  worldTag,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let admin: APIRequestContext;
let page: Page;

interface StoredCommand {
  readonly id: string;
  readonly status: string;
}

const commands = async (): Promise<readonly StoredCommand[]> =>
  ((await storage(ext.worker))[`commands:${env.url}`] ?? []) as StoredCommand[];

const activeModules = (p: Page): Promise<string[]> =>
  p.evaluate(() => {
    const g = globalThis as unknown as {
      game: { modules: Map<string, { id: string; active: boolean }> };
    };
    return [...g.game.modules.values()]
      .filter((m) => m.active)
      .map((m) => m.id)
      .sort();
  });

const tag = (): Locator => worldTag(page, TEST_WORLD.id);
const inWorldDialog = (p: Page): Locator =>
  p.locator("dialog.application", { hasText: "Module Library" });

async function backToSetup(): Promise<void> {
  await page.goto("about:blank");
  await shutdownWorld(admin, env.adminPassword);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await ext.context.request.post(`${env.url}/auth`, {
    form: { action: "adminAuth", adminPassword: env.adminPassword },
    headers: { Origin: env.url },
    maxRedirects: 0,
  });
  await page.goto(`${env.url}/setup`);
  await page.locator("#ml-worlds-root .ml-next").waitFor();
}

async function createPreset(
  name: string,
  moduleIds: readonly string[],
): Promise<void> {
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  const app = page.locator("#ml-modules-root");
  for (const id of moduleIds)
    await app
      .locator(`li.ml-row[data-module="${id}"] input[type="checkbox"]`)
      .check();
  await app.getByRole("button", { name: "New preset from selection" }).click();
  const editor = mlWindow(page, "New preset");
  await editor.getByRole("textbox", { name: "Name" }).fill(name);
  await editor.getByRole("button", { name: "Save preset" }).click();
  await expect(editor).toHaveCount(0);
  await page.locator('#setup-packages [data-tab="worlds"]').first().click();
}

async function queue(
  preset: string,
  mode: "Add" | "Replace" | "Remove",
): Promise<void> {
  await worldMenu(page, TEST_WORLD.id, "Apply module presets…");
  const dialog = mlWindow(page, "Apply presets to");
  await dialog.getByRole("checkbox", { name: new RegExp(preset) }).check();
  await dialog.getByRole("radio", { name: new RegExp(`^${mode} `) }).check();
  await dialog.getByRole("button", { name: "Queue for next launch" }).click();
  await expect(tag()).toHaveText("1 queued");
}

async function launchAsGm(): Promise<void> {
  await page.goto("about:blank");
  await launchWorld(admin, TEST_WORLD.id);
  await joinWorld(page, env.url, "Gamemaster");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetWorldModules(env);
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await createPreset("Fixture A", ["ml-fixture-a"]);
  await createPreset("Library", ["ml-fixture-lib"]);
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
  await resetWorldModules(env);
});

test("Add: the GM confirms, dependencies come along, one reload, applied (8.4)", async () => {
  await queue("Fixture A", "Add");
  await launchAsGm();
  const dialog = inWorldDialog(page);
  await expect(dialog).toContainText("ml-fixture-a");
  await expect(dialog).toContainText("Added as dependencies");
  await expect(dialog).toContainText("ml-fixture-lib");
  await page.screenshot({ path: `${SCREENS}/world-apply-dialog.png` });
  await dialog.getByRole("button", { name: "Apply & reload" }).click();
  await page.waitForEvent("load");
  await waitReady(page);
  expect(await activeModules(page)).toEqual(
    ["ml-fixture-a", "ml-fixture-lib", COMPANION_ID].sort(),
  );
  await expect
    .poll(async () => (await commands()).map((c) => c.status))
    .toEqual(["applied"]);
});

test("Setup shows the fresh snapshot and the applied command (W-1, W-3)", async () => {
  await backToSetup();
  await expect(tag()).toHaveText("3");
  await tag().click();
  const sheet = mlWindow(page, "Tracked · 3 active modules");
  await expect(sheet.locator(".ml-history")).toContainText("Applied");
  await page.screenshot({ path: `${SCREENS}/setup-worlds-applied.png` });
  await sheet.locator('button[data-action="close"]').click();
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  await expect(
    page.locator('#ml-modules-root li.ml-row[data-module="ml-fixture-a"]'),
  ).toContainText("Used in 1 worlds");
  await page.locator('#setup-packages [data-tab="worlds"]').first().click();
});

test("Remove: a module still needed by another asks to remove its dependents (8.5 step 5)", async () => {
  await queue("Library", "Remove");
  await launchAsGm();
  const dialog = inWorldDialog(page);
  await expect(dialog).toContainText("Still needed by modules that stay");
  await expect(dialog).toContainText("ml-fixture-lib: ml-fixture-a");
  await page.screenshot({ path: `${SCREENS}/world-remove-dependents.png` });
  await dialog.getByRole("checkbox", { name: /Also disable/ }).check();
  await dialog.getByRole("button", { name: "Apply & reload" }).click();
  await page.waitForEvent("load");
  await waitReady(page);
  expect(await activeModules(page)).toEqual([COMPANION_ID]);
  await expect
    .poll(async () => (await commands()).at(-1)?.status)
    .toBe("applied");
});

test("an Assistant GM gets nothing; the GM can discard (PR-4)", async () => {
  await backToSetup();
  await queue("Fixture A", "Add");
  await launchWorld(admin, TEST_WORLD.id);
  await joinWorld(page, env.url, "Assistant");
  await page.waitForTimeout(5000);
  await expect(inWorldDialog(page)).toHaveCount(0);
  expect((await commands()).at(-1)?.status).toBe("pending");

  await page.goto("about:blank");
  await joinWorld(page, env.url, "Gamemaster");
  await inWorldDialog(page).getByRole("button", { name: "Discard" }).click();
  await expect
    .poll(async () => (await commands()).at(-1)?.status)
    .toBe("declined");
  expect(await activeModules(page)).toEqual([COMPANION_ID]);
});

test("new Setup page: Launch without changes holds the queue for that launch", async () => {
  await backToSetup();
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  await page
    .locator("#ml-modules-root")
    .getByRole("button", { name: "Try the new Setup page" })
    .click();
  const shell = page.locator("#ml-shell-root");
  await shell.locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
  const before = (await commands()).length;
  await shell
    .locator('.mlw-card[data-module="ml-fixture-a"] input[role="switch"]')
    .click();
  const banner = shell.locator(".mls-banner");
  // Fixture A brings its library along: two modules turn on.
  await expect(banner.locator(".mlc-badge")).toHaveText("2");
  await banner.getByRole("button", { name: /^Launch/ }).click();
  await page.getByRole("button", { name: "Launch without changes" }).click();
  // A browser still signed in to the world goes straight to /game.
  await page.waitForURL(/\/(join|game)$/);
  if (page.url().endsWith("/join"))
    await joinWorld(page, env.url, "Gamemaster");
  else await waitReady(page);
  await page.waitForTimeout(5000);
  await expect(inWorldDialog(page)).toHaveCount(0);
  const list = await commands();
  expect(list).toHaveLength(before + 1);
  expect(list.at(-1)?.status).toBe("pending");
  expect((await storage(ext.worker))[`launchHolds:${env.url}`]).toEqual([]);
});
