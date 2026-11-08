// The app on a device, end to end (Android plan, phase 5): from a fresh
// install, a server added and Setup taken over; a world and Android's
// Back; the Library; export and import through the system pickers; a
// queued change applied at launch by the companion; Release history read
// from foundryvtt.com; the key screens in Foundry's three Setup themes.
// One run, in order: each test starts where the last one left the app.
import { expect, test, type Page } from "@playwright/test";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import { COMPANION_ID } from "../../scripts/foundry/world.ts";
import { App, installFresh, SERVER } from "./app.ts";
import {
  adminLogin,
  closeWorld,
  currentTheme,
  documentStart,
  env,
  reloadedSince,
  setTheme,
  THEMES,
  waitClosed,
} from "./foundry.ts";
import {
  addServer,
  allowReleaseHistory,
  back,
  backHome,
  exportImport,
  expectHome,
  joinAsGm,
  launch,
  library,
  openWorld,
  releaseHistory,
  shell,
  tab,
  waitActive,
} from "./steps.ts";

test.describe.configure({ mode: "serial" });

const app = new App();
let page: Page;
/** The theme to put back; unknown until read (then never guessed). */
let themeBefore: string | undefined;
let worldReset = false;

/** Our Setup page again after a world closed: admin login in the app. */
async function setupAgain(): Promise<void> {
  await closeWorld();
  page = await app.pageAt(SERVER);
  await page.goto(`${SERVER}/auth`);
  await adminLogin(page, SERVER);
}

test.beforeAll(async () => {
  // Foundry takes the admin login only with no world running.
  await closeWorld();
  themeBefore = await currentTheme();
  await resetWorldModules(env);
  worldReset = true;
  await waitClosed();
  installFresh();
});

/** Each cleanup runs whatever the others did; the first failure is kept. */
async function cleanUp(steps: (() => Promise<unknown>)[]): Promise<void> {
  const errors: unknown[] = [];
  for (const step of steps)
    await step().catch((error: unknown) => errors.push(error));
  if (errors.length > 0) throw errors[0];
}

test.afterAll(async () => {
  const theme = themeBefore;
  await cleanUp([
    () => app.close(),
    () => closeWorld(),
    async () => {
      if (worldReset) await resetWorldModules(env);
    },
    () => waitClosed(),
    async () => {
      if (theme) await setTheme(theme);
    },
  ]);
});

test("a server added on home; our Setup page takes over", async () => {
  page = await addServer(app);
  await expectHome(page);
  await expect(shell(page).locator(".mls-world").first()).toBeVisible();
  await app.shot("setup");
});

test("a world opens; Android's Back steps out to the list", async () => {
  await openWorld(page);
  await app.shot("world");
  back();
  await expectHome(page);
});

test("the Library: its tab, a filter, its menu (Back closes it)", async () => {
  await library(app, page);
  await tab(page, /^Worlds/).click();
  await expectHome(page);
});

test("export and import through the system pickers and the app's dialog", async () => {
  await exportImport(app, page);
  await tab(page, /^Worlds/).click();
});

test("the first launch from our page: Join clear, the companion reports", async () => {
  await openWorld(page);
  await launch(page);
  const seen = await joinAsGm(app, page);
  expect(seen).toContain("SNAPSHOT_PUSH");
  await setupAgain();
});

test("a queued change, launched through the review, applied by the companion", async () => {
  await openWorld(page);
  await shell(page)
    .locator('.mlw-card[data-module="ml-fixture-a"] input[role="switch"]')
    .click();
  // Fixture A brings its library along.
  await expect(shell(page).locator(".mlp-dock")).toContainText("2 changes");
  await app.shot("queued");
  await launch(page, "2 changes");
  await joinAsGm(app, page);
  const firstLoad = await documentStart(page);
  await waitActive(page, ["ml-fixture-a", "ml-fixture-lib", COMPANION_ID]);
  // The companion reloads the world once it has applied, and reports again
  // from the reloaded page: the fresh snapshot.
  await reloadedSince(page, firstLoad);
  await joinAsGm(app, page);
  await app.shot("applied");
  await setupAgain();
  await openWorld(page);
  await expect(shell(page).locator(".mls-banner")).toContainText(
    "3 modules on",
  );
  await app.shot("after");
  await backHome(page);
});

test("Release history: allowed on home, read from foundryvtt.com", async () => {
  page = await allowReleaseHistory(app, page);
  await releaseHistory(app, page);
  await backHome(page);
});

test("the key screens in Foundry's three Setup themes", async () => {
  try {
    for (const theme of THEMES) {
      await setTheme(theme);
      await page.reload();
      await shell(page).locator(".mlp-top").waitFor({ timeout: 60_000 });
      await expect(page.locator("body")).toHaveClass(
        new RegExp(`theme-${theme}`),
      );
      await app.shot("setup", theme);
      await openWorld(page);
      await app.shot("world", theme);
      await tab(page, /^Library/).click();
      await app.shot("library", theme);
      await tab(page, /^Worlds/).click();
    }
  } finally {
    // Put back at once, not only at the end of the run.
    if (themeBefore) await setTheme(themeBefore);
  }
});
