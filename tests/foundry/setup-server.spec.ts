// The new Setup page's server pages on the local Foundry (build plan,
// Phase 5). Backups: the page lists the server's backups; a snapshot is
// taken through Foundry's own dialog and deleted again with its confirm
// code, so the server ends as it began (the spike did the same).
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

const shell = (): Locator => page.locator("#ml-shell-root");

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
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("the header's Backups opens the server Backups page", async () => {
  await shell().getByRole("button", { name: "Backups" }).click();
  const pageEl = shell().locator(".mlb-page");
  await expect(pageEl.locator(".mlb-sec > h3").first()).toContainText(
    "Snapshots",
  );
  await expect(pageEl.getByText("Reading Foundry's backups…")).toHaveCount(0);
});

const snapshotIds = (): Promise<string[]> =>
  shell()
    .locator(".mlb-snaps li[data-snapshot]")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-snapshot") ?? ""),
    );

test("a snapshot is taken with Foundry's dialog and deleted with its code", async () => {
  const pageEl = shell().locator(".mlb-page");
  const before = await snapshotIds();
  await pageEl.getByRole("button", { name: "Take a snapshot" }).click();
  await page.locator(".snapshot-dialog button[type=submit]").click();
  // Ours is the one that wasn't there before; only ours is deleted.
  await expect
    .poll(async () => (await snapshotIds()).length, { timeout: 180_000 })
    .toBe(before.length + 1);
  const id = (await snapshotIds()).find((x) => !before.includes(x));
  expect(id).toBeTruthy();
  const mine = pageEl.locator(`.mlb-snaps li[data-snapshot="${id ?? ""}"]`);
  await page.screenshot({ path: `${SCREENS}/server-backups.png` });
  await mine.getByRole("button", { name: "Delete" }).click();
  const confirm = page.locator("dialog.application", {
    has: page.locator("#delete-confirm"),
  });
  const code = await confirm.locator("#confirm-code .reference").textContent();
  await confirm.locator("#delete-confirm").fill(code ?? "");
  await confirm.locator('[data-action="yes"]').click();
  await expect(mine).toHaveCount(0, { timeout: 120_000 });
});
