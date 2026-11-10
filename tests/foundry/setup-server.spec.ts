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
import { SCREENS } from "./extension.ts";
import {
  loadTarget,
  openSetupAsAdmin,
  settingsOpened,
  type Target,
} from "./target.ts";
import { audit } from "./axe.ts";

const env = loadFoundryEnv();
let ext: Target;
let admin: APIRequestContext;
let page: Page;

const shell = (): Locator => page.locator("#st-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
  await admin.dispose();
});

test("the header's Backups opens the server Backups page", async () => {
  await shell().getByRole("button", { name: "Backups" }).click();
  const pageEl = shell().locator(".stb-page");
  await expect(pageEl.getByRole("tab").first()).toContainText("Snapshots");
  await expect(pageEl.getByText("Reading Foundry's backups…")).toHaveCount(0);
});

const snapshotIds = (): Promise<string[]> =>
  shell()
    .locator(".stb-snaps li[data-snapshot]")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-snapshot") ?? ""),
    );

test("a snapshot is taken from our dialog and deleted with Foundry's code", async () => {
  const pageEl = shell().locator(".stb-page");
  const before = await snapshotIds();
  await pageEl.getByRole("button", { name: "Create a snapshot" }).click();
  // Ours, as the prototype: what it holds, Foundry's own space check, a note.
  const dialog = page.getByRole("dialog", { name: "Create a snapshot" });
  await expect(dialog).toContainText(
    /\d+ worlds?, \d+ modules? and \d+ systems?/,
  );
  await expect(dialog).toContainText(/About .+ needed · .+ free/, {
    timeout: 60_000,
  });
  await page.screenshot({ path: `${SCREENS}/server-snapshot-dialog.png` });
  await dialog
    .getByRole("textbox", { name: "Note" })
    .fill("Stagehand live test");
  await dialog.getByRole("button", { name: "Create the snapshot" }).click();
  // Foundry's own dialog stays shut.
  await expect(page.locator(".snapshot-dialog")).toHaveCount(0);
  // Ours is the one that wasn't there before; only ours is deleted.
  await expect
    .poll(async () => (await snapshotIds()).length, { timeout: 180_000 })
    .toBe(before.length + 1);
  const id = (await snapshotIds()).find((x) => !before.includes(x));
  expect(id).toBeTruthy();
  const mine = pageEl.locator(`.stb-snaps li[data-snapshot="${id ?? ""}"]`);
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
  const cfg = shell().locator(".stc-page");
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
  await expect(cfg.locator(".stc-bar")).toContainText("1 change not saved");
  await page.screenshot({ path: `${SCREENS}/server-config.png` });
  await saveOne();
  await expect(cfg.locator(".stc-bar")).toContainText("apply after a restart");
  await expect(toggle).toBeChecked({ checked: !was });
  // Put it back, so options.json ends as it began.
  await toggle.click();
  await saveOne();
  await expect(toggle).toBeChecked({ checked: was });
  await expect(cfg.locator(".stc-unsaved")).toHaveCount(0);
});

test("Configuration: a wrong current password is refused by Foundry", async () => {
  const cfg = shell().locator(".stc-page");
  await cfg.getByRole("button", { name: "Change…" }).click();
  await cfg.getByLabel("Current password").fill("certainly-not-the-password");
  await cfg.getByRole("button", { name: "Continue" }).click();
  await expect(cfg).toContainText("That isn't the current password.");
  await cfg.getByRole("button", { name: "Cancel" }).click();
});

test("Configuration: the right current password lets a new one be chosen", async () => {
  const cfg = shell().locator(".stc-page");
  await cfg.getByRole("button", { name: "Change…" }).click();
  await cfg.getByLabel("Current password").fill(env.adminPassword);
  await cfg.getByRole("button", { name: "Continue" }).click();
  await expect(cfg.getByLabel("New password", { exact: true })).toBeVisible();
  await cfg.getByRole("button", { name: "Cancel" }).click();
  await expect(cfg.locator(".stc-unsaved")).toHaveCount(0);
});

test("the Version chip's menu opens the Update page: Foundry's own check says up to date", async () => {
  await shell().locator(".sth-ver").click();
  await shell()
    .getByRole("region", { name: "Foundry Virtual Tabletop" })
    .getByRole("button", { name: /Update page|See what's new/ })
    .click();
  const upd = shell().locator(".stu-page");
  await expect(upd).toContainText("Foundry is up to date", { timeout: 30_000 });
  await expect(upd).toContainText("Foundry 14.370 is the latest");
});

/**
 * Foundry's real notes for its current release, answered as a newer build:
 * the local server has nothing newer, and runs with --noupdate.
 */
async function answerNewer(): Promise<void> {
  await page.route(`${env.url}/update`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    // Foundry's own preview answers for the release; nothing is installed.
    if (body.action === "previewCompatibility") return route.continue();
    if (body.action !== "updateCheck") return route.abort();
    const real = await route.fetch({
      postData: JSON.stringify({ ...body, forceUpdate: true }),
    });
    const release = (await real.json()) as Record<string, unknown>;
    return route.fulfill({ json: { ...release, build: 371, flags: {} } });
  });
}

test("the Update page reads Foundry's release notes; --noupdate disables the update", async () => {
  await answerNewer();
  const upd = shell().locator(".stu-page");
  await upd.getByRole("button", { name: "Check again" }).click();
  const notes = upd.locator(".stu-notes");
  await expect(notes.locator(".stu-nhead h3")).toContainText(
    "Release notes: Version 14",
    { timeout: 30_000 },
  );
  await expect(upd.locator(".stb-head")).toContainText("14.371 is available.");
  await expect(upd.locator(".stu-jump")).toContainText("bug fixes");
  await expect(notes.locator("a.stu-issue").first()).toHaveAttribute(
    "href",
    /^https:\/\/github\.com\/foundryvtt\/foundryvtt\/issues\/\d+$/,
  );
  await expect(
    upd.getByRole("button", { name: "Updates disabled" }),
  ).toBeDisabled();
  await expect(upd.locator(".stu-why")).toContainText("--noupdate");
  // Foundry's banner, from foundryvtt.com, as its own notes window shows it.
  await expect
    .poll(() =>
      notes
        .locator(".stu-banner img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${SCREENS}/server-update.png` });
  await audit(page, "update: what's new");
  await notes
    .getByRole("searchbox", { name: "Search the notes" })
    .fill("password");
  await expect(notes.locator(".stu-body li").first()).toContainText(
    /password/i,
  );
  await notes.getByRole("searchbox", { name: "Search the notes" }).fill("");
});

test("Your packages: Foundry's compatibility preview for the release, with where each is used", async () => {
  const upd = shell().locator(".stu-page");
  const box = upd.locator(".stu-side .stw-box", {
    hasText: "Your packages on 14.371",
  });
  await expect(box.locator(".stu-tags")).toContainText("compatible", {
    timeout: 60_000,
  });
  await upd.getByRole("tab", { name: /Your packages/ }).click();
  const view = upd.locator(".stu-compat");
  await view.getByRole("tab", { name: /^Modules/ }).click();
  await expect(upd.getByRole("tab", { name: /Your packages/ })).toHaveClass(
    /active/,
  );
  await expect(view.getByRole("tab", { name: /^Modules/ })).toHaveClass(
    /active/,
  );
  await expect(view.getByRole("tab", { name: /^Systems/ })).not.toHaveClass(
    /active/,
  );
  // Foundry's buttons fade their borders: wait until the tab has its line,
  // in the theme's own accent (orange in Foundry's, blue in Sci-Fi).
  await expect
    .poll(() =>
      view.getByRole("tab", { name: /^Modules/ }).evaluate((e) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--color-warm-1)";
        e.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(e).borderBottomColor === accent;
      }),
    )
    .toBe(true);
  const installed = await page.evaluate(
    () =>
      (window as unknown as { game: { modules: { size: number } } }).game
        .modules.size,
  );
  await expect(view.locator(".stu-clist li")).toHaveCount(installed);
  await expect(view.locator(".stu-clist li").first()).toContainText(
    /14\.371|verified/,
  );
  await page.screenshot({ path: `${SCREENS}/server-update-compat.png` });
  await audit(page, "update: your packages");
  await view.getByRole("tab", { name: /^Worlds/ }).click();
  await expect(view.locator(".stu-clist li")).not.toHaveCount(0);
});

test("Release history without the permission: why, and the settings panel to allow it", async () => {
  const upd = shell().locator(".stu-page");
  await upd.getByRole("tab", { name: /Release history/ }).click();
  const ask = upd.locator(".stu-hask");
  await expect(ask).toBeVisible();
  await audit(page, "update: release history, not allowed");
  await expect(ask).toContainText("one extra permission for foundryvtt.com");
  await settingsOpened(ext, page, () =>
    ask.getByRole("button", { name: "Allow reading foundryvtt.com…" }).click(),
  );
  await page.unroute(`${env.url}/update`);
});
