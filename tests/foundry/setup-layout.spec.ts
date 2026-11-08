// Page widths of the new Setup page (Phase 6). 1366 fits three columns as
// the prototype; from there to 2560 the rail grows to 400 px and the details
// panel to 460 px, and the middle pane fills the rest, so wide screens have
// no empty gap (owner, 2026-11-07) and the cards get the room (polish pass:
// growing the side panes with the screen left them half empty at 2560);
// 1280 narrows the rail and floats the details panel over the page.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
let ext: Target;
let page: Page;

const shell = (p: Page) => p.locator("#ml-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
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

test("2560: the side panes at their widest, the middle pane fills the rest", async () => {
  const m = await measure(2560, 1440);
  expect(m.world.rail).toEqual({ x: 24, w: 400 });
  expect(m.world.main).toEqual({ x: 440, w: 2096 });
  expect(m.library.main).toEqual({ x: 440, w: 1620 });
  expect(m.library.panel).toEqual({ x: 2076, w: 460 });
  expect(await box(shell(page).locator(".mls-top"))).toEqual({ x: 0, w: 2560 });
});

test("1920: the side panes part of the way between 1366 and 2560", async () => {
  const m = await measure(1920, 1080);
  expect(m.world.rail).toEqual({ x: 24, w: 341 });
  expect(m.world.main).toEqual({ x: 381, w: 1515 });
  expect(m.library.main).toEqual({ x: 381, w: 1103 });
  expect(m.library.panel).toEqual({ x: 1500, w: 396 });
});

test("3440: past 2560 only the middle pane grows; still no gap", async () => {
  const m = await measure(3440, 1440);
  expect(m.world.rail).toEqual({ x: 24, w: 400 });
  expect(m.world.main).toEqual({ x: 440, w: 2976 });
  expect(m.library.panel).toEqual({ x: 2956, w: 460 });
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

test("2560: By world columns keep their width; the frame ends at the table (polish)", async () => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await shell(page).locator(".mls-lib").click();
  await shell(page)
    .locator(".mls-main")
    .getByRole("tab", { name: /By world/ })
    .click();
  const heads = shell(page).locator(".mll-grid thead th.w");
  const n = await heads.count();
  expect(n).toBeGreaterThan(0);
  for (const w of await heads.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width)),
  ))
    expect(w).toBe(92);
  const table = await box(shell(page).locator(".mll-grid"));
  expect(table.w).toBe(250 + n * 92);
  // The frame holds the table and no more (its border and scrollbar
  // gutter aside).
  expect(
    await shell(page)
      .locator(".mll-gridwrap")
      .evaluate((e) => e.clientWidth),
  ).toBe(table.w);
  await page.screenshot({ path: `${SCREENS}/layout-grid-2560.png` });
  await shell(page)
    .locator(".mls-main")
    .getByRole("tab", { name: /^Modules/ })
    .click();
});

test("1366×768: a long grid scrolls down without cutting the last world (review)", async () => {
  // Its own browser with scrollbars that take room, as a desktop Chrome.
  const own = await loadTarget([], { scrollbars: true });
  try {
    const p = await own.context.newPage();
    await p.setViewportSize({ width: 1366, height: 768 });
    await openSetupAsAdmin(own, p, env.url, env.adminPassword);
    await shell(p).locator(".mls-lib").click();
    await shell(p)
      .locator(".mls-main")
      .getByRole("tab", { name: /By world/ })
      .click();
    const frame = shell(p).locator(".mll-gridwrap");
    await expect(frame).toBeVisible();
    const m = await frame.evaluate((e) => ({
      down: e.scrollHeight > e.clientHeight,
      gutter: (e as HTMLElement).offsetWidth - e.clientWidth - 2,
      sideways: e.scrollWidth - e.clientWidth,
    }));
    expect(m.down).toBe(true);
    expect(m.gutter).toBeGreaterThan(0);
    expect(m.sideways).toBe(0);
    await p.screenshot({ path: `${SCREENS}/layout-grid-1366.png` });
  } finally {
    await own.context.close();
  }
});

test("2560: the server pages fill the screen too", async () => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  const top = shell(page).locator(".mls-top");
  for (const name of ["Backups", "Configuration"]) {
    await top.getByRole("button", { name }).click();
    expect(await box(shell(page).locator(".mls-main"))).toEqual({
      x: 440,
      w: 2096,
    });
  }
});

test("1366×768: the Library's lists scroll under their head (owner's bug)", async () => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const main = shell(page).locator(".mls-main");
  await shell(page).locator(".mls-lib").click();
  const tabs: readonly [RegExp, string][] = [
    [/^Modules/, ".mll-sections"],
    [/^Systems/, ".mll-systems"],
  ];
  for (const [tab, list] of tabs) {
    await main.getByRole("tab", { name: tab }).click();
    const box = main.locator(list);
    // Inside the window, whatever the list holds: it scrolls, not spills.
    const bottom = await box.evaluate((e) => e.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(768);
    expect(await box.evaluate((e) => getComputedStyle(e).overflowY)).toBe(
      "auto",
    );
  }
  await main.getByRole("tab", { name: /^Modules/ }).click();
  const sections = main.locator(".mll-sections");
  const tall = await sections.evaluate((e) => e.scrollHeight > e.clientHeight);
  expect(tall).toBe(true);
  // The last module comes into view by scrolling the list, head kept.
  await main.locator(".mll-card").last().scrollIntoViewIfNeeded();
  await expect(main.locator(".mll-card").last()).toBeInViewport();
  await expect(main.getByRole("tab", { name: /^Modules/ })).toBeInViewport();
  expect(await sections.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
});
