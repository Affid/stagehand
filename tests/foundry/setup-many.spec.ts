// Many worlds and modules on the new Setup page (Phase 6), as the
// prototype's checks/busy.mjs and gridwide.mjs: 30 test worlds and 120 stub
// modules are added to the local server for this suite and taken away after.
import { expect, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { addMany, countMany, removeMany } from "../../scripts/foundry/many.ts";
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
const main = (p: Page) => shell(p).locator(".mls-main");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(10 * 60_000);
  if (countMany().worlds < 30) await addMany(30, 120);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
  await removeMany();
});

test("the rail scrolls; it fades while more worlds are below, not at the end", async () => {
  const list = shell(page).locator(".mls-worlds");
  await expect(list.locator(".mls-world")).toHaveCount(32);
  await expect(list).toHaveClass(/\bmore\b/);
  // News and Featured Content stay below the list, in view.
  const news = await shell(page).locator(".mlr-feat").boundingBox();
  expect((news?.y ?? 0) + (news?.height ?? 0)).toBeLessThanOrEqual(768);
  await page.screenshot({ path: `${SCREENS}/many-rail-1366.png` });
  await list.evaluate((l) => {
    l.scrollTop = l.scrollHeight;
  });
  await expect(list).not.toHaveClass(/\bmore\b/);
});

test("By world: 92 px columns at least, names and headers pinned, a fade while worlds are hidden", async () => {
  await shell(page).locator(".mls-lib").click();
  await main(page)
    .getByRole("tab", { name: /By world/ })
    .click();
  const wrap = main(page).locator(".mll-gridwrap");
  await expect(wrap.locator("thead th.w")).toHaveCount(32);
  const col = await wrap.locator("thead th.w").first().boundingBox();
  expect(col?.width).toBeGreaterThanOrEqual(92);
  await expect(wrap).toHaveClass(/more-right/);
  // Long world titles stay inside their column (two lines, then cut).
  const spill = await wrap.locator("thead th.w").evaluateAll(
    (ths) =>
      ths.filter((th) => {
        const t = th.querySelector(".t");
        return t
          ? t.getBoundingClientRect().width > th.getBoundingClientRect().width
          : false;
      }).length,
  );
  expect(spill).toBe(0);
  await page.screenshot({ path: `${SCREENS}/many-grid-1366.png` });
  const name = wrap.locator(`tbody th[scope="row"]`).first();
  const before = await name.boundingBox();
  await wrap.evaluate((w) => {
    w.scrollLeft = w.scrollWidth;
    w.scrollTop = 200;
  });
  // The module names stay at the left; the world headers at the top.
  await expect.poll(async () => (await name.boundingBox())?.x).toBe(before?.x);
  const head = await wrap.locator("thead th.w").last().boundingBox();
  const box = await wrap.boundingBox();
  expect(Math.round(head?.y ?? 0)).toBeLessThanOrEqual(
    Math.round(box?.y ?? 0) + 2,
  );
  await expect(wrap).not.toHaveClass(/more-right/);
});

test("By world: Show narrows the worlds and says how many", async () => {
  await main(page)
    .getByRole("combobox", { name: "Show" })
    .selectOption({ label: "Played in the last 3 months" });
  const shown = await main(page).locator(".mll-gridwrap thead th.w").count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(32);
  await expect(main(page)).toContainText(`${String(shown)} of 32 worlds`);
  await main(page)
    .getByRole("combobox", { name: "Show" })
    .selectOption({ label: "All worlds" });
});

test("a module's details list every world and scroll", async () => {
  await main(page)
    .getByRole("tab", { name: /Modules/ })
    .click();
  await expect(main(page).locator(".mll-card")).toHaveCount(139);
  await main(page).locator("button.t").first().click();
  const panel = shell(page).locator(".mls-panel");
  await expect(panel.locator(".mls-wlist li")).toHaveCount(32);
  const scrolls = await panel
    .locator(".scroll")
    .evaluate((s) => s.scrollHeight > s.clientHeight);
  expect(scrolls).toBe(true);
  await page.screenshot({ path: `${SCREENS}/many-panel-1366.png` });
  await panel.getByRole("button", { name: "Close" }).click();
});

test("intake: a new module offers only its worlds at first, the rest one click away", async () => {
  // Every test world reports its modules; one stub counts as newly installed.
  await ext.worker.evaluate(
    async ([url, now]) => {
      const keyS = `snapshots:${url}`;
      const keyO = `sorted:${url}`;
      const all = await chrome.storage.local.get([keyS, keyO]);
      const snaps: Record<string, unknown> = {};
      for (let i = 1; i <= 30; i++) {
        const id = `ml-many-${String(i).padStart(3, "0")}`;
        snaps[id] = {
          worldId: id,
          title: id,
          system: { id: "dnd5e", version: "1" },
          coreVersion: "14.370",
          active: [{ id: "module-library", version: "1.0.0" }],
          companionVersion: "0.1.0",
          takenAt: now,
        };
      }
      const sorted = (all[keyO] as string[]).filter((m) => m !== "ml-stub-001");
      await chrome.storage.local.set({
        [keyS]: { ...(all[keyS] as object | undefined), ...snaps },
        [keyO]: sorted,
      });
    },
    [env.url, new Date().toISOString()] as const,
  );
  await page.reload();
  await shell(page).locator(".mls-lib").click();
  await main(page).getByRole("button", { name: "Sort them" }).click();
  const item = shell(page).locator(
    '.mls-intake-item[data-module="ml-stub-001"]',
  );
  const chips = item.locator(".mls-tchip");
  await expect(chips).toHaveCount(0);
  const more = item.locator(".mls-morew");
  await expect(more).toHaveText(/30 worlds/);
  await more.click();
  await expect(chips).toHaveCount(30);
  await page.screenshot({ path: `${SCREENS}/many-intake-1366.png` });
  await more.click();
  await expect(chips).toHaveCount(0);
});
