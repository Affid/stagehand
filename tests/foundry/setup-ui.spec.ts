// M1 Setup UI end to end on the local Foundry: organisation (folders, tags,
// notes, search, smart groups), presets, export/import, and queuing an apply
// with its diff preview. In-world application is covered by apply.spec.ts.
import { readFileSync } from "node:fs";
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
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
  storage,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let admin: APIRequestContext;
let page: Page;

const modulesTab = (p: Page): Promise<void> =>
  p.locator('#setup-packages [data-tab="modules"]').first().click();
const worldsTab = (p: Page): Promise<void> =>
  p.locator('#setup-packages [data-tab="worlds"]').first().click();
const app = (): Locator => page.locator("#ml-modules-root");
const row = (id: string): Locator =>
  app().locator(`li.ml-row[data-module="${id}"]`);
const sideItem = (text: string): Locator =>
  app().locator(".ml-sidebar .ml-side-item", { hasText: text });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadExtension();
  page = await ext.context.newPage();
  page.on("dialog", (d) => void d.accept());
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("worlds panel lists each world with its companion status (W-1, W-2)", async () => {
  const card = page.locator(`#ml-worlds-root [data-world="${TEST_WORLD.id}"]`);
  await expect(card).toContainText("Companion not enabled");
  await expect(
    card.locator("button", { hasText: "Apply presets" }),
  ).toBeVisible();
});

test("organised view replaces the core list; the toggle brings it back (S-8)", async () => {
  await modulesTab(page);
  await expect(app().locator(".ml-layout")).toBeVisible();
  await expect(page.locator("#modules-list")).toBeHidden();
  await app().getByRole("button", { name: "Core list" }).click();
  await expect(page.locator("#modules-list")).toBeVisible();
  await expect(app().locator(".ml-layout")).toHaveCount(0);
  await app().getByRole("button", { name: "Organised view" }).click();
  await expect(page.locator("#modules-list")).toBeHidden();
});

test("smart groups classify installed modules (G-1, G-5)", async () => {
  await sideItem("Libraries").click();
  await expect(app().locator("li.ml-row")).toHaveCount(1);
  await expect(row("ml-fixture-lib")).toBeVisible();
  await sideItem("All modules").click();
});

test("folders: create, drag a module in, move a selection (S-1)", async () => {
  await app().getByRole("button", { name: "+ New folder" }).click();
  await app().getByRole("textbox", { name: "Folder name" }).fill("Fixtures");
  await app().getByRole("textbox", { name: "Folder name" }).press("Enter");
  await expect(sideItem("Fixtures")).toContainText("0");

  await row("ml-fixture-a").dragTo(sideItem("Fixtures"));
  await expect(sideItem("Fixtures")).toContainText("1");

  await row("ml-fixture-b").locator('input[type="checkbox"]').check();
  await row("ml-fixture-lib").locator('input[type="checkbox"]').check();
  await app()
    .getByRole("combobox", { name: "Move to folder" })
    .selectOption({ label: "Fixtures" });
  await expect(sideItem("Fixtures")).toContainText("3");
  await expect(
    app().locator(".ml-group", { hasText: "Fixtures" }).locator("li.ml-row"),
  ).toHaveCount(3);
});

test("tags, tag filter and search (S-3, S-4)", async () => {
  await app().getByRole("button", { name: "+ New tag" }).click();
  await app().getByRole("textbox", { name: "Tag name" }).fill("testing");
  await app().getByRole("textbox", { name: "Tag name" }).press("Enter");
  await app()
    .getByRole("combobox", { name: "Add tag" })
    .selectOption({ label: "testing" });
  await app().getByRole("button", { name: "Clear selection" }).click();
  await expect(row("ml-fixture-b")).toContainText("testing");
  // Regression: Enter then blur used to create the tag twice.
  await expect(app().locator(".ml-notice-error")).toHaveCount(0);
  await expect(app().locator(".ml-tags li")).toHaveCount(1);

  await app()
    .locator(".ml-tags")
    .getByRole("button", { name: "testing" })
    .click();
  await expect(app().locator("li.ml-row")).toHaveCount(2);
  await app().getByRole("button", { name: "Clear filters" }).click();

  await app().getByRole("searchbox").fill("conflicts with");
  await expect(app().locator("li.ml-row")).toHaveCount(1);
  await app().getByRole("searchbox").fill("");
});

test("notes per module, found by search (S-6)", async () => {
  await row("ml-fixture-a").getByRole("button", { name: "Add note" }).click();
  await row("ml-fixture-a")
    .getByRole("textbox", { name: "Note" })
    .fill("Installed for the Strahd campaign");
  await row("ml-fixture-a").getByRole("button", { name: "Save note" }).click();
  await expect(row("ml-fixture-a").locator(".ml-note")).toHaveText(
    "Installed for the Strahd campaign",
  );
  await app().getByRole("searchbox").fill("strahd");
  await expect(app().locator("li.ml-row")).toHaveCount(1);
  await app().getByRole("searchbox").fill("");
});

test("a preset from a selection (P-1, P-2)", async () => {
  await row("ml-fixture-a").locator('input[type="checkbox"]').check();
  await app()
    .getByRole("button", { name: "New preset from selection" })
    .click();
  const editor = page.locator(".ml-modal", { hasText: "New preset" });
  await editor.getByRole("textbox", { name: "Name" }).fill("Fixture A");
  await expect(editor.locator("legend")).toHaveText("Modules (1)");
  await editor.getByRole("button", { name: "Save preset" }).click();
  await expect(editor).toHaveCount(0);
  await expect(sideItem("Fixture A")).toBeVisible();
  // Saving a preset from the selection clears it.
  await expect(
    app().getByRole("button", { name: "Clear selection" }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/setup-organised.png` });
});

test("the library persists across reloads and is stored per server", async () => {
  await page.reload();
  await page
    .locator("#ml-modules-root .ml-modules")
    .waitFor({ state: "attached" });
  await modulesTab(page);
  await expect(sideItem("Fixtures")).toContainText("3");
  const stored = await storage(ext.worker);
  expect(stored[`library:${env.url}`]).toMatchObject({
    serverId: env.url,
    folders: [{ name: "Fixtures" }],
  });
});

test("export and import the library (D-1)", async () => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    app().getByRole("button", { name: "Export library" }).click(),
  ]);
  const path = await download.path();
  const text = readFileSync(path, "utf8");
  expect(JSON.parse(text)).toMatchObject({
    format: "module-library",
    kind: "library",
  });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    app().getByRole("button", { name: "Import library" }).click(),
  ]);
  await chooser.setFiles(path);
  await expect(app().locator(".ml-notice")).toContainText("Library imported.");
  await expect(sideItem("Fixtures")).toContainText("3");
});

test("apply presets: preview the diff, queue, cancel (P-3, P-4, P-5)", async () => {
  await worldsTab(page);
  const card = page.locator(`#ml-worlds-root [data-world="${TEST_WORLD.id}"]`);
  await card.getByRole("button", { name: "Apply presets…" }).click();
  const dialog = page.locator(".ml-modal", { hasText: "Apply presets to" });
  await dialog.getByRole("checkbox", { name: /Fixture A/ }).check();
  const diff = dialog.getByTestId("apply-diff");
  await expect(
    diff.locator(".ml-diff-section", { hasText: "Enable" }),
  ).toContainText("ml-fixture-a");
  await expect(
    diff.locator(".ml-diff-section", { hasText: "dependencies" }),
  ).toContainText("ml-fixture-lib");
  await expect(dialog).toContainText("No snapshot of this world yet");
  await page.screenshot({ path: `${SCREENS}/setup-apply-preview.png` });
  await dialog.getByRole("button", { name: "Queue for next launch" }).click();
  await expect(card).toContainText("Pending changes (1)");
  await page.screenshot({ path: `${SCREENS}/setup-worlds-pending.png` });
  await card.getByRole("button", { name: "Cancel" }).click();
  await expect(card).not.toContainText("Pending changes");
});
