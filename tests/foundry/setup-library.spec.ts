// The new Setup page's Library on the local Foundry (Phases 3 and 5b): cards
// in groups, Group by, the filter, Select with the selection bar, the Tags
// and Presets panels, Foundry's installer, By world, and intake.
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
const shell = (): Locator => page.locator("#ml-shell-root");
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
    .getByRole("searchbox", { name: /Filter Modules/ })
    .fill("fixture");
  await expect(lib().locator(".mll-card")).toHaveCount(3);
  await lib()
    .getByRole("searchbox", { name: /Filter Modules/ })
    .fill("");
  await lib()
    .getByRole("combobox", { name: "Group by" })
    .selectOption("folder");
});

test("Select picks cards; the selection bar moves them to Unfiled and back", async () => {
  await lib().getByRole("button", { name: "Select" }).click();
  await card("ml-fixture-a").getByRole("checkbox").check();
  await card("ml-fixture-b").getByRole("checkbox").check();
  const bar = lib().locator(".mls-selbar");
  await expect(bar).toContainText("2 selected");
  await bar.getByRole("button", { name: "Tags" }).click();
  await expect(bar.locator(".ml-tagpop")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-select.png` });
  await page.keyboard.press("Escape");
  await bar.getByRole("button", { name: "Done" }).click();
  await expect(lib().locator(".mls-selbar")).toHaveCount(0);
});

test("Tags: a new tag, renamed, put on a module, then deleted", async () => {
  await lib().getByRole("button", { name: "Tags", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Tags" });
  await panel.getByRole("button", { name: "New tag" }).click();
  const name = panel.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("New tag");
  await name.fill("live check");
  await name.press("Enter");
  await expect(panel.locator(".mls-list li.active")).toContainText(
    "live check",
  );
  await panel.getByRole("checkbox", { name: "ML Fixture: library" }).check();
  await expect(card("ml-fixture-lib")).toContainText("live check");
  await page.screenshot({ path: `${SCREENS}/library-tags.png` });
  page.once("dialog", (d) => void d.accept());
  await panel.getByRole("button", { name: "Delete tag" }).click();
  await expect(card("ml-fixture-lib")).not.toContainText("live check");
  await panel.getByRole("button", { name: "Close" }).click();
});

test("Presets: a new preset with a module, then deleted", async () => {
  await lib().getByRole("button", { name: "Presets", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Presets" });
  await panel.getByRole("button", { name: "New preset" }).click();
  await expect(panel.getByRole("textbox", { name: "Name" })).toHaveValue(
    "New preset",
  );
  await panel.getByRole("checkbox", { name: "ML Fixture: library" }).check();
  await expect(panel.locator(".mls-list li.active")).toContainText("1");
  await page.screenshot({ path: `${SCREENS}/library-presets.png` });
  page.once("dialog", (d) => void d.accept());
  await panel.getByRole("button", { name: "Delete preset" }).click();
  await expect(
    panel.locator(".mls-list li:not(.new)", { hasText: "New preset" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Close" }).click();
});

test("Install Module opens Foundry's own installer above our page", async () => {
  await lib().getByRole("button", { name: "Install Module" }).click();
  const installer = page.locator("#install-package");
  await expect(installer).toBeVisible();
  await installer.locator('[data-action="close"]').click();
  await expect(installer).toHaveCount(0);
});

test("a module's name opens its details; the Package tab shows its manifest", async () => {
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
  await lib()
    .getByRole("tab", { name: /^By world/ })
    .click();
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
  await expect(lib().locator(".mls-intake-band")).toContainText(
    "1 new module since you last sorted",
  );
  await expect(card("ml-fixture-a")).toContainText("New");
  await lib().getByRole("button", { name: "Sort them" }).click();
  const panel = shell().getByRole("complementary", { name: "New modules" });
  await expect(panel.locator(".mls-intake-item")).toHaveCount(1);
  await page.screenshot({ path: `${SCREENS}/library-intake.png` });
  await panel.getByRole("button", { name: "Done with all" }).click();
  await expect(lib().locator(".mls-intake-band")).toHaveCount(0);
});
