// The app harness (Android plan, phase 2, package 4): the app's web part
// (packages/extension/dist-app) in Playwright's Chromium against the local
// Foundry, with the native side played in Node (native.ts). As WebView
// does, the bridge object and the page scripts are added at document start,
// only for saved origins and the app's own; the background runs in its own
// page on the app's origin; native relays runtime messages to it with the
// sender taken from the sending page's real URL and frame.
//
// Differences from WebView, test-only: the bridge reaches Node through an
// exposed binding (`__mlNativeSend`; on saved origins its name is taken
// away at document start, elsewhere it stays, and native refuses what
// comes through it) and gets its replies as the binding's answer; native's
// requests to the background page arrive through `__mlHarnessDeliver`,
// there only. Scripts and origins can be added while running but not taken
// away.
import { readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "@playwright/test";
import {
  APP_ID,
  APP_ORIGIN,
  BACKGROUND_PAGE,
  HOME_PAGE,
  wrapForServer,
} from "../../packages/extension/src/app/native-api.ts";
import { NativeSim } from "./native.ts";
import { Relay } from "./relay.ts";

const ROOT = join(import.meta.dirname, "..", "..");
export const DIST_APP = join(ROOT, "packages", "extension", "dist-app");

const WEBVIEW_UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 8 Build/BP2A.250605.031; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.0.0 Mobile Safari/537.36";

/** A touch screen in WebView at this size (CSS px). */
const touch = (width: number, height: number, deviceScaleFactor: number) =>
  ({
    viewport: { width, height },
    deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: WEBVIEW_UA,
  }) as const;

/**
 * The sizes phase 3 checks (Android plan): a Pixel 8 in WebView (412 CSS px
 * wide at 2.625, Android spike), a small phone, a tablet held upright, and
 * a phone and a tablet on their side.
 */
const DEVICES = {
  desktop: { viewport: { width: 1600, height: 1000 } },
  phone: touch(412, 915, 2.625),
  "phone-small": touch(360, 800, 3),
  tablet: touch(768, 1024, 2),
  "phone-side": touch(915, 412, 2.625),
  "tablet-side": touch(1024, 768, 2),
} as const;

export type Device = keyof typeof DEVICES;

export const PHONE_SIZES: readonly Device[] = [
  "phone-small",
  "phone",
  "tablet",
  "phone-side",
  "tablet-side",
];

export interface LaunchOptions {
  readonly device?: Device;
  /** Classic scrollbars, as a desktop browser draws them. */
  readonly scrollbars?: boolean;
}

export interface AppHarness {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly native: NativeSim;
  readonly background: Page;
  /** Native's router, for tests that play a hostile page script. */
  readonly relay: Relay;
  /** The home screen in its own page (opened on first use). */
  home(): Promise<Page>;
  close(): Promise<void>;
}

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};

/**
 * The fake bridge object, for one origin, as WebView's listener gives it.
 * Native's replies come back as the binding's answer; only the background
 * page also gets native's requests, through a global.
 */
const bridgeScript = (origin: string, asksAt?: string): string => `(() => {
  if (location.origin !== ${JSON.stringify(origin)}) return;
  const send = window.__mlNativeSend;
  if (typeof send !== "function") return;
  delete window.__mlNativeSend;
  const hand = (m) => { if (typeof m === "string") port.onmessage?.({ data: m }); };
  const port = {
    onmessage: null,
    postMessage(m) { send(String(m)).then(hand, () => undefined); },
  };
  window.stApp = port;
  ${asksAt ? `if (location.pathname === ${JSON.stringify(asksAt)}) window.__mlHarnessDeliver = hand;` : ""}
})();`;

/** A page script for one server, run only on that server's origin. */
const serverScript = (server: string, file: string): string =>
  `if (location.origin === ${JSON.stringify(new URL(server).origin)}) {\n${wrapForServer(
    readFileSync(join(DIST_APP, file), "utf8"),
    server,
  )}}\n`;

/** Serves dist-app on the app's origin, as WebViewAssetLoader does. */
async function serveAppOrigin(context: BrowserContext): Promise<void> {
  await context.route(`${APP_ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/+/, "");
    const file = resolve(DIST_APP, path);
    if (!file.startsWith(`${DIST_APP}/`)) return route.fulfill({ status: 404 });
    try {
      const body = readFileSync(file);
      await route.fulfill({
        body,
        contentType: TYPES[extname(path)] ?? "application/octet-stream",
      });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
}

export async function launchApp(
  options: LaunchOptions = {},
): Promise<AppHarness> {
  const browser = await chromium.launch({
    channel: "chromium",
    ...(options.scrollbars ? { ignoreDefaultArgs: ["--hide-scrollbars"] } : {}),
  });
  try {
    return await startApp(browser, options);
  } catch (error: unknown) {
    // A failed start never leaves a browser behind (review).
    await browser.close();
    throw error;
  }
}

async function startApp(
  browser: Browser,
  options: LaunchOptions,
): Promise<AppHarness> {
  const context = await browser.newContext(
    DEVICES[options.device ?? "desktop"],
  );
  const injected = new Set<string>();
  /** Set once the relay exists; the home screen may open before. */
  const late: { relay?: Relay } = {};
  let homePage: Page | undefined;
  const home = async (): Promise<Page> => {
    if (!homePage || homePage.isClosed()) {
      homePage = await context.newPage();
      late.relay?.setHome(homePage);
      await homePage.goto(HOME_PAGE);
    }
    return homePage;
  };
  const native = new NativeSim({
    originAllowed: async (origin) => {
      await context.addInitScript(bridgeScript(origin));
    },
    scriptsRegistered: async (server) => {
      if (injected.has(server)) return;
      injected.add(server);
      // app-setup first: app-game takes the bridge on every other page.
      for (const file of ["app-setup.js", "app-game.js"])
        await context.addInitScript(serverScript(server, file));
    },
    homeOpened: async () => {
      await home();
    },
  });
  const r = new Relay(native, APP_ID);
  late.relay = r;
  context.on("page", (page) => {
    r.watch(page);
  });
  await context.exposeBinding("__mlNativeSend", (source, message: unknown) =>
    r.fromPage(source.page, source.frame, String(message)),
  );
  await context.addInitScript(
    bridgeScript(APP_ORIGIN, new URL(BACKGROUND_PAGE).pathname),
  );
  await serveAppOrigin(context);
  const background = await context.newPage();
  r.setBackground(background);
  await background.goto(BACKGROUND_PAGE);
  await r.ready();
  return {
    browser,
    context,
    native,
    background,
    relay: r,
    home,
    close: async () => {
      r.dispose();
      await browser.close();
    },
  };
}

/** Adds a server by its address on the app's home screen, as a user would. */
export async function addServerAtHome(
  app: AppHarness,
  url: string,
): Promise<void> {
  const home = await app.home();
  await home.getByLabel("Server address").fill(`${url}/`);
  await home.getByRole("button", { name: "Add", exact: true }).click();
  await home
    .locator(".stp-servers li")
    .filter({ hasText: new URL(url).host })
    .waitFor();
}

/** Adds the server, logs in as admin and opens Setup with our page on it. */
export async function openAppSetupAsAdmin(
  app: AppHarness,
  page: Page,
  url: string,
  password: string,
): Promise<void> {
  await addServerAtHome(app, url);
  await app.context.request.post(`${url}/auth`, {
    form: { action: "adminAuth", adminPassword: password },
    headers: { Origin: url },
    maxRedirects: 0,
  });
  await page.goto(`${url}/setup`);
  await page.locator("#st-shell-root .sts-top").waitFor();
}
