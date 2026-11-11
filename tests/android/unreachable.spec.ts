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

test("Foundry's notices about its own connection stay off our page", async () => {
  // The socket's transport closed under Foundry, as Android does to an app
  // in the background: Foundry says lost, reconnects, says re-established.
  const said = await page.evaluate(async () => {
    interface Notices {
      error(m: string): unknown;
      info(m: string): unknown;
    }
    const g = globalThis as unknown as {
      ui: { notifications: Notices };
      game: { socket: { io: { engine: { close(): void } } } };
    };
    const raised: string[] = [];
    const shown: string[] = [];
    const n = g.ui.notifications;
    for (const kind of ["error", "info"] as const) {
      const real = n[kind].bind(n);
      n[kind] = (m: string) => {
        raised.push(m);
        return real(m);
      };
    }
    const end = Date.now() + 6_000;
    g.game.socket.io.engine.close();
    // Each frame, as it is about to be drawn (closing raises the first
    // notice at once, in this very task: looked at only from the next frame).
    while (Date.now() < end) {
      await new Promise((r) => requestAnimationFrame(r));
      for (const li of document.querySelectorAll("#notifications li"))
        if (/connection/i.test(li.textContent)) shown.push(li.textContent);
    }
    return { raised, shown };
  });
  expect(said.raised.join("\n")).toMatch(/lost connection to the server/);
  expect(said.raised.join("\n")).toMatch(/Server connection re-established/);
  expect(said.shown).toEqual([]);
});

test("a loss that lasts shows our small Reconnecting sign until Foundry is back", async () => {
  // Foundry waits three seconds before trying again (under the five after
  // which it would reload the page), then as before.
  const watching = page.evaluate(async () => {
    interface Manager {
      reconnectionDelay(ms: number): unknown;
      reconnectionDelayMax(ms: number): unknown;
      engine: { close(): void };
    }
    const io = (globalThis as unknown as { game: { socket: { io: Manager } } })
      .game.socket.io;
    const delay = (ms: number): void => {
      io.reconnectionDelay(ms);
      io.reconnectionDelayMax(ms);
    };
    const seen: boolean[] = [];
    const start = Date.now();
    delay(3_000);
    io.engine.close();
    // One look every half second: at 0.5 s not yet, then there, then gone.
    while (Date.now() - start < 7_000) {
      await new Promise((r) => setTimeout(r, 500));
      const sign = document.getElementById("st-reconnecting");
      seen.push(sign?.textContent === "Reconnecting…");
    }
    delay(500);
    return seen;
  });
  await sleep(2_000);
  await app.shot("reconnecting");
  const seen = await watching;
  expect(seen[0]).toBe(false);
  expect(seen.slice(1, 4)).toContain(true);
  expect(seen.at(-1)).toBe(false);
  expect(page.url()).toBe(`${SERVER}/setup`);
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
