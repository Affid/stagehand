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
  await page.locator('#setup-packages [data-tab="modules"]').first().click();
  await page
    .locator("#ml-modules-root")
    .getByRole("button", { name: "Try the new Setup page" })
    .click();
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
  const panel = lib().getByRole("complementary", { name: /ML Fixture: A/ });
  await expect(panel.getByRole("combobox", { name: "Folder" })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-details.png` });
  await panel.getByRole("tab", { name: "Package" }).click();
  await expect(panel.locator(".mll-pkg")).toContainText("ML Fixture: library");
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
});
