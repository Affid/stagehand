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
});

test.afterAll(async () => {
  await ext.context.close();
  await admin.dispose();
});

test("the header's Backups opens the server Backups page", async () => {
  await shell().getByRole("button", { name: "Backups" }).click();
  const pageEl = shell().locator(".mlb-page");
  await expect(pageEl.getByRole("tab").first()).toContainText("Snapshots");
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
  await pageEl.getByRole("button", { name: "Create a snapshot" }).click();
  await page.locator(".snapshot-dialog button[type=submit]").click();
  // Ours is the one that wasn't there before; only ours is deleted.
  await expect
    .poll(async () => (await snapshotIds()).length, { timeout: 180_000 })
    .toBe(before.length + 1);
  const id = (await snapshotIds()).find((x) => !before.includes(x));
  expect(id).toBeTruthy();
  const mine = pageEl.locator(`.mlb-snaps li[data-snapshot="${id ?? ""}"]`);
  await page.screenshot({ path: `${SCREENS}/server-backups.png` });
  await mine.getByRole("button", { name: /^Delete the snapshot/ }).click();
  const confirm = page.locator("dialog.application", {
    has: page.locator("#delete-confirm"),
  });
  const code = await confirm.locator("#confirm-code .reference").textContent();
  await confirm.locator("#delete-confirm").fill(code ?? "");
  await confirm.locator('[data-action="yes"]').click();
  await expect(mine).toHaveCount(0, { timeout: 120_000 });
});

test("Configuration reads Foundry's settings and saves one through Foundry, then back", async () => {
  await shell().getByRole("button", { name: "Configuration" }).click();
  const cfg = shell().locator(".mlc-page");
  await expect(cfg.getByLabel("Port", { exact: true })).toHaveValue(/\d+/);
  await cfg
    .getByRole("button", { name: "Advanced: Unix socket, compression" })
    .click();
  const toggle = cfg.getByRole("switch", { name: "Compress web socket data" });
  const was = await toggle.isChecked();
  const saveOne = async (): Promise<void> => {
    await cfg.getByRole("button", { name: "Save…" }).click();
    await shell()
      .getByRole("dialog", { name: "Save configuration" })
      .getByRole("button", { name: "Save 1 change" })
      .click();
  };
  await toggle.click();
  await expect(cfg.locator(".mlc-bar")).toContainText("1 change not saved");
  await page.screenshot({ path: `${SCREENS}/server-config.png` });
  await saveOne();
  await expect(cfg.locator(".mlc-bar")).toContainText("apply after a restart");
  await expect(toggle).toBeChecked({ checked: !was });
  // Put it back, so options.json ends as it began.
  await toggle.click();
  await saveOne();
  await expect(toggle).toBeChecked({ checked: was });
  await expect(cfg.locator(".mlc-unsaved")).toHaveCount(0);
});

test("Configuration: a wrong current password is refused by Foundry", async () => {
  const cfg = shell().locator(".mlc-page");
  await cfg.getByRole("button", { name: "Change…" }).click();
  await cfg.getByLabel("Current password").fill("certainly-not-the-password");
  await cfg.getByRole("button", { name: "Continue" }).click();
  await expect(cfg).toContainText("That isn't the current password.");
  await cfg.getByRole("button", { name: "Cancel" }).click();
});

test("the Version chip's menu opens the Update page with Foundry's version and its notes", async () => {
  await shell().locator(".mlh-ver").click();
  await shell()
    .getByRole("region", { name: "Foundry Virtual Tabletop" })
    .getByRole("button", { name: /Update page|See what's new/ })
    .click();
  const upd = shell().locator(".mlu-page");
  await expect(upd).toContainText("14.370");
  await expect(
    upd.getByRole("link", { name: /What's new in/ }),
  ).toHaveAttribute("href", /^https:\/\/foundryvtt\.com\/releases\/14\.\d+$/);
  await page.screenshot({ path: `${SCREENS}/server-update.png` });
});
