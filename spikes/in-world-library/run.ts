// Spike runner (in-world library plan, phase 1). Against a private Foundry
// server that is already running (FOUNDRY_PORT, FOUNDRY_DATA_DIR): links the
// spike module, installs BBMM, and checks Stagehand's view inside Module
// Management with and without BBMM, for a Gamemaster and a player. Restores the
// world's modules and uninstalls BBMM afterwards. Results and screenshots go to
// out/<core>/. Run: FOUNDRY_PORT=30014 FOUNDRY_DATA_DIR=~/foundry/data-14spike node spikes/in-world-library/run.ts
import {
  existsSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import * as admin from "../../scripts/foundry/admin.ts";
import { joinAs, reloadWorld } from "../../scripts/foundry/session.ts";
import { loadFoundryEnv, readEnv } from "../../scripts/foundry/env.ts";

const require = createRequire(import.meta.url);
const { chromium } =
  require("@playwright/test") as typeof import("@playwright/test");

const env = loadFoundryEnv();
const HERE = import.meta.dirname;
const WORLD = "stagehand-test";
const SPIKE = "st-spike-mm";
const BBMM_MANIFEST =
  "https://github.com/thejoester/bbmm/releases/latest/download/module.json";
const results: { name: string; ok: boolean; detail?: unknown }[] = [];
const check = (name: string, ok: boolean, detail?: unknown): void => {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`,
  );
};

type Spike = {
  renders: number;
  takes: number;
  mounts: number;
  submitsBlocked: number;
  importMs: number | null;
  cssLoaded: boolean;
  errors: string[];
};
const spike = (page: Page): Promise<Spike> =>
  page.evaluate(
    () => (globalThis as unknown as { __stSpike: Spike }).__stSpike,
  );

async function setModules(
  page: Page,
  changes: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  return page.evaluate(async (c) => {
    const g = globalThis as unknown as {
      game: {
        settings: {
          get(n: string, k: string): Record<string, boolean>;
          set(n: string, k: string, v: object): Promise<unknown>;
        };
      };
    };
    const before = g.game.settings.get("core", "moduleConfiguration");
    await g.game.settings.set("core", "moduleConfiguration", {
      ...before,
      ...c,
    });
    return before;
  }, changes);
}

async function openCore(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          sidebar: {
            apps: {
              ModuleManagement: new () => {
                render(o: object): Promise<unknown>;
              };
            };
          };
        };
      };
    };
    await new g.foundry.applications.sidebar.apps.ModuleManagement().render({
      force: true,
    });
  });
  await page.locator("#module-management").waitFor();
}

async function closeCore(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: { instances: Map<string, { close(): Promise<unknown> }> };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.close();
  });
}

async function withoutBbmm(page: Page, out: string): Promise<void> {
  await openCore(page);
  await page.locator(".st-spike-view").waitFor({ timeout: 10_000 });
  const win = page.locator("#module-management");
  const first = await spike(page);
  const box = await win.boundingBox();
  check(
    "our view replaces the window's content",
    (await win.locator(".st-spike-card").count()) > 0 &&
      (await win.locator("li.package").count()) === 0,
  );
  check(
    "the window takes the cards' width",
    Math.round(box?.width ?? 0) === 1160,
    box?.width,
  );
  check(
    "Preact loads on demand from the module",
    first.mounts === 1 && first.importMs !== null,
    { importMs: first.importMs },
  );
  check("its CSS loads from the module", first.cssLoaded);
  check(
    "Foundry's header stays",
    (await win.locator("header.window-header .window-title").count()) === 1,
  );
  await page.screenshot({ path: join(out, "1-view.png") });

  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { render(): Promise<unknown> }>;
        };
      };
    };
    await g.foundry.applications.instances.get("module-management")?.render();
  });
  await page.waitForTimeout(500);
  const again = await spike(page);
  const box2 = await win.boundingBox();
  check(
    "a Foundry re-render draws our view again",
    again.takes === first.takes + 1 &&
      (await win.locator(".st-spike-view").count()) === 1 &&
      (await win.locator("li.package").count()) === 0,
  );
  check(
    "a re-render keeps the width",
    Math.round(box2?.width ?? 0) === 1160,
    box2?.width,
  );

  const before = await page.evaluate(() =>
    JSON.stringify(
      (
        globalThis as unknown as {
          game: { settings: { get(n: string, k: string): object } };
        }
      ).game.settings.get("core", "moduleConfiguration"),
    ),
  );
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      game: { settings: { set: (...a: unknown[]) => Promise<unknown> } };
      __stSets: unknown[];
    };
    g.__stSets = [];
    const original = g.game.settings.set.bind(g.game.settings);
    g.game.settings.set = (...args: unknown[]) => {
      g.__stSets.push(args.slice(0, 2));
      return original(...args);
    };
  });
  await win.locator(".st-spike-save").click();
  await page.waitForTimeout(800);
  const sets = await page.evaluate(
    () => (globalThis as unknown as { __stSets: unknown[] }).__stSets,
  );
  const after = await page.evaluate(() =>
    JSON.stringify(
      (
        globalThis as unknown as {
          game: { settings: { get(n: string, k: string): object } };
        }
      ).game.settings.get("core", "moduleConfiguration"),
    ),
  );
  check(
    "the guard stops Foundry's save on submit",
    (await spike(page)).submitsBlocked >= 1 && sets.length === 0,
    { sets },
  );
  check("the world's modules are untouched", before === after);
  await closeCore(page);

  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      game: {
        settings: {
          get(n: string, k: string): Record<string, unknown>;
          set(n: string, k: string, v: object): Promise<unknown>;
        };
      };
    };
    const ui = g.game.settings.get("core", "uiConfig");
    (globalThis as unknown as { __stUi: unknown }).__stUi = ui;
    await g.game.settings.set("core", "uiConfig", {
      ...ui,
      colorScheme: { applications: "light", interface: "light" },
    });
  });
  await openCore(page);
  await page.locator(".st-spike-view").waitFor();
  await page.screenshot({ path: join(out, "2-light.png") });
  check(
    "the light interface draws the window light",
    await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector("#module-management") as Element,
        ).colorScheme.includes("light") ||
        document.body.classList.contains("theme-light"),
    ),
  );
  await closeCore(page);
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      game: {
        settings: { set(n: string, k: string, v: unknown): Promise<unknown> };
      };
      __stUi: unknown;
    };
    await g.game.settings.set("core", "uiConfig", g.__stUi);
  });
}

async function withBbmm(page: Page, out: string): Promise<void> {
  // BBMM opens its changelog window on first load; close BBMM's windows, then open the sidebar's Settings tab.
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<string, { id: string; close(): Promise<unknown> }>;
        };
      };
      ui: {
        sidebar: { expand(): void; changeTab(t: string, g: string): void };
      };
    };
    for (const app of [...g.foundry.applications.instances.values()])
      if (app.id.startsWith("bbmm")) await app.close();
    g.ui.sidebar.expand();
    g.ui.sidebar.changeTab("settings", "primary");
  });
  await page.waitForTimeout(500);
  const button = page
    .locator(
      '#sidebar button[data-app="modules"], #sidebar button[data-action="moduleManagement"]',
    )
    .first();
  await button.waitFor();
  const tip = await button.getAttribute("data-tooltip");
  check(
    "BBMM's tooltip is on the sidebar button",
    (tip ?? "").includes("Shift"),
    tip,
  );
  await button.click();
  await page.waitForTimeout(1500);
  check(
    "a plain click opens BBMM's window, not Foundry's",
    (await page.locator("#bbmm-module-manager").count()) === 1 &&
      (await page.locator("#module-management").count()) === 0,
  );
  await page.screenshot({ path: join(out, "3-bbmm-click.png") });
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: { instances: Map<string, { close(): Promise<unknown> }> };
      };
    };
    await g.foundry.applications.instances.get("bbmm-module-manager")?.close();
  });
  await button.click({ modifiers: ["Shift"] });
  await page
    .locator("#module-management .st-spike-view")
    .waitFor({ timeout: 10_000 });
  check(
    "Shift-click opens Foundry's window with our view",
    (await page.locator("#module-management .st-spike-card").count()) > 0,
  );
  check(
    "BBMM's header button sits beside our view",
    (await page.locator("#module-management .bbmm-header-menu-btn").count()) ===
      1,
  );
  await page.screenshot({ path: join(out, "4-bbmm-shift.png") });
  await closeCore(page);
}

async function asPlayer(browser: Browser, out: string): Promise<void> {
  const page = await joinAs(browser, env.url, "Player1");
  await openCore(page);
  await page.waitForTimeout(800);
  check(
    "a player gets Foundry's own list",
    (await page.locator("#module-management li.package").count()) > 0 &&
      (await page.locator("#module-management .st-spike-view").count()) === 0,
  );
  await page.screenshot({ path: join(out, "5-player.png") });
  await page.context().close();
}

async function main(): Promise<void> {
  const password = readEnv("FOUNDRY_ADMIN_PASSWORD");
  const link = join(env.dataDir, "Data", "modules", SPIKE);
  if (!existsSync(link)) symlinkSync(join(HERE, "module"), link, "dir");
  const api = await admin.createAdminClient(env.url);
  if (await admin.hasActiveWorld(api)) await admin.shutdownWorld(api, password);
  await admin.loginAsAdmin(api, password, join(env.dataDir, "Config"));
  const bbmmFile = join(env.dataDir, "Data", "modules", "bbmm", "module.json");
  if (!existsSync(bbmmFile))
    await admin.installPackage(
      api,
      { id: "bbmm", manifest: BBMM_MANIFEST } as never,
      "module",
      bbmmFile,
    );
  await admin.launchWorld(api, WORLD);

  const browser = await chromium.launch();
  let gm: Page | null = null;
  let core = "unknown";
  try {
    gm = await joinAs(browser, env.url, "Gamemaster");
    const page = gm;
    core = await page.evaluate(
      () =>
        (globalThis as unknown as { game: { version: string } }).game.version,
    );
    const out = join(HERE, "out", core);
    mkdirSync(out, { recursive: true });
    await setModules(page, { [SPIKE]: true, bbmm: false });
    await reloadWorld(page);
    check(
      `Foundry ${core}: spike module on`,
      await page.evaluate(() => "__stSpike" in globalThis),
    );
    await withoutBbmm(page, out);
    await setModules(page, { [SPIKE]: true, bbmm: true });
    await reloadWorld(page);
    await withBbmm(page, out);
    await asPlayer(browser, out);
    const errors = (await spike(page)).errors;
    check("no errors from the spike", errors.length === 0, errors);
    writeFileSync(
      join(out, "results.json"),
      JSON.stringify({ core, results }, null, 2),
    );
  } catch (error) {
    check(
      "the run finished",
      false,
      String((error as Error)?.message ?? error).split("\n")[0],
    );
    if (gm)
      await gm
        .screenshot({ path: join(HERE, "out", `${core}-failure.png`) })
        .catch(() => undefined);
  } finally {
    // Back to the world's own module list: the spike's and BBMM's entries removed, whatever a run left.
    if (gm) {
      await gm
        .evaluate(
          async (ids) => {
            const g = globalThis as unknown as {
              game: {
                settings: {
                  get(n: string, k: string): Record<string, boolean>;
                  set(n: string, k: string, v: object): Promise<unknown>;
                };
              };
            };
            const now = {
              ...g.game.settings.get("core", "moduleConfiguration"),
            };
            for (const id of ids) delete now[id];
            await g.game.settings.set("core", "moduleConfiguration", now);
          },
          [SPIKE, "bbmm"],
        )
        .catch((e: unknown) => console.error("restore failed", e));
    }
    await browser.close();
    await admin.shutdownWorld(api, password);
    await admin
      .setupPost(api, {
        action: "uninstallPackage",
        type: "module",
        id: "bbmm",
      } as never)
      .catch(() => undefined);
    if (existsSync(link)) unlinkSync(link);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `Foundry ${core}: ${results.length - failed} passed, ${failed} failed`,
  );
  process.exitCode = failed ? 1 : 0;
}

await main();
