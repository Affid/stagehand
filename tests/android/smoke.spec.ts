// The app on a device, end to end (Android plan, phase 5): from a fresh
// install, a server added and Setup taken over; a world and Android's
// Back; the Library; export and import through the system pickers; a
// queued change applied at launch, out of sight (phase 7); Release history read
// from foundryvtt.com; the key screens in Foundry's three Setup themes;
// last, home: a server renamed, given a new address and removed.
// One run, in order: each test starts where the last one left the app.
import { expect, test, type Page } from "@playwright/test";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import { App, HOME, installFresh, SERVER } from "./app.ts";
import {
  adminLogin,
  closeWorld,
  currentTheme,
  env,
  setTheme,
  THEMES,
  waitClosed,
} from "./foundry.ts";
import { moveAndBack, removeFromHome, renameAndBack } from "./home-steps.ts";
import {
  addServer,
  allowReleaseHistory,
  back,
  backHome,
  exportImport,
  expectHome,
  waitRunning,
  launch,
  library,
  openWorld,
  releaseHistory,
  shell,
  tab,
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
  // Our running page may be on its own way to Setup as the world closes:
  // a load it interrupts is tried again.
  await page.goto(`${SERVER}/setup`).catch(async (error: unknown) => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    await page.waitForLoadState().catch(() => undefined);
    await page.goto(`${SERVER}/setup`);
  });
  page = await adminLogin(app, SERVER);
}

test.beforeAll(async () => {
  // Foundry takes the admin login only with no world running.
  await closeWorld();
  themeBefore = await currentTheme();
  // The world as after someone played in it: its modules reported.
  await resetWorldModules(env, { keepReport: true });
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

test("the first launch from our page: our launching screen, then our running page, no game", async () => {
  await openWorld(page);
  await launch(page);
  await waitRunning(app, page);
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
  // Applied out of sight: the companion, the reload, back to our page.
  await waitRunning(app, page, 2);
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

test("home: a server renamed, given a new address, opened, removed", async () => {
  await tab(page, /^Worlds/).click();
  await shell(page)
    .getByRole("button", { name: /Stagehand settings/ })
    .click();
  let home = await app.pageAt(HOME);
  await renameAndBack(app, home);
  await moveAndBack(app, home);
  // The library went along both ways: our Setup page takes over again.
  await home
    .getByRole("link", { name: "Open Emulator host" })
    .click({ noWaitAfter: true });
  page = await app.pageAt(SERVER);
  await expectHome(page);
  back();
  home = await app.pageAt(HOME);
  await removeFromHome(app, home);
});
