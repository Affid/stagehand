// A world's page on a phone (Android plan, phase 3, package 3), in the app
// harness on the local Foundry with the test world reporting its modules:
// the bottom bar says what the next launch changes and holds Launch; the
// Next launch sheet lists the changes with undo, Discard all and Launch;
// Launch goes through the review; the top bar turns solid once the banner
// scrolls away. Ends with the test world's modules as they began.
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
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, joinWorld, SCREENS } from "./extension.ts";
import { settled } from "./settle.ts";

const env = loadFoundryEnv();
const PHONE = { width: 412, height: 915 };
let app: AppHarness;
let admin: APIRequestContext;
let page: Page;

const shell = () => page.locator("#ml-shell-root .mls-shell");
const bar = () => shell().locator(".mlp-dock .mlp-actbar");
const card = (id: string) => shell().locator(`.mlw-card[data-module="${id}"]`);

async function toSetup(): Promise<void> {
  await page.goto("about:blank");
  await shutdownWorld(admin, env.adminPassword);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await app.context.request.post(`${env.url}/auth`, {
    form: { action: "adminAuth", adminPassword: env.adminPassword },
    headers: { Origin: env.url },
    maxRedirects: 0,
  });
  await page.setViewportSize(PHONE);
  await page.goto(`${env.url}/setup`);
  await shell().locator(".mlp-tabs").waitFor();
  await exitTour(page);
  await shell().locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetWorldModules(env);
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  app = await launchApp({ device: "phone" });
  page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  // The first launch reports the world's modules. Joined as a desktop
  // would: Foundry's /join hides its Join button at phone width, and the
  // game at the phone's pixel ratio, drawn without a GPU here, is too busy
  // to answer the companion's hello in time.
  await page.goto("about:blank");
  await launchWorld(admin, TEST_WORLD.id);
  const cdp = await app.context.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await joinWorld(page, env.url, "Gamemaster");
  // The companion's report reached native's storage.
  await expect
    .poll(
      () =>
        [...app.native.kv.keys()].some(
          (k) =>
            k.startsWith("snapshots") &&
            (app.native.kv.get(k) ?? "").includes(TEST_WORLD.id),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.detach();
  await toSetup();
});

test.afterAll(async () => {
  await app.close();
  await shutdownWorld(admin, env.adminPassword).catch(() => undefined);
  await admin.dispose();
  await resetWorldModules(env);
});

test("the bottom bar: no changes yet, then what a switch queues", async () => {
  await expect(card("ml-fixture-a")).toBeVisible();
  await expect(bar()).toContainText("No changes");
  await expect(bar()).toContainText(/\d+ modules? on/);
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  // Fixture A brings its library along: two changes.
  await expect(bar().locator(".mlp-what strong")).toHaveText("2 changes");
  await expect(bar().getByRole("button", { name: /^Launch/ })).toContainText(
    "2",
  );
  // The tab row's count, short: "now → after launch".
  await expect(
    shell()
      .getByRole("tab", { name: /^Modules/ })
      .locator(".c"),
  ).toHaveText(/^\d+ → \d+$/);
  await page.screenshot({ path: `${SCREENS}/phone-world-bar.png` });
});

test("Next launch lists the changes; Discard all empties it", async () => {
  await bar()
    .getByRole("button", { name: /See or undo/ })
    .click();
  const sheet = shell().getByRole("dialog", { name: "Next launch" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("These 2 changes apply when");
  await expect(sheet.getByRole("button", { name: /^Drop / })).toHaveCount(2);
  await settled(page);
  await page.screenshot({ path: `${SCREENS}/phone-next-launch.png` });
  await sheet.getByRole("button", { name: "Discard all" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(bar()).toContainText("No changes");
});

test("a change's undo in Next launch takes it back", async () => {
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  await expect(bar().locator(".mlp-what strong")).toHaveText("2 changes");
  await bar()
    .getByRole("button", { name: /See or undo/ })
    .click();
  const sheet = shell().getByRole("dialog", { name: "Next launch" });
  // Fixture A's own change: its library came only with it, so both go.
  await sheet.getByRole("button", { name: /^Drop .*A \(requires/ }).click();
  await expect(sheet).toContainText("Nothing queued for");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(bar()).toContainText("No changes");
});

test("Launch goes through the review, which comes up from the bottom", async () => {
  await card("ml-fixture-a").locator('input[role="switch"]').click();
  await expect(bar().locator(".mlp-what strong")).toHaveText("2 changes");
  await bar()
    .getByRole("button", { name: /^Launch/ })
    .click();
  const review = page.getByRole("dialog", {
    name: `Launch ${TEST_WORLD.title}`,
  });
  await expect(review).toBeVisible();
  await settled(page);
  await page.screenshot({ path: `${SCREENS}/phone-launch-review.png` });
  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toHaveCount(0);
  // Back from Next launch's own Launch, too.
  await bar()
    .getByRole("button", { name: /See or undo/ })
    .click();
  const sheet = shell().getByRole("dialog", { name: "Next launch" });
  await sheet.getByRole("button", { name: /^Launch/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Cancel" }).click();
  await bar()
    .getByRole("button", { name: /See or undo/ })
    .click();
  await sheet.getByRole("button", { name: "Discard all" }).click();
  await expect(bar()).toContainText("No changes");
});

test("the top bar turns solid with the world's name once the banner scrolls away", async () => {
  const name = shell().locator(".mlp-top h1");
  await expect(name).toHaveCSS("opacity", "0");
  await shell()
    .locator(".mls-main")
    .evaluate((el) => {
      el.scrollTop = 400;
    });
  await expect(shell()).toHaveClass(/mlp-scrolled/);
  await expect(name).toHaveCSS("opacity", "1");
  // Only the tab row stays pinned, under the bar.
  const top = await shell().locator(".mlp-top").boundingBox();
  const tabs = await shell().locator(".mls-main .mls-subtabs").boundingBox();
  expect(Math.round(tabs?.y ?? 0)).toBe(
    Math.round((top?.y ?? 0) + (top?.height ?? 0)),
  );
  await page.screenshot({ path: `${SCREENS}/phone-world-scrolled.png` });
});
