// Accessibility of the new Setup page on the local Foundry (Phase 6): the
// ARIA tabs pattern on every tab row, by keyboard, and axe-core (WCAG 2.2 A
// and AA) on every page and its open menus, panels and dialogs.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import { audit as auditPage } from "./axe.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let page: Page;

const shell = (p: Page) => p.locator("#ml-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ext = await loadExtension();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
});

/** Arrow keys walk a tab row; the panel follows and is named by its tab. */
async function walkTabs(list: Locator, names: readonly string[]) {
  await expect(list).toHaveAttribute("aria-label", /.+/);
  const tabs = list.getByRole("tab");
  await expect(tabs).toHaveCount(names.length);
  await tabs.first().click();
  for (const [i, name] of names.entries()) {
    const tab = tabs.nth(i);
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(tab).toContainText(name);
    const panel = page.locator(
      `[id="${(await tab.getAttribute("aria-controls")) ?? ""}"]`,
    );
    await expect(panel).toHaveAttribute("role", "tabpanel");
    await expect(panel).toHaveAttribute(
      "aria-labelledby",
      (await tab.getAttribute("id")) ?? "",
    );
    await page.keyboard.press("ArrowRight");
  }
  // Past the last tab: back to the first.
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  // Tab leaves the row instead of walking it.
  await expect(list.locator('[tabindex="0"]')).toHaveCount(1);
}

test("a world's tabs by keyboard", async () => {
  await shell(page).locator(".mls-world").first().click();
  await walkTabs(shell(page).getByRole("tablist", { name: "World sections" }), [
    "Modules",
    "About",
    "Backups",
  ]);
});

test("the Library's tabs and a module's details by keyboard", async () => {
  await shell(page).locator(".mls-lib").click();
  await walkTabs(
    shell(page).getByRole("tablist", { name: "Library sections" }),
    ["Modules", "Systems", "By world"],
  );
  await shell(page).locator(".mls-main button.t").first().click();
  await walkTabs(shell(page).locator(".mls-panel").getByRole("tablist"), [
    "Library",
    "Package",
  ]);
});

test("the server Backups page's tabs by keyboard", async () => {
  await shell(page)
    .locator(".mls-top")
    .getByRole("button", { name: "Backups" })
    .click();
  await walkTabs(
    shell(page).getByRole("tablist", { name: "Backup categories" }),
    ["Snapshots", "Worlds", "Modules", "Systems"],
  );
});

const audit = (name: string): Promise<void> => auditPage(page, name);

async function seedSnapshot(active: readonly string[]): Promise<void> {
  const snapshot = {
    worldId: TEST_WORLD.id,
    title: TEST_WORLD.title,
    system: { id: TEST_WORLD.system, version: "1" },
    coreVersion: "14.370",
    active: active.map((id) => ({ id, version: "1.0.0" })),
    companionVersion: "0.1.0",
    takenAt: new Date().toISOString(),
  };
  await ext.worker.evaluate(
    async ([k, s]) => {
      const all = (await chrome.storage.local.get(k))[k] ?? {};
      await chrome.storage.local.set({ [k]: { ...all, [s.worldId]: s } });
    },
    [`snapshots:${env.url}`, snapshot] as const,
  );
}

const main = () => shell(page).locator(".mls-main");
const top = () => shell(page).locator(".mls-top");

test("axe: a world's page, its menus and the launch review", async () => {
  await seedSnapshot(["module-library", "ml-fixture-lib", "ml-fixture-a"]);
  await page.reload();
  await shell(page)
    .locator(`.mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  await expect(main().locator(".mlw-card").first()).toBeVisible();
  await audit("world modules");
  await main().locator('.mlw-card input[role="switch"]').first().click();
  await audit("world modules with a queued change");
  await main().getByRole("button", { name: "View options" }).click();
  await audit("View options");
  await page.keyboard.press("Escape");
  await main().getByRole("button", { name: "Add" }).click();
  await audit("Add");
  await page.keyboard.press("Escape");
  await main()
    .getByRole("button", { name: /: actions$/ })
    .first()
    .click();
  await audit("group menu");
  await page.keyboard.press("Escape");
  await main()
    .getByRole("button", { name: /^Launch/ })
    .click();
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible();
  await audit("launch review");
  await review.getByRole("button", { name: "Cancel" }).click();
  await main()
    .locator(".mls-banner")
    .getByRole("button", { name: "Discard" })
    .click();
});

test("axe: About with its editors, and Backups", async () => {
  await main().getByRole("tab", { name: /About/ }).click();
  await audit("about");
  await main().getByRole("button", { name: "Rename" }).click();
  await audit("about: rename");
  await page.keyboard.press("Escape");
  await main()
    .getByRole("button", { name: /(Set a date for|Change) the next session/ })
    .click();
  await audit("about: next session editor");
  await main()
    .locator(".mlw-sess")
    .getByRole("button", { name: "Cancel" })
    .click();
  await main()
    .getByRole("tab", { name: /Backups/ })
    .click();
  await audit("world backups");
});

test("axe: the Library, its panels, a module's details and By world", async () => {
  await shell(page).locator(".mls-lib").click();
  await audit("library");
  await main().getByRole("button", { name: "Tags" }).click();
  await audit("tags panel");
  await main().getByRole("button", { name: "Presets" }).click();
  await audit("presets panel");
  await shell(page)
    .locator(".mls-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await main().getByRole("button", { name: "Select" }).click();
  await main()
    .locator(".ml-card input[type=checkbox], .mll-card input[type=checkbox]")
    .first()
    .check();
  await audit("library selecting");
  await main().getByRole("button", { name: "None" }).click();
  await main().getByRole("button", { name: "Done" }).click();
  await main().locator("button.t").first().click();
  await audit("module details");
  await shell(page)
    .locator(".mls-panel")
    .getByRole("tab", { name: /Package/ })
    .click();
  await audit("module package tab");
  await main()
    .getByRole("tab", { name: /Systems/ })
    .click();
  await audit("systems");
  await main()
    .getByRole("tab", { name: /By world/ })
    .click();
  await audit("by world");
  await main()
    .getByRole("button", { name: /: actions$/ })
    .first()
    .click();
  // The open menu with its column (polish pass): the menu (210 px) is wider
  // than a 92 px column and half covers the next cells, whose switches
  // can't be used while it is open; axe's target-size counts that against
  // them. The grid at rest is audited above.
  await expect(
    shell(page).locator(".mll-grid thead th.w:has(.mlh-menu)"),
  ).toHaveCount(1);
  await auditPage(
    page,
    "by world: a world's menu",
    "#ml-shell-root .mll-grid thead th.w:has(.mlh-menu)",
  );
  await page.keyboard.press("Escape");
});

test("axe: server pages, the header's menus and News", async () => {
  await top().getByRole("button", { name: "Backups" }).click();
  await expect(main().getByRole("tablist")).toBeVisible();
  await audit("server backups");
  await top().getByRole("button", { name: "Configuration" }).click();
  await expect(main().locator("input").first()).toBeVisible();
  await audit("configuration");
  await top().locator(".mlh-ver").click();
  await audit("version menu");
  await page.keyboard.press("Escape");
  await top().getByRole("button", { name: "Log out or shut down" }).click();
  await audit("power menu");
  await page.keyboard.press("Escape");
  await shell(page).locator(".mlr-news header button").click();
  await audit("news open");
});
