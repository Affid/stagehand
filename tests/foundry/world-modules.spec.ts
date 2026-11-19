// Stagehand's library view in Module Management, end to end on the local
// Foundry (docs/IN-WORLD-LIBRARY-PLAN.md, phase 2e): Setup's cards inside
// the window, changes saved through the review, Foundry's own save kept
// from writing our view as an empty module list on every path, the
// setting, an Assistant, a player, no library, and the light interface.
// Needs only Foundry and the linked companion, not the extension.
import { rmSync } from "node:fs";
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
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import {
  ensureUsers,
  joinAs,
  reloadWorld,
} from "../../scripts/foundry/session.ts";
import { TEST_USERS, TEST_WORLD } from "../../scripts/foundry/world.ts";
import { CORE } from "./core.ts";
import { SCREENS } from "./extension.ts";
import { ON_APP } from "./target.ts";
import {
  A,
  card,
  closeModules,
  dialog,
  LIB,
  libraryFile,
  openModules,
  placeLibrary,
  setSetting,
  win,
} from "./world-view.ts";

test.skip(ON_APP, "the companion's view: one run, with the extension's suite");
test.describe.configure({ mode: "serial" });

const env = loadFoundryEnv();
const shot = (name: string): string =>
  join(SCREENS, `world-modules-${String(CORE.generation)}-${name}.png`);

let restoreLibrary: () => void = () => undefined;
let admin: APIRequestContext;
let browser: Browser;
let gm: Page;

const activeIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [
      ...(
        globalThis as unknown as {
          game: { modules: Map<string, { id: string; active: boolean }> };
        }
      ).game.modules.values(),
    ]
      .filter((m) => m.active)
      .map((m) => m.id)
      .sort(),
  );

/** Counts writes of core's module configuration from now on. */
async function watchSaves(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      game: { settings: { set: (...a: unknown[]) => Promise<unknown> } };
      __stSaves?: number;
      __stOriginalSet?: (...a: unknown[]) => Promise<unknown>;
    };
    g.__stSaves = 0;
    const original =
      g.__stOriginalSet ?? g.game.settings.set.bind(g.game.settings);
    g.__stOriginalSet = original;
    g.game.settings.set = (...args: unknown[]) => {
      if (args[0] === "core" && args[1] === "moduleConfiguration")
        g.__stSaves = (g.__stSaves ?? 0) + 1;
      return original(...args);
    };
  });
  return () =>
    page.evaluate(
      () => (globalThis as unknown as { __stSaves: number }).__stSaves,
    );
}

test.beforeAll(async () => {
  restoreLibrary = placeLibrary(env.dataDir);
  await resetWorldModules(env);
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await launchWorld(admin, TEST_WORLD.id);
  browser = await chromium.launch();
  gm = await joinAs(browser, env.url, "Gamemaster");
  await ensureUsers(gm, TEST_USERS);
});

test.afterAll(async () => {
  restoreLibrary();
  await browser.close();
  try {
    await shutdownWorld(admin, env.adminPassword);
  } finally {
    await admin.dispose();
  }
  await resetWorldModules(env);
});

test("a Gamemaster's Module Management shows the library's folders as cards", async () => {
  const w = await openModules(gm);

  await expect(w.locator(".stagehand-view")).toBeVisible();
  await expect(
    w.locator(".stw-head").filter({ hasText: "Fixtures" }),
  ).toBeVisible();
  await expect(card(w, A)).toBeVisible();
  await expect(w.locator("li.package")).toHaveCount(0);
  await expect(w.locator(".window-header")).toBeVisible();
  const box = await w.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(1160);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(700);
  await card(w, A).locator("button.t").click();
  await expect(w.locator(".sts-panel")).toContainText("Needs the library");
  await expect(w.locator(".sts-panel")).toContainText("Fixture pair");
  await gm.screenshot({ path: shot("cards") });
  await closeModules(gm);
});

test("on a short screen the window fits: the cards scroll, Save stays in view", async () => {
  await gm.setViewportSize({ width: 1600, height: 600 });
  try {
    const w = await openModules(gm);
    await expect(w.locator(".stagehand-view")).toBeVisible();
    await expect
      .poll(async () => {
        const box = await w.boundingBox();
        return (box?.y ?? 0) + (box?.height ?? 0);
      })
      .toBeLessThanOrEqual(600);
    await expect(
      w.getByRole("button", { name: /Save Module Settings/ }),
    ).toBeInViewport();
    await closeModules(gm);
  } finally {
    await gm.setViewportSize({ width: 1600, height: 1000 });
  }
});

test("the window is resizable and keeps its size through Foundry's redraws", async () => {
  const w = await openModules(gm);
  const handle = w.locator(".window-resize-handle");
  await expect(handle).toBeVisible();
  const h = await handle.boundingBox();
  if (!h) throw new Error("no resize handle");
  await gm.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await gm.mouse.down();
  await gm.mouse.move(h.x + h.width / 2 - 80, h.y + h.height / 2 - 120, {
    steps: 8,
  });
  await gm.mouse.up();
  const resized = await w.boundingBox();
  await gm.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { render(): Promise<unknown> }>;
        };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.render();
  });
  await expect(w.locator(".stagehand-view")).toBeVisible();
  const redrawn = await w.boundingBox();
  expect(Math.round(redrawn?.height ?? 0)).toBe(
    Math.round(resized?.height ?? 1),
  );
  expect(Math.round(redrawn?.width ?? 0)).toBe(Math.round(resized?.width ?? 1));
  await closeModules(gm);
});

test("Foundry's save never writes the view as an empty module list", async () => {
  const saves = await watchSaves(gm);
  const before = await activeIds(gm);
  const w = await openModules(gm);
  await w
    .getByRole("switch", { name: /Stagehand Fixture: library on in/ })
    .click();
  await expect(card(w, LIB)).toHaveClass(/plus/);

  // Enter in the filter: no submit at all
  await w.getByRole("searchbox", { name: "Filter modules" }).press("Enter");
  // A submit of Foundry's form, and a save from code: our review instead
  await gm.evaluate(() => {
    document
      .querySelector<HTMLFormElement>("#module-management")
      ?.requestSubmit();
  });
  await expect(dialog(gm, "Review Changes")).toBeVisible();
  await dialog(gm, "Review Changes")
    .getByRole("button", { name: "Back" })
    .click();
  await expect(dialog(gm, "Review Changes")).toHaveCount(0);
  await gm.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { submit(): Promise<unknown> }>;
        };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.submit();
  });
  await expect(dialog(gm, "Review Changes")).toBeVisible();
  await dialog(gm, "Review Changes")
    .getByRole("button", { name: "Back" })
    .click();
  await expect(dialog(gm, "Review Changes")).toHaveCount(0);
  // Foundry drawing the window again keeps the view and the change
  await gm.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { render(): Promise<unknown> }>;
        };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.render();
  });
  await expect(card(win(gm), LIB)).toHaveClass(/plus/);
  await expect(win(gm).locator(".stagehand-view")).toHaveCount(1);

  expect(await saves()).toBe(0);
  expect(await activeIds(gm)).toEqual(before);
  await closeModules(gm);
});

test("a switch is saved through the review, with what the module needs", async () => {
  const w = await openModules(gm);
  await w
    .getByRole("switch", { name: /Fixture: A \(requires library\) on in/ })
    .click();
  await expect(w.locator(".stc-pending")).toContainText("not saved yet");

  await w.getByRole("button", { name: /Save Module Settings/ }).click();
  const review = dialog(gm, "Review Changes");
  await expect(review).toContainText("Added as dependencies");
  await expect(review).toContainText("Stagehand Fixture: library");
  await gm.screenshot({ path: shot("review") });
  await review.getByRole("button", { name: "Save & Reload" }).click();
  await gm.waitForEvent("load", { timeout: 60_000 });
  await reloadWorld(gm);

  expect(await activeIds(gm)).toEqual(
    expect.arrayContaining([A, LIB, "stagehand"]),
  );
});

test("turning off a module another needs waits for the choice", async () => {
  const w = await openModules(gm);
  await w
    .getByRole("switch", { name: /Stagehand Fixture: library on in/ })
    .click();
  await w.getByRole("button", { name: /Save Module Settings/ }).click();
  const review = dialog(gm, "Review Changes");
  await expect(review).toContainText("Still needed by modules that stay");

  await review.getByRole("button", { name: "Save & Reload" }).click();

  await expect(gm.locator("#notifications")).toContainText(
    "turn off the modules that need it too",
  );
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Back" }).click();
  await expect(review).toHaveCount(0);
  await w.getByRole("button", { name: "Discard" }).click();
  await closeModules(gm);
});

test("Apply preset marks the preset's modules, active once all are on", async () => {
  const w = await openModules(gm);

  await w.getByRole("button", { name: /Apply preset/ }).click();
  const pick = dialog(gm, "Apply Preset");
  await expect(pick.locator(".stagehand-preset.active")).toContainText(
    "Fixture pair",
  );
  await gm.screenshot({ path: shot("preset") });
  await pick.getByLabel(/Remove/).check();
  await pick.locator('input[name="preset"][value="p1"]').check();
  await pick.getByRole("button", { name: "Mark Changes" }).click();

  await expect(card(w, A)).toHaveClass(/minus/);
  await expect(card(w, LIB)).toHaveClass(/minus/);
  await w.getByRole("button", { name: "Discard" }).click();
  await expect(card(w, A)).not.toHaveClass(/minus/);
  await closeModules(gm);
});

test("with the setting off, Module Management is Foundry's own", async () => {
  await setSetting(gm, "stagehand", "libraryView", false);
  const w = await openModules(gm);

  await expect(w.locator("li.package").first()).toBeVisible();
  await expect(w.locator(".stagehand-view")).toHaveCount(0);
  await closeModules(gm);
  await setSetting(gm, "stagehand", "libraryView", true);
});

test("an Assistant gets the view and its switches, without Apply preset", async () => {
  const page = await joinAs(browser, env.url, "Assistant");
  try {
    const w = await openModules(page);
    await expect(w.locator(".stagehand-view")).toBeVisible();
    await expect(w.getByRole("switch").first()).toBeEnabled();
    await expect(w.getByRole("button", { name: /Apply preset/ })).toHaveCount(
      0,
    );
  } finally {
    await page.context().close();
  }
});

test("a player gets Foundry's own list", async () => {
  const page = await joinAs(browser, env.url, "Player1");
  try {
    const w = await openModules(page);
    await expect(w.locator(".stagehand-view")).toHaveCount(0);
    await expect(w.locator("li.package").first()).toBeVisible();
  } finally {
    await page.context().close();
  }
});

test("the light interface draws the view light", async () => {
  const ui = await gm.evaluate(async () => {
    const g = globalThis as unknown as {
      game: {
        settings: {
          get(n: string, k: string): Record<string, unknown>;
          set(n: string, k: string, v: object): Promise<unknown>;
        };
      };
    };
    const now = g.game.settings.get("core", "uiConfig");
    await g.game.settings.set("core", "uiConfig", {
      ...now,
      colorScheme: { applications: "light", interface: "light" },
    });
    return now;
  });
  try {
    const w = await openModules(gm);
    await expect(w.locator(".stagehand-view")).toBeVisible();
    await gm.screenshot({ path: shot("light") });
    // Stagehand's card is always on, whatever the tests before did.
    const title = await card(w, "stagehand")
      .locator("button.t")
      .evaluate((el) => getComputedStyle(el).color);
    expect(title).toBe("rgb(30, 26, 22)");
    await closeModules(gm);
  } finally {
    await gm.evaluate(
      (saved) =>
        (
          globalThis as unknown as {
            game: {
              settings: {
                set(n: string, k: string, v: object): Promise<unknown>;
              };
            };
          }
        ).game.settings.set("core", "uiConfig", saved),
      ui,
    );
  }
});

test("without a library file, Module Management is Foundry's own", async () => {
  rmSync(libraryFile(env.dataDir), { force: true });
  // The library is read once per page: a new page reads it again.
  await reloadWorld(gm);

  const w = await openModules(gm);

  await expect(w.locator("li.package").first()).toBeVisible();
  await expect(w.locator(".stagehand-view")).toHaveCount(0);
  await closeModules(gm);
});
