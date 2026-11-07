// Page widths of the new Setup page (Phase 6), against the prototype's own
// boxes (measured with scripts/dev/layout-compare.ts): 2560 keeps Foundry's
// 1200 px window for the middle pane; 1366 fits three columns; 1280 narrows
// the rail and floats the details panel over the page.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let page: Page;

const shell = (p: Page) => p.locator("#ml-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
});

interface Box {
  readonly x: number;
  readonly w: number;
}

async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error("not shown");
  return { x: Math.round(b.x), w: Math.round(b.width) };
}

/** The world page and the Library with a module's details open. */
async function measure(w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await shell(page).locator(".mls-world").first().click();
  const world = {
    rail: await box(shell(page).locator(".mls-rail")),
    main: await box(shell(page).locator(".mls-main")),
  };
  await page.screenshot({ path: `${SCREENS}/layout-world-${String(w)}.png` });
  await shell(page).locator(".mls-lib").click();
  await shell(page).locator(".mls-main button.t").first().click();
  const panel = shell(page).locator(".mls-panel");
  const library = {
    main: await box(shell(page).locator(".mls-main")),
    panel: await box(panel),
    // From the header's foot to 16 px above the window's.
    panelBottom: Math.round(
      ((await panel.boundingBox())?.y ?? 0) +
        ((await panel.boundingBox())?.height ?? 0),
    ),
    floats: await panel.evaluate((e) => getComputedStyle(e).position),
  };
  await page.screenshot({ path: `${SCREENS}/layout-library-${String(w)}.png` });
  await panel.getByRole("button", { name: "Close" }).click();
  return { world, library };
}

test("2560: the middle pane keeps Foundry's 1200 px, beside the rail", async () => {
  const m = await measure(2560, 1440);
  expect(m.world.rail).toEqual({ x: 24, w: 290 });
  expect(m.world.main).toEqual({ x: 330, w: 1200 });
  expect(m.library.panel).toEqual({ x: 1546, w: 340 });
  expect(await box(shell(page).locator(".mls-top"))).toEqual({ x: 0, w: 2560 });
});

test("1366: three columns, as the prototype", async () => {
  const m = await measure(1366, 768);
  expect(m.world.rail).toEqual({ x: 24, w: 290 });
  expect(m.world.main).toEqual({ x: 330, w: 1012 });
  expect(m.library.main).toEqual({ x: 330, w: 656 });
  expect(m.library.panel).toEqual({ x: 1002, w: 340 });
});

test("1280: a narrower rail; the details float over the page", async () => {
  const m = await measure(1280, 800);
  expect(m.world.rail).toEqual({ x: 24, w: 240 });
  expect(m.world.main).toEqual({ x: 280, w: 976 });
  expect(m.library.main).toEqual({ x: 280, w: 976 });
  expect(m.library.floats).toBe("fixed");
  expect(m.library.panel).toEqual({ x: 924, w: 340 });
  expect(m.library.panelBottom).toBe(800 - 16);
});

test("1366 with a side panel: the selection bar keeps Done inside the page", async () => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const main = shell(page).locator(".mls-main");
  await shell(page).locator(".mls-lib").click();
  await main.getByRole("button", { name: "Presets" }).click();
  await main.getByRole("button", { name: "Select" }).click();
  const done = await box(main.getByRole("button", { name: "Done" }));
  const pane = await box(main);
  expect(done.x + done.w).toBeLessThanOrEqual(pane.x + pane.w);
  await main.getByRole("button", { name: "Done" }).click();
  await shell(page)
    .locator(".mls-panel")
    .getByRole("button", { name: "Close" })
    .click();
});
