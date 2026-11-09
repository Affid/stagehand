// The app opened while a world runs (Android plan, phase 3, package 6), in
// the app harness on the local Foundry: Foundry sends everyone to /join, so
// the app shows its own screen there; Back to Setup asks for the admin
// password Foundry wants and lands on our Setup; a launch from our Setup
// shows our launching screen, then /join is ours too, with Back to Setup
// and Server list and never the game (owner, phase 7). Ends with no world
// running.
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, SCREENS } from "./extension.ts";

const env = loadFoundryEnv();
let app: AppHarness;
let admin: APIRequestContext;
let page: Page;

const run = () => page.locator("#ml-run-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await shutdownWorld(admin, env.adminPassword);
  app = await launchApp({ device: "phone" });
  page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
});

test.afterAll(async () => {
  await app.close();
  await shutdownWorld(admin, env.adminPassword).catch(() => undefined);
  await admin.dispose();
});

test("opened while a world runs, the app shows which world and Back to Setup", async () => {
  await page.goto("about:blank");
  await launchWorld(admin, TEST_WORLD.id);
  await page.goto(`${env.url}/setup`);
  await expect(page).toHaveURL(/\/join$/);
  await expect(run()).toBeVisible();
  await expect(
    run().getByRole("heading", { name: TEST_WORLD.title }),
  ).toBeVisible();
  await expect(run()).toContainText("Running now");
  await expect(run()).toContainText(/Nobody in the game|in the game/);
  await expect(
    run().getByRole("button", { name: "Back to Setup" }),
  ).toBeVisible();
  // Foundry's own join form is under it, out of sight.
  await page.screenshot({ path: `${SCREENS}/phone-running.png` });
});

test("without an admin session, Back to Setup asks for the password Foundry wants", async () => {
  await app.context.clearCookies();
  await page.reload();
  await expect(run()).toBeVisible();
  await run().getByRole("button", { name: "Back to Setup" }).click();
  const sheet = run().getByRole("dialog", { name: "Administrator password" });
  await expect(sheet).toBeVisible();
  await sheet.locator("input[type=password]").fill("not the password");
  await sheet.getByRole("button", { name: "Back to Setup" }).click();
  await expect(sheet.getByRole("alert")).toContainText("didn't accept");
  await sheet.locator("input[type=password]").fill(env.adminPassword);
  await sheet.getByRole("button", { name: "Back to Setup" }).click();
  await expect(page).toHaveURL(/\/(setup|auth)$/, { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        ((await (await admin.get("/api/status")).json()) as { active: boolean })
          .active,
      {
        timeout: 60_000,
      },
    )
    .toBe(false);
});

test("with the admin's session, Back to Setup closes the world and lands on our Setup", async () => {
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  await page.goto("about:blank");
  await launchWorld(admin, TEST_WORLD.id);
  await page.goto(`${env.url}/setup`);
  await expect(run()).toBeVisible();
  await run().getByRole("button", { name: "Back to Setup" }).click();
  await expect(page).toHaveURL(/\/setup$/, { timeout: 60_000 });
  await expect(page.locator("#ml-shell-root .mlp-tabs")).toBeVisible({
    timeout: 30_000,
  });
});

test("after a launch from our Setup: our launching screen, then our running page, no game", async () => {
  await exitTour(page);
  await page
    .locator(`#ml-shell-root .mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  await page
    .locator("#ml-shell-root .mlp-dock")
    .getByRole("button", { name: /^Launch/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: `Launching ${TEST_WORLD.title}` }),
  ).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/app-launching.png` });
  await page.waitForURL(/\/join$/, { timeout: 60_000 });
  await expect(
    run().getByRole("button", { name: "Back to Setup" }),
  ).toBeVisible();
  await expect(
    run().getByRole("link", { name: "Server list" }),
  ).toHaveAttribute("href", "https://appassets.androidplatform.net/home.html");
  await expect(run().getByText(/Gamemaster/)).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/app-running-launched.png` });
});
