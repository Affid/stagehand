// Loads the built extension into Playwright's Chromium.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BrowserContext,
  chromium,
  expect,
  type Locator,
  type Page,
  type Worker,
} from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const DIST = join(ROOT, "packages", "extension", "dist");
const UNDER_TEST = join(ROOT, "test-results", "extension-under-test");

export interface LoadedExtension {
  readonly context: BrowserContext;
  readonly worker: Worker;
  readonly id: string;
}

/**
 * A copy of the build that is granted localhost at install, so the options
 * page's permission request resolves without Chrome's (native) prompt; and
 * any other hosts a suite needs (foundryvtt.com for Release history).
 */
function prepareCopy(hosts: readonly string[]): string {
  rmSync(UNDER_TEST, { recursive: true, force: true });
  cpSync(DIST, UNDER_TEST, { recursive: true });
  const path = join(UNDER_TEST, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as object;
  writeFileSync(
    path,
    JSON.stringify({
      ...manifest,
      host_permissions: ["http://localhost/*", ...hosts],
    }),
  );
  return UNDER_TEST;
}

export interface LoadOptions {
  /** Classic scrollbars that take room, as a desktop Chrome draws them
   * (Playwright hides them by default). */
  readonly scrollbars?: boolean;
}

export async function loadExtension(
  hosts: readonly string[] = [],
  options: LoadOptions = {},
): Promise<LoadedExtension> {
  const dir = prepareCopy(hosts);
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    viewport: { width: 1600, height: 1000 },
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
    ...(options.scrollbars ? { ignoreDefaultArgs: ["--hide-scrollbars"] } : {}),
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  return { context, worker, id: new URL(worker.url()).host };
}

/** Everything the extension stored, read in its service worker. */
export function storage(worker: Worker): Promise<Record<string, unknown>> {
  return worker.evaluate(() => chrome.storage.local.get(null));
}

export async function joinWorld(
  page: Page,
  url: string,
  user: string,
): Promise<void> {
  // As after a launch from Setup: the app's own screen for a running world
  // (app/running) leaves Foundry's join form alone then.
  await page.goto(`${url}/join`, { referer: `${url}/setup` });
  await page
    .locator('#join-game-form select[name="userId"]')
    .selectOption({ label: user });
  await page.locator('#join-game-form button[name="join"]').click();
  await page.waitForURL(/\/game$/);
  await waitReady(page);
}

/** Ends Foundry's first-run tour, whose overlay blocks clicks in a fresh profile. */
export async function exitTour(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        nue: { Tour: { activeTour?: { exit(): Promise<void> | void } | null } };
      };
    };
    await g.foundry.nue.Tour.activeTour?.exit();
  });
  await page.locator(".tour-overlay").waitFor({ state: "detached" });
}

export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (globalThis as { game?: { ready?: boolean } }).game?.ready === true,
    null,
    { timeout: 120_000 },
  );
}

/** The settings panel (the toolbar popup), opened as a page. */
export const settingsUrl = (ext: LoadedExtension): string =>
  `chrome-extension://${ext.id}/popup.html`;

/**
 * Waits until the settings panel has opened over the page: the toolbar popup,
 * or, where the browser won't open it (an automated window is never
 * focused), the options dialog with the panel inside. Neither is a page
 * Playwright lists, so Chrome's DevTools protocol is asked.
 */
export async function waitForSettingsPanel(
  ext: LoadedExtension,
  page: Page,
): Promise<void> {
  const cdp = await ext.context.newCDPSession(page);
  try {
    await expect
      .poll(
        async () => {
          const { targetInfos } = await cdp.send("Target.getTargets");
          return targetInfos.some((t) => t.url === settingsUrl(ext));
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  } finally {
    await cdp.detach();
  }
}

/** Adds a server by its address in the settings panel. */
export async function addServer(
  ext: LoadedExtension,
  page: Page,
  url: string,
): Promise<void> {
  await page.goto(settingsUrl(ext));
  await page.getByLabel("Server address").fill(`${url}/`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .locator(".mlp-servers li")
    .filter({ hasText: new URL(url).host })
    .waitFor();
}

/** Registers the server in the settings panel and opens Setup as admin. */
export async function openSetupAsAdmin(
  ext: LoadedExtension,
  page: Page,
  url: string,
  password: string,
): Promise<void> {
  await addServer(ext, page, url);
  await ext.context.request.post(`${url}/auth`, {
    form: { action: "adminAuth", adminPassword: password },
    headers: { Origin: url },
    maxRedirects: 0,
  });
  await page.goto(`${url}/setup`);
  // The new Setup page takes over whenever the extension runs.
  await page.locator("#ml-shell-root .mls-top").waitFor();
  await exitTour(page);
}

export const SCREENS = "test-results/screens";

/** Foundry's toast notifications. */
export const toasts = (page: Page): Locator =>
  page.locator("#notifications .notification");
