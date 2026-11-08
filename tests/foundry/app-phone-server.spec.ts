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

const shell = () => page.locator("#ml-shell-root .mls-shell");
const dock = () => shell().locator(".mlp-dock");
const tab = (name: string) =>
  shell()
    .locator(".mlp-tabs")
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
  const bar = dock().locator(".mlp-bkbar");
  await expect(bar).toContainText(/\d+ snapshots?/);
  await expect(bar).toContainText("of disk free");
  await expect(shell().locator(".mls-main .mlb-head")).toHaveCount(0);
  await bar.getByRole("button", { name: /New snapshot/ }).click();
  const dialog = page.getByRole("dialog", { name: "Create a snapshot" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/phone-backups.png` });
});

test("Configuration: an unsaved change's bar sits above the tabs", async () => {
  await tab("Configuration").click();
  const field = shell().getByRole("textbox", { name: /username/i });
  await field.fill("someone");
  const bar = dock().locator(".mlc-bar");
  await expect(bar).toContainText("1 change not saved");
  await page.screenshot({ path: `${SCREENS}/phone-config-unsaved.png` });
  await bar.getByRole("button", { name: "Discard" }).click();
  await expect(bar).toHaveCount(0);
});

test("What's new opens from the version chip, and Back returns", async () => {
  await tab("Worlds").click();
  await shell().locator(".mlh-ver").click();
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
