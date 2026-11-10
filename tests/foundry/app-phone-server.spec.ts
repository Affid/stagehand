// The server pages on a phone (Android plan, phase 3, package 5), in the
// app harness on the local Foundry: Backups' summary and New snapshot above
// the tabs, Configuration's unsaved bar above the tabs, What's new from the
// version chip with Back. Changes nothing on the server.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, SCREENS } from "./extension.ts";

const env = loadFoundryEnv();
let app: AppHarness;
let page: Page;

const shell = () => page.locator("#st-shell-root .sts-shell");
const dock = () => shell().locator(".stp-dock");
const tab = (name: string) =>
  shell()
    .locator(".stp-tabs")
    .getByRole("button", { name: new RegExp(`^${name}`) });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  app = await launchApp({ device: "phone" });
  page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
});

test.afterAll(async () => {
  await app.close();
});

test("Backups: the summary and New snapshot sit above the tabs", async () => {
  await tab("Backups").click();
  const bar = dock().locator(".stp-bkbar");
  await expect(bar).toContainText(/\d+ snapshots?/);
  await expect(bar).toContainText("of disk free");
  await expect(shell().locator(".sts-main .stb-head")).toHaveCount(0);
  await bar.getByRole("button", { name: /New snapshot/ }).click();
  const dialog = page.getByRole("dialog", { name: "Create a snapshot" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/phone-backups.png` });
});

/** Foundry's progress ticks, through its own handler (as its socket does). */
async function tick(ticks: readonly Record<string, unknown>[]): Promise<void> {
  await page.evaluate((all) => {
    const sp = (
      window as unknown as {
        ui: { setupPackages: { onProgress: (d: unknown) => void } };
      }
    ).ui.setupPackages;
    for (const t of all) sp.onProgress(t);
  }, ticks);
}

const SNAP = { action: "createSnapshot", id: "snapshot.st-test" };
const BACKUP = {
  action: "createBackup",
  id: "world.st-test.20261108.1",
  title: "Stagehand test world with a long name",
};

test("A snapshot under way fits a phone: one column, the bar inside", async () => {
  await tab("Backups").click();
  await dock().locator(".stp-bkbar").waitFor();
  const job = shell().locator(".sts-main .stb-job");
  try {
    // One tick at a time, as Foundry's socket brings them.
    await tick([{ ...SNAP, step: "snapshotWorlds", pct: 0 }]);
    await expect(job).toContainText("Creating a snapshot · 67%");
    await tick([{ ...BACKUP, step: "archive", pct: 40 }]);
    await expect(job).toContainText(`Backing up ${BACKUP.title}`);
    for (const width of [412, 360]) {
      await page.setViewportSize({ width, height: 800 });
      const r = await job.evaluate((el) => {
        const box = (s: string) => {
          const e = el.querySelector(s);
          if (!e) throw new Error(`no ${s}`);
          return e.getBoundingClientRect();
        };
        const j = el.getBoundingClientRect();
        const title = box(".t strong");
        const bar = box(".bar");
        const steps = box("ol");
        return {
          inside: j.left >= 0 && j.right <= window.innerWidth,
          barInside: bar.left >= j.left && bar.right <= j.right,
          // The bar spans the band (less its padding), under the text.
          barWide: bar.width >= j.width - 40,
          barBelowTitle: bar.top >= title.bottom,
          titleOneLine: title.height < 30,
          // The package's name is cut short, not wrapped.
          detailOneLine: box(".t span").height < 24,
          stepsBelowBar: steps.top >= bar.bottom,
        };
      });
      expect(r, `at ${String(width)} px`).toEqual({
        inside: true,
        barInside: true,
        barWide: true,
        barBelowTitle: true,
        titleOneLine: true,
        detailOneLine: true,
        stepsBelowBar: true,
      });
      await page.screenshot({
        path: `${SCREENS}/phone-snapshot-job-${String(width)}.png`,
      });
    }
  } finally {
    await tick([{ ...BACKUP, step: "complete" }]);
    await tick([{ ...SNAP, step: "complete" }]);
    await page.setViewportSize({ width: 412, height: 915 });
  }
  await expect(job).toHaveCount(0);
});

test("Configuration: an unsaved change's bar sits above the tabs", async () => {
  await tab("Configuration").click();
  const field = shell().getByRole("textbox", { name: /username/i });
  await field.fill("someone");
  const bar = dock().locator(".stc-bar");
  await expect(bar).toContainText("1 change not saved");
  await page.screenshot({ path: `${SCREENS}/phone-config-unsaved.png` });
  await bar.getByRole("button", { name: "Discard" }).click();
  await expect(bar).toHaveCount(0);
});

test("What's new opens from the version chip, and Back returns", async () => {
  await tab("Worlds").click();
  await shell().locator(".sth-ver").click();
  await shell()
    .getByRole("button", { name: /Update page|What's new/ })
    .click();
  await expect(
    shell().getByRole("heading", { level: 1, name: "What's new" }),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/phone-whats-new.png` });
  await shell().getByRole("button", { name: "Back", exact: true }).click();
  await expect(shell()).toHaveAttribute("data-screen", "home");
});
