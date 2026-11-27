// Package updates on the local Foundry (docs/UPDATES-PLAN.md), with fixture
// packages whose newer manifests and zips a local server serves
// (scripts/foundry/update-fixtures.ts), so Foundry's own check and install
// run end to end.
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  installFixtures,
  removeFixtures,
  startUpdateServer,
  type UpdateServer,
} from "../../scripts/foundry/update-fixtures.ts";
import { ON_13 } from "./core.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
let server: UpdateServer;
let admin: APIRequestContext;
let ext: Target;
let page: Page;

const shell = (): Locator => page.locator("#st-shell-root");
const card = (id: string): Locator =>
  shell().locator(`.stl-card[data-module="${id}"]`);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  server = await startUpdateServer();
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await shutdownWorld(admin, env.adminPassword);
  installFixtures(env.dataDir, server.base);
  await setupPost(admin, { action: "resetPackages" });
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
});

test.afterAll(async () => {
  await ext.close();
  removeFixtures(env.dataDir);
  await setupPost(admin, { action: "resetPackages" }).catch(() => undefined);
  await admin.dispose();
  await server.close();
});

test("one package from its Update box: checked, then installed with progress on the card, the box and the rail", async () => {
  const plain = card("st-upd-plain");
  await plain.getByRole("button", { name: /Updates fixture: plain/ }).click();
  const panel = shell().getByRole("complementary", {
    name: /Updates fixture: plain/,
  });
  await panel.getByRole("tab", { name: "Package" }).click();
  const box = panel.locator(".spu-box");
  await expect(box).toContainText("Not checked yet.");
  await box.getByRole("button", { name: "Check for update" }).click();
  await expect(box).toContainText("1.1.0 is available · you have 1.0.0", {
    timeout: 20_000,
  });
  await box.getByRole("checkbox", { name: "Back up first" }).uncheck();
  await box.getByRole("button", { name: "Update to 1.1.0" }).click();
  // The download is spread over 3 seconds: its percentage shows on the chip.
  const chip = plain.locator(".spu-chip");
  await expect(chip).toHaveText(/^\d+%$/, { timeout: 15_000 });
  await expect(box).toContainText(/Downloading \d+%/);
  await expect(shell().locator(".sts-lib > span")).toHaveText(
    "Updating 1 of 1…",
  );
  // Bars as they settle: the fixtures move faster than the bar's transition.
  await page.screenshot({
    path: `${SCREENS}/updates-phase1-progress.png`,
    animations: "disabled",
  });
  // Done: the chip goes, the card shows the new version, the box says so.
  await expect(chip).toHaveCount(0, { timeout: 20_000 });
  await expect(plain).toContainText("v1.1.0", { timeout: 10_000 });
  await expect(box).toContainText("updated to 1.1.0 just now");
  await panel.getByRole("button", { name: "Close" }).click();
});

const tab = (name: RegExp): Locator =>
  shell().locator(".stl-page").getByRole("tab", { name });
const section = (name: string): Locator =>
  shell()
    .locator(".spu-sec")
    .filter({ has: page.locator(".spu-sh", { hasText: name }) });
const rowSel = (id: string): string => `.spu-row[data-id="${id}"]`;
const row = (id: string): Locator => shell().locator(rowSel(id));

test("phase 2: the Updates tab checks every package and sorts what it found", async () => {
  await tab(/^Updates/).click();
  // Never checked in this browser: opening the tab checks, with progress.
  await expect(shell().locator(".spu-head.busy")).toBeVisible();
  // Bars as they settle: the fixtures move faster than the bar's transition.
  await page.screenshot({
    path: `${SCREENS}/updates-phase2-checking.png`,
    animations: "disabled",
  });
  await expect(shell().locator(".spu-head:not(.busy)")).toBeVisible({
    timeout: 60_000,
  });
  await expect(section("Ready").locator(rowSel("st-upd-lib"))).toBeVisible();
  // Its need is met by another Ready update: Ready too.
  await expect(section("Ready").locator(rowSel("st-upd-needs"))).toBeVisible();
  await expect(row("st-upd-lib")).toContainText("1.0.0");
  await expect(row("st-upd-lib")).toContainText("1.1.0");
  await expect(
    section("Can't update here").locator(rowSel("st-upd-core")),
  ).toContainText("Needs Foundry 99 or newer");
  await expect(
    section("Not available to you").locator(rowSel("st-upd-manifest403")),
  ).toContainText("refused access (403)");
  // Updated by the first test: under Updated just now, not Ready.
  await expect(section("Ready").locator(rowSel("st-upd-plain"))).toHaveCount(0);
  await expect(shell().locator(".spu-sec.updated")).toContainText(
    "Updates fixture: plain",
  );
  await page.screenshot({ path: `${SCREENS}/updates-phase2-list.png` });
  // A row's action checks that package again.
  await row("st-upd-manifest403")
    .getByRole("button", { name: "Check again" })
    .click();
  await expect(row("st-upd-manifest403")).toContainText("refused access", {
    timeout: 15_000,
  });
  // A private manifest's update gets a mark on its card, from our check.
  await tab(/^Modules/).click();
  await expect(card("st-upd-lib").locator(".stw-upd")).toHaveText("1.1.0");
});

test("phase 2: the check is kept: after a reload the tab shows it without checking again", async () => {
  await page.reload();
  await shell().locator(".sts-top").waitFor();
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
  await tab(/^Updates/).click();
  await expect(shell().locator(".spu-head")).toContainText("checked");
  await expect(shell().locator(".spu-head.busy")).toHaveCount(0);
  await expect(row("st-upd-lib")).toBeVisible();
});

/**
 * Every width the run's bar is given, in order, while the run goes on;
 * the returned function reads them.
 */
async function watchRunBar(): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const seen: number[] = [];
    Object.assign(window, { stRunBar: seen });
    const root = document.querySelector("#st-shell-root");
    if (!root) throw new Error("No Stagehand shell");
    new MutationObserver(() => {
      const fill = root.querySelector<HTMLElement>(
        ".spu-foot.busy .spu-bar span",
      );
      const width = fill ? parseFloat(fill.style.width) : NaN;
      if (!Number.isNaN(width) && seen.at(-1) !== width) seen.push(width);
    }).observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { stRunBar: number[] }).stRunBar);
}

test("phase 3: Update installs only the ticked packages, after a backup, with progress and a summary", async () => {
  await tab(/^Updates/).click();
  // Only our fixtures: the server's real system update stays as it is.
  await section("Ready").getByRole("link", { name: "Untick all" }).click();
  for (const title of [
    "Updates fixture: library",
    "Updates fixture: needs library 1.1",
    "Updates fixture: download refused",
  ])
    await shell()
      .getByRole("checkbox", { name: `Update ${title}` })
      .check();
  await expect(shell().locator(".spu-foot")).toContainText("3 packages ticked");
  await shell().getByRole("checkbox", { name: "Back up first" }).check();
  const bar = await watchRunBar();
  await shell().getByRole("button", { name: "Update 3" }).click();
  await expect(shell().locator(".spu-foot.busy")).toBeVisible();
  await expect(shell().locator(".sts-lib > span")).toContainText("Updating");
  // Bars as they settle: the fixtures move faster than the bar's transition.
  await page.screenshot({
    path: `${SCREENS}/updates-phase3-running.png`,
    animations: "disabled",
  });
  await expect(shell().locator(".spu-sum")).toContainText(
    "2 packages updated · 1 failed.",
    { timeout: 120_000 },
  );
  await expect(shell().locator(".spu-sec.updated")).toContainText(
    "Updates fixture: library",
  );
  await expect(shell().locator(".spu-sec.updated")).toContainText(
    "Updates fixture: needs library 1.1",
  );
  if (ON_13) {
    // Foundry 13 doesn't report the 403: its install fails on the missing
    // zip, so the row stays to tick again and says the download didn't arrive.
    await expect(
      section("Ready").locator(rowSel("st-upd-download403")),
    ).toContainText("The update failed: The download didn't arrive");
  } else {
    await expect(
      section("Not available to you").locator(rowSel("st-upd-download403")),
    ).toBeVisible();
  }
  // Backups, then installs: one bar that only ever moves forward.
  const widths = await bar();
  expect(widths.length).toBeGreaterThan(2);
  expect(widths).toEqual(widths.toSorted((a, b) => a - b));
  await page.screenshot({ path: `${SCREENS}/updates-phase3-done.png` });
  await tab(/^Modules/).click();
  await expect(card("st-upd-lib")).toContainText("v1.1.0");
  await expect(card("st-upd-needs")).toContainText("v1.1.0");
});

test("phase 3: a system's update chip opens its panel's Update box, which installs nothing by itself", async () => {
  await tab(/^Systems/).click();
  const sys = shell().locator('.stl-card[data-system="st-upd-sys"]');
  await sys.locator(".stw-upd").click();
  const box = shell().locator(".sts-panel .spu-box");
  await expect(box).toContainText("1.1.0 is available · you have 1.0.0");
  await expect(
    box.getByRole("button", { name: "Update to 1.1.0" }),
  ).toBeEnabled();
  await page.screenshot({ path: `${SCREENS}/updates-phase3-box.png` });
  await shell()
    .locator(".sts-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await tab(/^Modules/).click();
});

test("phase 4: an update that needs a newer system asks first, offers the system, and asks again about what the system leaves behind", async () => {
  await tab(/^Modules/).click();
  const sysnew = card("st-upd-sysnew");
  await sysnew.locator("button.t").click();
  const panel = shell().getByRole("complementary", {
    name: /needs the system 1.1/,
  });
  await panel.getByRole("tab", { name: "Package" }).click();
  const box = panel.locator(".spu-box");
  await expect(box).toContainText("Fits Updates fixture system 1.1.0 or newer");
  await box.getByRole("checkbox", { name: "Back up first" }).uncheck();
  await box.getByRole("button", { name: "Update to 1.1.0" }).click();
  const dialog = shell().getByRole("dialog");
  await expect(dialog).toContainText(
    "Update Updates fixture: needs the system 1.1?",
  );
  await expect(dialog.locator("button.bright")).toHaveText(
    "Also update Updates fixture system",
  );
  await page.screenshot({ path: `${SCREENS}/updates-phase4-confirm.png` });
  await dialog
    .getByRole("button", { name: "Also update Updates fixture system" })
    .click();
  // Judged again: the system leaves the module that fits only 1.0 behind.
  await expect(shell().getByRole("dialog")).toContainText("Update 2 packages?");
  await expect(shell().getByRole("dialog")).toContainText(
    "Updates fixture: fits the system 1.0 (no update yet)",
  );
  // Leaving the system out would leave the module short of it: nothing
  // safer is left, so Update anyway is the highlighted choice.
  await expect(shell().getByRole("dialog").locator("button.bright")).toHaveText(
    "Update anyway",
  );
  await shell()
    .getByRole("dialog")
    .getByRole("button", { name: "Update anyway" })
    .click();
  await panel.getByRole("button", { name: "Close" }).click();
  await tab(/^Updates/).click();
  await expect(shell().locator(".spu-sum")).toContainText(
    "2 packages updated.",
    {
      timeout: 60_000,
    },
  );
});

test("phase 5: a refused download's Try again tries the install again; refused again, it stays not available", async () => {
  test.skip(ON_13, "Foundry 13 doesn't report a refused download's 403");
  const refused = section("Not available to you").locator(
    rowSel("st-upd-download403"),
  );
  await expect(refused).toContainText("The download was refused");
  await refused.getByRole("button", { name: "Try again" }).click();
  await expect(shell().locator(".spu-sum")).toContainText("1 failed", {
    timeout: 60_000,
  });
  await expect(
    section("Not available to you").locator(rowSel("st-upd-download403")),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/updates-phase5-refused.png` });
});
