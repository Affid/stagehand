// The app's home screen (Android plan, phase 2, package 5), in the app
// harness on the local Foundry: it lists the server, Remove gives Setup
// back to Foundry, adding it back brings our page back, Release history is
// turned on and off in native, and Setup's rail opens the home screen.
// The app counterpart of setup-settings.spec.ts; it runs its own app
// harness, so it runs the same in both runs of the suite. Ends with the
// server added, as it began.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  addServerAtHome,
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { audit } from "./axe.ts";
import { exitTour, SCREENS } from "./extension.ts";

const env = loadFoundryEnv();
const HOST = new URL(env.url).host;
let app: AppHarness;
let page: Page;
let home: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  app = await launchApp();
  page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  home = await app.home();
});

test.afterAll(async () => {
  await app.close();
});

const shell = () => page.locator("#ml-shell-root");

test("the home screen lists the server, Release history and the build", async () => {
  await home.reload();
  const row = home.locator(".mlp-servers li").filter({ hasText: HOST });
  await expect(row).toBeVisible();
  await expect(
    home.getByRole("button", { name: `Remove ${HOST}` }),
  ).toBeVisible();
  // No "This site" in the app: the home screen has no tab under it.
  await expect(home.getByText("This site")).toHaveCount(0);
  await expect(home.locator("footer")).toContainText("Build 0.2.0");
  await home.screenshot({ path: `${SCREENS}/app-home.png` });
  await audit(home, "app home screen", ".mlp");
});

test("Remove takes Stagehand off the server: Setup is Foundry's own again", async () => {
  await home.getByRole("button", { name: `Remove ${HOST}` }).click();
  await expect(home.getByText(/No servers yet/)).toBeVisible();
  expect([...app.native.origins]).toEqual([]);
  await page.reload();
  await expect(page.locator("#setup")).toBeVisible({ timeout: 10_000 });
  await expect(shell()).toHaveCount(0);
});

test("adding it back by address brings the new Setup page back", async () => {
  await addServerAtHome(app, env.url);
  await page.reload();
  await expect(shell().locator(".mls-top")).toBeVisible();
});

test("a background that refuses Setup gives Foundry's page back at once", async () => {
  // As if the background had lost this server while native still injects.
  const servers = app.native.get("servers");
  app.native.set("servers", {});
  const started = Date.now();
  await page.reload();
  await expect(page.locator("#setup")).toBeVisible();
  // Long before the veil's own 15 s limit.
  expect(Date.now() - started).toBeLessThan(8000);
  await expect(shell()).toHaveCount(0);
  app.native.set("servers", servers);
  await page.reload();
  await expect(shell().locator(".mls-top")).toBeVisible();
});

test("Release history is allowed and taken back in native", async () => {
  await home.getByRole("button", { name: "Allow foundryvtt.com" }).click();
  await expect(home.getByText("Allowed.")).toBeVisible();
  expect(app.native.releaseHistory).toBe(true);
  await home.getByRole("button", { name: "Remove the permission" }).click();
  await expect(
    home.getByRole("button", { name: "Allow foundryvtt.com" }),
  ).toBeVisible();
  expect(app.native.releaseHistory).toBe(false);
});

test("on a site that isn't saved there is no bridge, and native refuses", async () => {
  const other = await app.context.newPage();
  // The same server under another name: not a saved origin.
  await other.goto(`${env.url.replace("localhost", "127.0.0.1")}/setup`);
  expect(
    await other.evaluate(() => [
      typeof (globalThis as { mlApp?: unknown }).mlApp,
      typeof (globalThis as { __mlHarnessDeliver?: unknown })
        .__mlHarnessDeliver,
    ]),
  ).toEqual(["undefined", "undefined"]);
  // What a page script there could still send through the harness's
  // binding (WebView gives it nothing): refused.
  const reply = await other.evaluate(() =>
    (
      globalThis as unknown as {
        __mlNativeSend: (m: string) => Promise<unknown>;
      }
    ).__mlNativeSend(
      JSON.stringify({
        v: 1,
        id: "x",
        type: "files.open",
        payload: {},
      }),
    ),
  );
  expect(JSON.parse(String(reply))).toMatchObject({
    ok: false,
    error: expect.stringContaining("isn't allowed"),
  });
  expect(app.native.toOpen).toEqual([]);
  await other.close();
});

test("Setup's rail opens the home screen", async () => {
  const before = app.native.homeOpens;
  await shell().getByRole("button", { name: "Stagehand settings" }).click();
  await expect.poll(() => app.native.homeOpens).toBe(before + 1);
});
