// The new Setup page's Library on the local Foundry (build plan, Phase 3):
// cards in groups, Group by, the filter, Select with the selection band,
// and the Organise panel with today's folders, tags and presets.
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let admin: APIRequestContext;
let page: Page;

const lib = (): Locator => page.locator("#ml-shell-root .mll-page");
const card = (id: string): Locator =>
  lib().locator(`.mll-card[data-module="${id}"]`);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadExtension();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await page
    .locator("#ml-shell-root")
    .getByRole("button", { name: /^Library/ })
    .click();
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("every installed module shows as a card", async () => {
  await expect(card("ml-fixture-a")).toBeVisible();
  await expect(card("module-library")).toContainText("in no world");
  await page.screenshot({ path: `${SCREENS}/library-cards.png` });
});

test("Group by author and the filter", async () => {
  await lib()
    .getByRole("combobox", { name: "Group by" })
    .selectOption("author");
  await expect(lib().locator(".mll-sec .name").first()).toBeVisible();
  await lib()
    .getByRole("searchbox", { name: /Filter modules/ })
    .fill("fixture");
  await expect(lib().locator(".mll-card")).toHaveCount(3);
  await lib()
    .getByRole("searchbox", { name: /Filter modules/ })
    .fill("");
  await lib()
    .getByRole("combobox", { name: "Group by" })
    .selectOption("folder");
});

test("Select picks cards and shows the selection band", async () => {
  await lib().getByRole("button", { name: "Select" }).click();
  await card("ml-fixture-a").getByRole("checkbox").check();
  await card("ml-fixture-b").getByRole("checkbox").check();
  await expect(lib().locator(".ml-bulk-active")).toContainText("2 selected");
  await page.screenshot({ path: `${SCREENS}/library-select.png` });
  await lib().getByRole("button", { name: "Done" }).click();
  await expect(lib().locator(".ml-bulk")).toHaveCount(0);
});

test("Organise shows folders, tags and presets beside the cards", async () => {
  await lib().getByRole("button", { name: "Organise" }).click();
  const side = lib().locator(".mll-side");
  await expect(side).toContainText("Folders");
  await expect(side).toContainText("Presets");
  await page.screenshot({ path: `${SCREENS}/library-organise.png` });
});

test("a module's name opens its details; the Package tab shows its manifest", async () => {
  await lib().getByRole("button", { name: "Organise" }).click();
  await card("ml-fixture-a")
    .getByRole("button", { name: /ML Fixture: A/ })
    .click();
  // Its own column beside the Library, as the prototype.
  const panel = page
    .locator("#ml-shell-root")
    .getByRole("complementary", { name: /ML Fixture: A/ });
  await expect(panel.getByRole("combobox", { name: "Folder" })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-details.png` });
  await panel.getByRole("tab", { name: "Package" }).click();
  await expect(panel.locator(".mll-pkg")).toContainText("ML Fixture: library");
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
});

test("By world shows every module in every world", async () => {
  await lib().getByRole("tab", { name: "By world" }).click();
  const grid = lib().locator(".mll-grid");
  await expect(grid.locator("thead th.w")).toHaveCount(2);
  await expect(
    grid.locator('tbody tr[data-module="ml-fixture-a"]'),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-by-world.png` });
  await lib().getByRole("combobox", { name: "Show" }).selectOption("fav");
  await expect(lib().locator(".mlw-empty h3")).toHaveText("No worlds to show");
  await lib()
    .getByRole("button", { name: /Show all 2 worlds/ })
    .click();
  await expect(grid.locator("thead th.w")).toHaveCount(2);
});

test("a module installed since the last sort is offered for intake", async () => {
  // As if ml-fixture-a was installed after the last visit.
  const key = `sorted:${env.url}`;
  await ext.worker.evaluate(async (k) => {
    const all = ((await chrome.storage.local.get(k))[k] ?? []) as string[];
    await chrome.storage.local.set({
      [k]: all.filter((id) => id !== "ml-fixture-a"),
    });
  }, key);
  await page.reload();
  await page
    .locator("#ml-shell-root")
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(lib().locator(".mll-intake")).toContainText(
    "1 new since you last sorted",
  );
  await expect(card("ml-fixture-a")).toContainText("New");
  await lib().getByRole("button", { name: "Sort them" }).click();
  const panel = lib().getByRole("complementary", { name: "New modules" });
  await page.screenshot({ path: `${SCREENS}/library-intake.png` });
  await panel.getByRole("button", { name: "All sorted" }).click();
  await expect(lib().locator(".mll-intake")).toHaveCount(0);
});
