// The Android app on a device, end to end (docs/ANDROID-APP-PLAN.md,
// phase 4 package 5): the debug app freshly installed on the emulator,
// driven through Playwright's Android support (WebView pages) and adb
// (native UI). Adds the local server, logs in as admin, launches the test
// world from our Setup page and joins it as the Gamemaster (the first
// report), then queues a module change, applies it through the launch
// review and checks the companion turned the modules on in the world.
// Fails on the first step that doesn't hold; screenshots in
// test-results/screens/android-*.png.
// Needs: the local Foundry on Setup (no world running), the emulator up,
// the debug APK built (`pnpm android:build`). Windows' adb installs from a
// Windows folder: ML_APK_DIR (WSL path) and ML_APK_WIN (the same file as
// Windows sees it) default to the owner's machine.
// Usage: node scripts/dev/android-run.ts
import { _android, type AndroidDevice, type Page } from "@playwright/test";
import { createAdminClient, shutdownWorld } from "../foundry/admin.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import { resetWorldModules } from "../foundry/reset-world.ts";
import { COMPANION_ID, TEST_WORLD } from "../foundry/world.ts";
import { adb, adbWithInput } from "../../tests/android/native-ui.ts";

const PKG = "dev.modulelibrary.app.debug";
const APK = "packages/android/app/build/outputs/apk/debug/app-debug.apk";
/** Where Windows' adb can read the APK. */
const APK_WIN_DIR = process.env.ML_APK_DIR ?? "/mnt/c/Users/fagot/ml-apk";
const APK_WIN =
  process.env.ML_APK_WIN ?? "C:\\Users\\fagot\\ml-apk\\app-debug.apk";
const SERVER = process.env.ML_APP_SERVER ?? "http://10.0.2.2:30000";
const HOME = "https://appassets.androidplatform.net/home.html";
const OUT = "test-results/screens";

const env = loadFoundryEnv();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Until Foundry reports no world running (a shutdown takes a moment). */
async function waitClosed(): Promise<void> {
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    const r = await fetch(`${env.url}/api/status`).catch(() => undefined);
    const s = (await r?.json().catch(() => undefined)) as
      { active?: boolean } | undefined;
    if (s?.active === false) return;
    await sleep(1_000);
  }
  throw new Error("The world didn't close");
}

function step(name: string): void {
  console.log(`- ${name}`);
}

async function shot(_device: AndroidDevice, name: string): Promise<void> {
  await (await live()).screenshot({ path: `${OUT}/android-${name}.png` });
}

/** The adb device, connected again when the app's WebViews change. */
let current: AndroidDevice | undefined;

async function connect(): Promise<AndroidDevice> {
  const [device] = await _android.devices({ port: 5037 });
  if (!device) throw new Error("No Android device on adb");
  current = device;
  return device;
}

/**
 * The app's WebView page whose address starts with `start`. A connection
 * doesn't see pages that appear after it was made (seen on the emulator),
 * so it connects again until the page is there.
 */
async function pageAt(
  _device: AndroidDevice,
  start: string,
  timeoutMs = 30_000,
): Promise<Page> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const device = current ?? (await connect());
    const first = await (
      await device.webView({ pkg: PKG }, { timeout: timeoutMs })
    ).page();
    const found = first
      .context()
      .pages()
      .find((p) => p.url().startsWith(start));
    if (found) return found;
    await device.close();
    current = undefined;
    await sleep(1_000);
  }
  throw new Error(`No app page at ${start}`);
}

/** The live connection, for screenshots. */
const live = async (): Promise<AndroidDevice> => current ?? connect();

async function installFresh(): Promise<void> {
  step("install the debug app with no data, start it");
  const { copyFileSync } = await import("node:fs");
  copyFileSync(APK, `${APK_WIN_DIR}/app-debug.apk`);
  adb("install", "-r", APK_WIN);
  adb("shell", "pm", "clear", PKG);
  // The emulator's WebView is older than Foundry 14 wants, and the app says
  // so once per version (checked by hand); the run starts past that notice:
  // a debug build lets run-as write the app's setting.
  const version =
    /Current WebView package \(name, version\): \([^,]+, ([^)]+)\)/.exec(
      adb("shell", "dumpsys", "webviewupdate"),
    )?.[1];
  if (version) {
    const prefs = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map><string name="webviewWarnedFor">${version}</string></map>`;
    adb("shell", "run-as", PKG, "mkdir", "-p", "shared_prefs");
    adbWithInput(
      prefs,
      "shell",
      "run-as",
      PKG,
      "sh",
      "-c",
      "'cat > shared_prefs/app.xml'",
    );
  }
  adb(
    "shell",
    "am",
    "start",
    "-n",
    `${PKG}/dev.modulelibrary.app.MainActivity`,
  );
}

async function addAndOpen(device: AndroidDevice): Promise<Page> {
  step("home: add the server, open it with a tap");
  const home = await pageAt(device, HOME);
  await home.getByLabel("Server address").fill(SERVER);
  await home.getByRole("button", { name: "Add", exact: true }).click();
  const link = home.getByRole("link", { name: `Open ${new URL(SERVER).host}` });
  await link.waitFor();
  await home.getByText("Not encrypted").waitFor();
  await shot(device, "home");
  await link.click({ noWaitAfter: true });
  return pageAt(device, SERVER);
}

async function adminLogin(page: Page): Promise<void> {
  step("admin login in the server WebView; our Setup page");
  const status = await page.evaluate(async (password) => {
    const body = new URLSearchParams({
      action: "adminAuth",
      adminPassword: password,
    });
    return (await fetch("/auth", { method: "POST", body })).status;
  }, env.adminPassword);
  if (status !== 200) throw new Error(`Admin login answered ${String(status)}`);
  await page.goto(`${SERVER}/setup`);
  await page.locator("#ml-shell-root .mlp-top").waitFor({ timeout: 60_000 });
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry?: {
        nue?: { Tour?: { activeTour?: { exit(): unknown } | null } };
      };
    };
    await g.foundry?.nue?.Tour?.activeTour?.exit();
  });
}

async function openWorld(page: Page): Promise<void> {
  await page
    .locator(`#ml-shell-root .mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  await page.locator("#ml-shell-root .mls-banner").waitFor();
}

/** Launch from our page: the bottom bar's Launch, then the review if one comes. */
async function launch(
  device: AndroidDevice,
  page: Page,
  changes?: string,
): Promise<void> {
  await recordCompanion(page);
  await page
    .locator("#ml-shell-root .mlp-dock")
    .getByRole("button", { name: /^Launch/ })
    .click();
  if (changes) {
    const review = page.getByRole("dialog", {
      name: `Launch ${TEST_WORLD.title}`,
    });
    await review.getByRole("checkbox", { name: /Back up .* first/ }).uncheck();
    await shot(device, "review");
    await review
      .getByRole("button", { name: `Apply ${changes} and launch` })
      .click();
  }
}

/** Records the companion's talk with our bridge on the pages that follow. */
async function recordCompanion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __mlSeen: string[] }).__mlSeen = seen;
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { ns?: string; type?: string } | null;
      if (d?.ns === "module-library" && d.type) seen.push(d.type);
    });
  });
}

/**
 * After a launch from our page, on the same page object (a new connection
 * would drop the recorder): Foundry's /join with its Join button clear,
 * joined as the GM, or straight to /game for a browser already signed in;
 * then the game ready and the companion's session done.
 */
async function joinAsGm(device: AndroidDevice, page: Page): Promise<Page> {
  await page.waitForURL(/\/(join|game)$/, { timeout: 60_000 });
  if (page.url().endsWith("/join")) {
    await page.locator('#join-game-form button[name="join"]').waitFor();
    await sleep(2_000);
    const clear = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(
        '#join-game-form button[name="join"]',
      );
      if (!b) return "no Join button";
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return b.contains(top)
        ? "clear"
        : `covered by ${top?.tagName ?? "?"}.${top?.className ?? ""}`;
    });
    console.log(`  Join button: ${clear}`);
    if (clear !== "clear") throw new Error(`Join button ${clear}`);
    await shot(device, "join");
    await page
      .locator('#join-game-form select[name="userId"]')
      .selectOption({ label: "Gamemaster" });
    await page
      .locator('#join-game-form button[name="join"]')
      .click({ noWaitAfter: true });
    await page.waitForURL(/\/game$/, { timeout: 60_000 });
  } else console.log("  straight to the game (signed in)");
  await page.waitForFunction(
    () => (globalThis as { game?: { ready?: boolean } }).game?.ready === true,
    null,
    { timeout: 180_000 },
  );
  // HELLO answered, the snapshot sent, the commands pulled.
  await page.waitForFunction(
    () =>
      (window as unknown as { __mlSeen?: string[] }).__mlSeen?.includes(
        "COMMANDS",
      ) === true,
    null,
    { timeout: 90_000 },
  );
  const seen = await page.evaluate(() =>
    (window as unknown as { __mlSeen: string[] }).__mlSeen.join(" "),
  );
  console.log(`  companion: ${seen.slice(0, 200)}`);
  return page;
}

const activeModules = (p: Page): Promise<string[]> =>
  p.evaluate(() => {
    const g = globalThis as unknown as {
      game: { modules: Map<string, { id: string; active: boolean }> };
    };
    return [...g.game.modules.values()]
      .filter((m) => m.active)
      .map((m) => m.id)
      .sort();
  });

async function backToSetup(device: AndroidDevice, page: Page): Promise<Page> {
  const api = await createAdminClient(env.url);
  try {
    // Foundry takes the admin password for a shutdown while a world runs.
    await shutdownWorld(api, env.adminPassword);
  } finally {
    await api.dispose();
  }
  await waitClosed();
  await page.goto(`${SERVER}/auth`).catch(() => undefined);
  const auth = await pageAt(device, SERVER);
  await adminLogin(auth);
  return auth;
}

async function main(): Promise<void> {
  await resetWorldModules(env);
  await waitClosed();
  await installFresh();
  const device = await connect();
  try {
    let page = await addAndOpen(device);
    await adminLogin(page);
    await shot(device, "setup");

    step(
      "launch the test world from our page; join as the Gamemaster (first report)",
    );
    await openWorld(page);
    await launch(device, page);
    let game = await joinAsGm(device, page);
    await shot(device, "game");

    step("back to Setup; queue Fixture A (its library comes along)");
    page = await backToSetup(device, game);
    await openWorld(page);
    await page
      .locator(
        '#ml-shell-root .mlw-card[data-module="ml-fixture-a"] input[role="switch"]',
      )
      .click();
    await page
      .locator("#ml-shell-root .mlp-dock")
      .getByText(/2 changes/)
      .waitFor();
    await shot(device, "queued");

    step("apply and launch through the review; join; the companion applies");
    await launch(device, page, "2 changes");
    game = await joinAsGm(device, page);
    const want = ["ml-fixture-a", "ml-fixture-lib", COMPANION_ID]
      .sort()
      .join(",");
    const end = Date.now() + 90_000;
    let got = "";
    while (Date.now() < end) {
      got = (await activeModules(game).catch(() => [])).join(",");
      if (got === want) break;
      await sleep(1_000);
    }
    console.log(`  active modules: ${got}`);
    if (got !== want) throw new Error(`Expected ${want}`);
    // After its reload the companion reports again: the fresh snapshot
    // Setup shows (the recorder starts over with the reloaded page).
    await game.waitForFunction(
      () =>
        (window as unknown as { __mlSeen?: string[] }).__mlSeen?.includes(
          "COMMANDS",
        ) === true,
      null,
      { timeout: 90_000 },
    );
    await game.waitForFunction(
      () => (globalThis as { game?: { ready?: boolean } }).game?.ready === true,
    );
    await shot(device, "applied");

    step("back to Setup: the world shows three modules on");
    page = await backToSetup(device, game);
    await openWorld(page);
    await page
      .locator("#ml-shell-root .mls-banner")
      .getByText(/3 modules on/)
      .waitFor();
    await shot(device, "after");
    console.log("Device run passed.");
  } finally {
    await current?.close();
    await resetWorldModules(env).catch((error: unknown) => {
      console.error("Couldn't reset the test world:", error);
    });
  }
}

await main();
