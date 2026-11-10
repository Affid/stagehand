// The Update page against a real newer release (build plan, Phase 6
// follow-up). Meant for an older Foundry build started without --noupdate
// (README, "An older build"). On the usual up-to-date server the first test
// opens the Version chip, sees no newer release and every test skips.
// Nothing is installed: no test presses Update, and a release that needs a
// manual install can't be pressed anyway.
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { audit } from "./axe.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
let ext: Target;
let page: Page;
/** The newer release Foundry's real check found, if any. */
let newer: string | undefined;
const SKIP = "Foundry is up to date: run on an older build to check this";

const shell = (): Locator => page.locator("#st-shell-root");
const upd = (): Locator => shell().locator(".stu-page");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  ext = await loadTarget();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
});

test("the Version chip names the newer release from Foundry's real check", async () => {
  await shell().locator(".sth-ver").click();
  const menu = shell().getByRole("region", {
    name: "Foundry Virtual Tabletop",
  });
  const found = menu.getByText(/^\d+\.\d+ is available$/);
  const latest = menu.getByText(
    /^(Up to date|Couldn't reach foundryvtt\.com)$/,
  );
  await expect(found.or(latest).first()).toBeVisible({ timeout: 30_000 });
  newer = (await found.count())
    ? (await found.innerText()).split(" ")[0]
    : undefined;
  test.skip(!newer, SKIP);
  await menu.getByRole("button", { name: /See what's new/ }).click();
  await expect(upd()).toContainText(`${newer ?? ""} is available`);
});

test("What's new: Foundry's notes for that release, searchable", async () => {
  test.skip(!newer, SKIP);
  const notes = upd().locator(".stu-notes");
  await expect(notes).toContainText(`Foundry ${newer ?? ""}`);
  await expect(notes.locator(".stu-body li").first()).toBeVisible();
  const search = notes.getByRole("searchbox", { name: "Search the notes" });
  await search.fill("fixed");
  await expect(notes.locator(".stu-body li").first()).toContainText(/fixed/i);
  await search.fill("");
});

test("the Update box: manual install with the download page, or an Update not pressed", async () => {
  test.skip(!newer, SKIP);
  const box = upd().locator(".stu-side");
  const manual = box.getByRole("button", {
    name: "Manual installation required",
  });
  if (await manual.count()) {
    await expect(manual).toBeDisabled();
    await expect(
      box.getByRole("link", { name: "Download page" }),
    ).toBeVisible();
  } else {
    await expect(box.getByRole("button", { name: /^Update/ })).toBeEnabled();
    await expect(box.getByLabel(/Take a snapshot first/)).toBeVisible();
  }
  await page.screenshot({ path: `${SCREENS}/server-update-older.png` });
  await audit(page, "update: a newer release");
});

test("Your packages: Foundry's real compatibility preview for that release", async () => {
  test.skip(!newer, SKIP);
  const side = upd().locator(".stu-side .stw-box", {
    hasText: `Your packages on ${newer ?? ""}`,
  });
  await expect(side.locator(".stu-tags")).toContainText(
    /compatible|unverified/,
    {
      timeout: 60_000,
    },
  );
  await upd()
    .getByRole("tab", { name: /Your packages/ })
    .click();
  const view = upd().locator(".stu-compat");
  await view.getByRole("tab", { name: /^Modules/ }).click();
  const installed = await page.evaluate(
    () =>
      (window as unknown as { game: { modules: { size: number } } }).game
        .modules.size,
  );
  await expect(view.locator(".stu-clist li")).toHaveCount(installed);
  await page.screenshot({ path: `${SCREENS}/server-update-older-compat.png` });
});
