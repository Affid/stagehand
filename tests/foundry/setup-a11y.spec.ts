// Accessibility of the new Setup page on the local Foundry (Phase 6): the
// ARIA tabs pattern on every tab row, by keyboard.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
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
