// Steps of the on-device smoke suite (Android plan, phase 5), on the app's
// pages: home, our Setup page, a world, the Library, the launch, the
// pickers and dialog (native UI), the Update page.
import { expect, type Locator, type Page } from "@playwright/test";
import { type App, HOME, SERVER } from "./app.ts";
import {
  createAdminClient,
  loginAsAdmin,
} from "../../scripts/foundry/admin.ts";
import {
  activeModules,
  adminLogin,
  env,
  installedVersion,
  recordCompanion,
  TEST_WORLD,
} from "./foundry.ts";
import { addFromHome } from "./home-steps.ts";
import { adb, sleep, tapNative, waitNative } from "./native-ui.ts";

export const shell = (page: Page): Locator => page.locator("#st-shell-root");
/** Our page's screen (home or page), "" while it is between pages. */
const screen = (page: Page): Promise<string> =>
  shell(page)
    .locator(".sts-shell")
    .evaluate((el) => (el as HTMLElement).dataset.screen ?? "", null, {
      timeout: 5_000,
    })
    .catch(() => "");
/** Which page our shell shows (worlds, library, a server page). */
const shownPage = (page: Page): Promise<string> =>
  shell(page)
    .locator(".sts-shell")
    .evaluate((el) => (el as HTMLElement).dataset.page ?? "", null, {
      timeout: 5_000,
    })
    .catch(() => "");

/**
 * The app takes a second Back within 2 s as "get me out" even when Setup
 * used the first (MainActivity's BACK_AGAIN_MS): a person stepping through
 * screens is slower than that, so the suite is too.
 */
const BACK_PACE_MS = 2_500;
let lastBackAt = 0;

/** Android's Back, as the system sends it, one step at a person's pace. */
export async function back(): Promise<void> {
  const wait = lastBackAt + BACK_PACE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  adb("shell", "input", "keyevent", "4");
  lastBackAt = Date.now();
}

/** On home: the server added by its address and opened; logged in. */
export async function addServer(app: App): Promise<Page> {
  await addFromHome(app);
  return adminLogin(app, SERVER);
}

/** The phone layout's home: the worlds list. */
export async function expectHome(page: Page): Promise<void> {
  await expect.poll(() => screen(page)).toBe("home");
}

export async function openWorld(page: Page): Promise<void> {
  await shell(page)
    .locator(`.sts-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  await expect.poll(() => screen(page)).toBe("page");
  await expect(shell(page).locator(".sts-banner")).toBeVisible();
}

/** Back until our page says home (a menu or sheet closes first). */
export async function backHome(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const before = await screen(page);
    if (before === "home") return;
    await back();
    // Setup has up to 1.5 s to answer the app's Back; the next Back waits
    // until this one has moved the screen, or two would step past home.
    await expect
      .poll(
        async () => {
          const now = await screen(page);
          return now !== "" && now !== before;
        },
        { timeout: 5_000 },
      )
      .toBe(true)
      .catch(() => undefined);
  }
  await expectHome(page);
}

export const tab = (page: Page, name: RegExp): Locator =>
  shell(page).locator(".stp-tabs").getByRole("button", { name });

const MENU = "Select, install, update, tags, presets, folders";

/** Library: the tab, a filter that narrows the cards, the ⋮ menu. */
export async function library(app: App, page: Page): Promise<void> {
  await tab(page, /^Library/).click();
  const cards = shell(page).locator(".stl-card");
  await expect(cards.first()).toBeVisible();
  const all = await cards.count();
  await shell(page)
    .getByPlaceholder(/^Filter Modules/)
    .fill("Stagehand Fixture");
  await expect.poll(() => cards.count()).toBeLessThan(all);
  await expect(cards.first()).toContainText("Stagehand Fixture");
  await app.shot("library");
  await shell(page).getByRole("button", { name: MENU }).click();
  await expect(
    shell(page).getByRole("button", { name: "Export the library" }),
  ).toBeVisible();
  await app.shot("library-menu");
  // Android's Back closes the menu first, and only the menu.
  await back();
  await expect(
    shell(page).getByRole("button", { name: "Export the library" }),
  ).toBeHidden();
  expect(await shownPage(page)).toBe("library");
  await shell(page)
    .getByPlaceholder(/^Filter Modules/)
    .fill("");
}

const EXPORTS = /stagehand-[\w() -]+\.json/g;

/** The library exports in the device's Downloads. */
const exports = (): string[] =>
  adb("shell", "ls", "/sdcard/Download/").match(EXPORTS) ?? [];

/** Until a file that wasn't there before shows up in Downloads. */
async function newExport(before: readonly string[]): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      () => {
        found = exports().find((f) => !before.includes(f));
        return found;
      },
      { timeout: 20_000 },
    )
    .toBeTruthy();
  return found ?? "";
}

/**
 * Export through Save, import that file through Open, OK in the app's
 * dialog. The device's own exports are left alone: the new file is told
 * apart by name.
 */
export async function exportImport(app: App, page: Page): Promise<void> {
  const before = exports();
  await tab(page, /^Library/).click();
  await shell(page).getByRole("button", { name: MENU }).click();
  await shell(page).getByRole("button", { name: "Export the library" }).click();
  await tapNative(/^(SAVE|Save)$/, 20_000);
  const file = await newExport(before);
  // The app opens no picker within 2 s of the last one closing.
  await sleep(2_500);
  await shell(page).getByRole("button", { name: MENU }).click();
  await shell(page).getByRole("button", { name: "Import a library…" }).click();
  await tapNative(new RegExp(`^${file.replace(/[().]/g, "\\$&")}$`), 20_000);
  await waitNative(new RegExp(`Stagehand · ${new URL(SERVER).host}`));
  await waitNative(/Replace the whole library/);
  await app.shot("import-dialog");
  await tapNative(/^OK$/);
  // Our notices go through Foundry's own notifications.
  await expect(
    page.locator("#notifications").getByText("Library imported."),
  ).toBeVisible();
}

/** Launch from our page: the bottom bar's Launch, then the review when it comes. */
export async function launch(page: Page, changes?: string): Promise<void> {
  await recordCompanion(page);
  await shell(page)
    .locator(".stp-dock")
    .getByRole("button", { name: /^Launch/ })
    .click();
  if (!changes) return;
  const review = page.getByRole("dialog", {
    name: `Launch ${TEST_WORLD.title}`,
  });
  await review.getByRole("checkbox", { name: /Back up .* first/ }).uncheck();
  await review
    .getByRole("button", { name: `Apply ${changes} and launch` })
    .click();
}

/**
 * After a launch (phase 7): our launching screen, then our running page on
 * /join, never the game. With changes, the app applies them out of sight
 * (native's cover over the game loading behind it) and comes back to the
 * running page, which says they applied.
 */
export async function waitRunning(
  app: App,
  page: Page,
  changes = 0,
): Promise<void> {
  await expect(page.getByRole("dialog", { name: /^Launching / })).toBeVisible();
  await app.shot("launching");
  if (changes) {
    try {
      await page.waitForURL(/\/game$/, { timeout: 120_000 });
    } catch (error: unknown) {
      // What the phone showed instead of the out-of-sight join.
      await app.shot("applying-never").catch(() => undefined);
      throw error;
    }
    await app.shot("applying");
  }
  await page.waitForURL(/\/join$/, { timeout: 240_000 });
  const run = page.locator("#st-run-root");
  await expect(run.getByRole("button", { name: "Back to Setup" })).toBeVisible({
    timeout: 60_000,
  });
  if (changes)
    await expect(run).toContainText(
      `${String(changes)} changes applied as it opened.`,
      { timeout: 240_000 },
    );
  await expect(run).not.toContainText("Join as Gamemaster");
  await app.shot(changes ? "running-applied" : "running");
}

/** The world's active modules once the companion has applied. */
export async function waitActive(page: Page, want: string[]): Promise<void> {
  await expect
    .poll(() => activeModules(page).catch(() => []), { timeout: 90_000 })
    .toEqual([...want].sort());
}

/**
 * The Update page's Release history, read through native from
 * foundryvtt.com. The local server has nothing newer, so its update check
 * answers with Foundry's real notes as build 371 (as the extension's spec).
 */
export async function releaseHistory(app: App, page: Page): Promise<void> {
  // route.fetch doesn't finish on a WebView: Foundry's answer is read here.
  const release = await foundryRelease();
  const version = await installedVersion();
  await page.route(`${SERVER}/update`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    if (body.action === "previewCompatibility") return route.continue();
    if (body.action !== "updateCheck") return route.abort();
    return route.fulfill({ json: { ...release, build: 371, flags: {} } });
  });
  try {
    await openHistory(page);
    const hist = shell(page).locator(".stu-page .stu-hist");
    await expect(hist.locator(".stu-rels li").first()).toContainText(
      /^\d+\.\d+/,
      { timeout: 30_000 },
    );
    await expect(
      hist.locator(".stu-rels li", { hasText: version }),
    ).toContainText("installed");
    await expect(hist.locator(".stu-hnotes .stu-sec").first()).toBeVisible({
      timeout: 30_000,
    });
    await app.shot("release-history");
  } finally {
    await page.unroute(`${SERVER}/update`);
  }
}

/** The version chip's menu, the Update page, its Release history. */
async function openHistory(page: Page): Promise<void> {
  await shell(page).locator(".sth-ver").click();
  await shell(page)
    .getByRole("region", { name: "Foundry Virtual Tabletop" })
    .getByRole("button", { name: /Update page|See what's new/ })
    .click();
  await shell(page)
    .locator(".stu-page")
    .getByRole("button", { name: "All release notes" })
    .click();
}

/** Foundry's update check as an admin, forced: its newest release and notes. */
async function foundryRelease(): Promise<Record<string, unknown>> {
  const api = await createAdminClient(env.url);
  try {
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    const r = await api.post("/update", {
      data: { action: "updateCheck", forceUpdate: true },
    });
    return (await r.json()) as Record<string, unknown>;
  } finally {
    await api.dispose();
  }
}

/**
 * Home as Stagehand settings: Release history allowed there; Back
 * returns to the server's Setup. Returns that page found again (looking
 * for home may have needed a new connection).
 */
export async function allowReleaseHistory(app: App, page: Page): Promise<Page> {
  await tab(page, /^Worlds/).click();
  await shell(page)
    .getByRole("button", { name: /Stagehand settings/ })
    .click();
  const home = await app.pageAt(HOME);
  const release = home.getByRole("switch", { name: "Release history" });
  await expect(release).toHaveAttribute("aria-checked", "false");
  await release.click();
  await expect(release).toHaveAttribute("aria-checked", "true");
  await back();
  const server = await app.pageAt(SERVER);
  await expect(shell(server).locator(".stp-top")).toBeVisible();
  return server;
}
