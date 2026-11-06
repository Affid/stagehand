// In-world end to end on the local Foundry: changes queued on the new Setup
// page are applied by the companion module (PRD 8.4, 8.5). The review on
// Setup is the confirmation: the world applies it without asking again,
// unless its live check differs (Phase 5b ruling). Also: the two-phase
// acknowledgement, remove safety, the Assistant GM, and Launch without changes.
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
  exitTour,
  joinWorld,
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
  storage,
  waitReady,
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

const shell = (): Locator => page.locator("#ml-shell-root");
const banner = (): Locator => shell().locator(".mls-banner");
const inWorldDialog = (p: Page): Locator =>
  p.locator("dialog.application", { hasText: "Module Library" });
const flip = (id: string): Promise<void> =>
  shell()
    .locator(`.mlw-card[data-module="${id}"] input[role="switch"]`)
    .click();

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
  await shell().locator(".mls-top").waitFor();
  await exitTour(page);
  await shell().locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
}

/** A launch Setup didn't review: Foundry's own, from the admin API. */
async function launchAsGm(): Promise<void> {
  await page.goto("about:blank");
  await launchWorld(admin, TEST_WORLD.id);
  await joinWorld(page, env.url, "Gamemaster");
}

/** After a launch from our page: a signed-in browser goes straight to /game. */
async function joinAfterLaunch(): Promise<void> {
  await page.waitForURL(/\/(join|game)$/);
  if (page.url().endsWith("/join"))
    await joinWorld(page, env.url, "Gamemaster");
  else await waitReady(page);
}

/** Launch from the review, without a backup (keeps the server clean). */
async function applyAndLaunch(changes: string): Promise<void> {
  await banner()
    .getByRole("button", { name: /^Launch/ })
    .click();
  const review = page.getByRole("dialog", {
    name: `Launch ${TEST_WORLD.title}`,
  });
  await review.getByRole("checkbox", { name: /Back up .* first/ }).uncheck();
  await page.screenshot({ path: `${SCREENS}/apply-review.png` });
  await review
    .getByRole("button", { name: `Apply ${changes} and launch` })
    .click();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetWorldModules(env);
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
  await resetWorldModules(env);
});

test("the first launch reports the world; its modules show on Setup", async () => {
  await launchAsGm();
  await expect(inWorldDialog(page)).toHaveCount(0);
  await backToSetup();
  await expect(
    shell().locator('.mlw-card[data-module="ml-fixture-a"]'),
  ).toBeVisible();
});

test("Apply and launch: the review is the confirmation; dependencies come along; one reload", async () => {
  await flip("ml-fixture-a");
  // Fixture A brings its library along: two modules turn on.
  await expect(banner().locator(".mlc-badge")).toHaveText("2");
  await applyAndLaunch("2 changes");
  await joinAfterLaunch();
  // No dialog: the world applies at once and reloads once.
  await expect
    .poll(() => activeModules(page).catch(() => []), { timeout: 60_000 })
    .toEqual(["ml-fixture-a", "ml-fixture-lib", COMPANION_ID].sort());
  await waitReady(page);
  await expect(inWorldDialog(page)).toHaveCount(0);
  await expect
    .poll(async () => (await commands()).map((c) => c.status))
    .toEqual(["applied"]);
  await page.screenshot({ path: `${SCREENS}/apply-applied.png` });
});

test("Setup shows the fresh snapshot: three modules on", async () => {
  await backToSetup();
  await expect(banner()).toContainText("3 modules on now");
  await expect(
    shell().locator(
      '.mlw-card[data-module="ml-fixture-a"] input[role="switch"]',
    ),
  ).toBeChecked();
});

test("a remove that others need still asks in the world (the live check differs)", async () => {
  await flip("ml-fixture-lib");
  await applyAndLaunch("1 change");
  await joinAfterLaunch();
  const dialog = inWorldDialog(page);
  await expect(dialog).toContainText("Still needed by modules that stay");
  await page.screenshot({ path: `${SCREENS}/apply-remove-dependents.png` });
  await dialog.getByRole("checkbox", { name: /Also disable/ }).check();
  await dialog.getByRole("button", { name: "Apply & reload" }).click();
  await page.waitForEvent("load");
  await waitReady(page);
  expect(await activeModules(page)).toEqual([COMPANION_ID]);
  await expect
    .poll(async () => (await commands()).at(-1)?.status)
    .toBe("applied");
});

test("a launch Setup didn't review: the Assistant GM gets nothing; the GM can discard (PR-4)", async () => {
  await backToSetup();
  await flip("ml-fixture-a");
  await expect(banner().locator(".mlc-badge")).toHaveText("2");
  await launchWorld(admin, TEST_WORLD.id);
  await page.goto("about:blank");
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

test("Launch without changes holds the queue for that launch", async () => {
  await backToSetup();
  const before = (await commands()).length;
  await flip("ml-fixture-a");
  await expect(banner().locator(".mlc-badge")).toHaveText("2");
  await banner()
    .getByRole("button", { name: /^Launch/ })
    .click();
  await page.getByRole("button", { name: "Launch without changes" }).click();
  await joinAfterLaunch();
  await page.waitForTimeout(5000);
  await expect(inWorldDialog(page)).toHaveCount(0);
  const list = await commands();
  expect(list).toHaveLength(before + 1);
  expect(list.at(-1)?.status).toBe("pending");
  expect((await storage(ext.worker))[`launchHolds:${env.url}`]).toEqual([]);
});
