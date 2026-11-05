// Loads the built extension into Playwright's Chromium.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BrowserContext,
  chromium,
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
 * page's permission request resolves without Chrome's (native) prompt.
 */
function prepareCopy(): string {
  rmSync(UNDER_TEST, { recursive: true, force: true });
  cpSync(DIST, UNDER_TEST, { recursive: true });
  const path = join(UNDER_TEST, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as object;
  writeFileSync(
    path,
    JSON.stringify({ ...manifest, host_permissions: ["http://localhost/*"] }),
  );
  return UNDER_TEST;
}

export async function loadExtension(): Promise<LoadedExtension> {
  const dir = prepareCopy();
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    viewport: { width: 1600, height: 1000 },
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
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
  await page.goto(`${url}/join`);
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

/** Registers the server on the options page and opens Setup as admin. */
export async function openSetupAsAdmin(
  ext: LoadedExtension,
  page: Page,
  url: string,
  password: string,
): Promise<void> {
  await page.goto(`chrome-extension://${ext.id}/options.html`);
  await page.locator("#server-url").fill(`${url}/`);
  await page.locator("#add-server button").click();
  await page.locator("#status").filter({ hasText: "Registered" }).waitFor();
  await ext.context.request.post(`${url}/auth`, {
    form: { action: "adminAuth", adminPassword: password },
    headers: { Origin: url },
    maxRedirects: 0,
  });
  await page.goto(`${url}/setup`);
  await page.locator("#ml-worlds-root .ml-worlds").waitFor();
  await exitTour(page);
}

export const SCREENS = "test-results/screens";
