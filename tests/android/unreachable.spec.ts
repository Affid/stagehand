// The server out of reach (owner, 2026-11-11): our screen instead of
// Chromium's "Web page not available". Foundry's page leaves for /no once
// it gives up reconnecting; a page can fail to load with the device
// offline. Try again asks for Setup, Android's Back is the server list,
// and a server opened from home while offline says so too.
import { expect, test, type Page } from "@playwright/test";
import { App, HOME, installFresh, SERVER } from "./app.ts";
import { adminLogin, closeWorld } from "./foundry.ts";
import { adb, onScreen, sleep, tapNative, waitNative } from "./native-ui.ts";
import { addServer, back } from "./steps.ts";

test.describe.configure({ mode: "serial" });

const LOST = /Can't reach this server/;
const AGAIN = /^Try again$/;
const app = new App();
let page: Page;

const airplane = (on: boolean): string =>
  adb(
    "shell",
    "cmd",
    "connectivity",
    "airplane-mode",
    on ? "enable" : "disable",
  );

/** Try again as a person would, until the server answers and our screen goes. */
async function tryUntilBack(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await tapNative(AGAIN, 30_000);
    const gone = await expect
      .poll(() => onScreen(LOST), { timeout: 15_000 })
      .toBe(false)
      .then(() => true)
      .catch(() => false);
    if (gone) return;
  }
  throw new Error("The server stayed out of reach");
}

test.beforeAll(async () => {
  await closeWorld();
  installFresh();
});

test.afterAll(async () => {
  airplane(false);
  await app.close();
});

test("Foundry's dead end after a lost connection is our screen; Try again reloads Setup", async () => {
  page = await addServer(app);
  // What Foundry's page does once it gives up reconnecting (client/game.mjs).
  await page
    .evaluate((no) => {
      window.location.href = no;
    }, `${SERVER}/no`)
    .catch(() => undefined);
  await waitNative(LOST);
  expect(page.url()).toBe(`${SERVER}/setup`);
  await app.shot("unreachable");
  await tryUntilBack();
  page = await adminLogin(app, SERVER);
  expect(onScreen(LOST)).toBe(false);
});

test("offline, a page that doesn't load is our screen, and stays until the server answers", async () => {
  airplane(true);
  await sleep(3_000);
  await page
    .evaluate(() => {
      window.location.reload();
    })
    .catch(() => undefined);
  await waitNative(LOST, 30_000);
  expect(onScreen(/Web page not available/i)).toBe(false);
  // Still offline: the try fails and the button is there for another.
  await tapNative(AGAIN);
  await sleep(2_000);
  await waitNative(AGAIN, 30_000);
  expect(onScreen(LOST)).toBe(true);
});

test("Back is the server list; the server opened from home while offline says so, then opens", async () => {
  await back();
  const home = await app.pageAt(HOME);
  const open = home.getByRole("link", { name: `Open ${new URL(SERVER).host}` });
  await expect(open).toBeVisible();
  expect(onScreen(LOST)).toBe(false);
  await open.click({ noWaitAfter: true });
  await waitNative(LOST, 30_000);
  airplane(false);
  await tryUntilBack();
  page = await adminLogin(app, SERVER);
  expect(onScreen(LOST)).toBe(false);
});
