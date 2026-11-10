// The new Setup page's Library on the local Foundry (Phases 3 and 5b): cards
// in groups, Group by, the filter, Select with the selection bar, the Tags
// and Presets panels, Foundry's installer, By world, and intake.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { SCREENS } from "./extension.ts";
import {
  loadTarget,
  openSetupAsAdmin,
  type Target,
  updateStored,
} from "./target.ts";

const env = loadFoundryEnv();
const SYNC_FILE = join(env.dataDir, "Data", "stagehand", "library.json");

/** Takes a module out of the sorted ones in the server's library file. */
function unsortOnServer(id: string): void {
  if (!existsSync(SYNC_FILE)) return;
  const file = JSON.parse(readFileSync(SYNC_FILE, "utf8")) as {
    sorted: string[] | null;
  };
  const sorted = file.sorted?.filter((s) => s !== id) ?? null;
  writeFileSync(SYNC_FILE, JSON.stringify({ ...file, sorted }));
}
let ext: Target;
let admin: APIRequestContext;
let page: Page;

const lib = (): Locator => page.locator("#st-shell-root .stl-page");
const shell = (): Locator => page.locator("#st-shell-root");
const card = (id: string): Locator =>
  lib().locator(`.stl-card[data-module="${id}"]`);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await page
    .locator("#st-shell-root")
    .getByRole("button", { name: /^Library/ })
    .click();
});

test.afterAll(async () => {
  await ext.close();
  await admin.dispose();
});

test("every installed module shows as a card", async () => {
  await expect(card("st-fixture-a")).toBeVisible();
  await expect(card("stagehand")).toContainText("in no world");
  await page.screenshot({ path: `${SCREENS}/library-cards.png` });
});

test("Group by author and the filter", async () => {
  await lib()
    .getByRole("combobox", { name: "Group by" })
    .selectOption("author");
  await expect(lib().locator(".stl-sec .name").first()).toBeVisible();
  await lib()
    .getByRole("searchbox", { name: /Filter Modules/ })
    .fill("fixture");
  await expect(lib().locator(".stl-card")).toHaveCount(3);
  await lib()
    .getByRole("searchbox", { name: /Filter Modules/ })
    .fill("");
  await lib()
    .getByRole("combobox", { name: "Group by" })
    .selectOption("folder");
});

test("Select picks cards; the selection bar moves them to Unfiled and back", async () => {
  await lib().getByRole("button", { name: "Select" }).click();
  await card("st-fixture-a").getByRole("checkbox").check();
  await card("st-fixture-b").getByRole("checkbox").check();
  const bar = lib().locator(".sts-selbar");
  await expect(bar).toContainText("2 selected");
  await bar.getByRole("button", { name: "Tags" }).click();
  await expect(bar.locator(".st-tagpop")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-select.png` });
  await page.keyboard.press("Escape");
  await bar.getByRole("button", { name: "Done" }).click();
  await expect(lib().locator(".sts-selbar")).toHaveCount(0);
});

test("Tags: a new tag, renamed, put on a module, then deleted", async () => {
  await lib().getByRole("button", { name: "Tags", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Tags" });
  await panel.getByRole("button", { name: "New tag" }).click();
  const name = panel.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("New tag");
  await name.fill("live check");
  await name.press("Enter");
  await expect(panel.locator(".sts-list li.active")).toContainText(
    "live check",
  );
  await panel
    .getByRole("checkbox", { name: "Stagehand Fixture: library" })
    .check();
  await expect(card("st-fixture-lib")).toContainText("live check");
  await page.screenshot({ path: `${SCREENS}/library-tags.png` });
  page.once("dialog", (d) => void d.accept());
  await panel.getByRole("button", { name: "Delete tag" }).click();
  await expect(card("st-fixture-lib")).not.toContainText("live check");
  await panel.getByRole("button", { name: "Close" }).click();
});

test("Presets: a new preset with a module, then deleted", async () => {
  await lib().getByRole("button", { name: "Presets", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Presets" });
  await panel.getByRole("button", { name: "New preset" }).click();
  await expect(panel.getByRole("textbox", { name: "Name" })).toHaveValue(
    "New preset",
  );
  await panel
    .getByRole("checkbox", { name: "Stagehand Fixture: library" })
    .check();
  await expect(panel.locator(".sts-list li.active")).toContainText("1");
  await page.screenshot({ path: `${SCREENS}/library-presets.png` });
  page.once("dialog", (d) => void d.accept());
  await panel.getByRole("button", { name: "Delete preset" }).click();
  await expect(
    panel.locator(".sts-list li:not(.new)", { hasText: "New preset" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Close" }).click();
});

test("New folder: named in place, a module moved in, then deleted", async () => {
  await lib().getByRole("button", { name: "New folder" }).click();
  const name = lib().getByRole("textbox", { name: "Rename" });
  await name.fill("Live folder");
  await name.press("Enter");
  const head = lib().locator(".stl-sec", { hasText: "Live folder" });
  await expect(head).toBeVisible();
  await lib().getByRole("button", { name: "Select" }).click();
  await card("st-fixture-b").getByRole("checkbox").check();
  const bar = lib().locator(".sts-selbar");
  await bar.getByRole("button", { name: "Move to" }).click();
  await bar.getByRole("button", { name: /Live folder/ }).click();
  await bar.getByRole("button", { name: "Done" }).click();
  await expect(
    head.locator('.stl-card[data-module="st-fixture-b"]'),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-folder.png` });
  await lib().getByRole("button", { name: "Live folder: actions" }).click();
  page.once("dialog", (d) => void d.accept());
  await lib().getByRole("button", { name: "Delete folder" }).click();
  await expect(
    lib().locator(".stl-sec", { hasText: "Live folder" }),
  ).toHaveCount(0);
  await expect(card("st-fixture-b")).toBeVisible();
});

test("Install Module opens Foundry's own installer above our page", async () => {
  await lib().getByRole("button", { name: "Install Module" }).click();
  const installer = page.locator("#install-package");
  await expect(installer).toBeVisible();
  await installer.locator('[data-action="close"]').click();
  await expect(installer).toHaveCount(0);
});

test("a module's name opens its details; the Package tab shows its manifest", async () => {
  await card("st-fixture-a")
    .getByRole("button", { name: /Stagehand Fixture: A/ })
    .click();
  // Its own column beside the Library, as the prototype.
  const panel = page
    .locator("#st-shell-root")
    .getByRole("complementary", { name: /Stagehand Fixture: A/ });
  await expect(panel.getByRole("combobox", { name: "Folder" })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-details.png` });
  await panel.getByRole("tab", { name: "Package" }).click();
  await expect(panel.locator(".sts-pkgtab")).toContainText(
    "Needs Stagehand Fixture: library",
  );
  // Foundry's own favourite: the star shows on the card, then goes again.
  await panel.getByRole("switch", { name: "Favourite" }).click();
  await expect(card("st-fixture-a").locator(".stw-fav")).toBeVisible();
  await panel.getByRole("switch", { name: "Favourite" }).click();
  await expect(card("st-fixture-a").locator(".stw-fav")).toHaveCount(0);
  // Edit manifest opens Foundry's own module editor; closed unsaved.
  await panel.getByRole("button", { name: "Edit manifest…" }).click();
  const editor = page.locator("#module-config");
  await expect(editor).toBeVisible();
  // Foundry's own card menu, used to reach its editor, doesn't linger.
  await expect(page.locator("#context-menu")).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/library-package.png` });
  await editor.locator('[data-action="close"]').click();
  await expect(editor).toHaveCount(0);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
});

test("By world shows every module in every world", async () => {
  await lib()
    .getByRole("tab", { name: /^By world/ })
    .click();
  const grid = lib().locator(".stl-grid");
  await expect(grid.locator("thead th.w")).toHaveCount(2);
  await expect(
    grid.locator('tbody tr[data-module="st-fixture-a"]'),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/library-by-world.png` });
  await lib().getByRole("combobox", { name: "Show" }).selectOption("fav");
  await expect(lib().locator(".stw-empty h3")).toHaveText("No worlds to show");
  await lib()
    .getByRole("button", { name: /Show all 2 worlds/ })
    .click();
  await expect(grid.locator("thead th.w")).toHaveCount(2);
});

test("a module installed since the last sort is offered for intake", async () => {
  // As if st-fixture-a was installed after the last visit: unsorted here
  // and in the library file on the server, which library sync reads.
  const key = `sorted:${env.url}`;
  await updateStored<string[]>(ext, key, (all) =>
    (all ?? []).filter((id) => id !== "st-fixture-a"),
  );
  unsortOnServer("st-fixture-a");
  await page.reload();
  await page
    .locator("#st-shell-root")
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(lib().locator(".sts-intake-band")).toContainText(
    "1 new module since you last sorted",
  );
  await expect(card("st-fixture-a")).toContainText("New");
  await lib().getByRole("button", { name: "Sort them" }).click();
  const panel = shell().getByRole("complementary", { name: "New modules" });
  await expect(panel.locator(".sts-intake-item")).toHaveCount(1);
  await page.screenshot({ path: `${SCREENS}/library-intake.png` });
  await panel.getByRole("button", { name: "Done with all" }).click();
  await expect(lib().locator(".sts-intake-band")).toHaveCount(0);
});
