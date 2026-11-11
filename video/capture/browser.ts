// Opens the demo server's Setup for capturing: Foundry's own page in a plain
// Chromium, or Stagehand's in a Chromium with the built extension loaded, at
// a given size and pixel density.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, chromium, type Page } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  exitTour,
  type LoadedExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const DIST = join(ROOT, "packages", "extension", "dist");
const COPY = join(ROOT, "test-results", "extension-for-video");

export const VIEWPORT = { width: 1280, height: 720 } as const;
export const env = loadFoundryEnv();

/** Foundry's notices and the advert Foundry picks stay out of every capture. */
const HIDE = "#notifications, .str-feat { display: none !important; }";

export interface Opened {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly close: () => Promise<void>;
}

async function settle(page: Page): Promise<void> {
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

/** Foundry's own Setup, as administrator, with no extension. */
export async function openStock(scale: number): Promise<Opened> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  await context.request.post(`${env.url}/auth`, {
    form: { action: "adminAuth", adminPassword: env.adminPassword },
    headers: { Origin: env.url },
    maxRedirects: 0,
  });
  await page.goto(`${env.url}/setup`);
  await page.locator("#setup-packages").waitFor();
  await page.waitForTimeout(2500);
  await exitTour(page).catch(() => undefined);
  await settle(page);
  return { page, context, close: () => browser.close() };
}

/** The built extension, granted localhost as the live suites grant it. */
function extensionCopy(): string {
  rmSync(COPY, { recursive: true, force: true });
  cpSync(DIST, COPY, { recursive: true });
  const path = join(COPY, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as object;
  writeFileSync(
    path,
    JSON.stringify({ ...manifest, host_permissions: ["http://localhost/*"] }),
  );
  return COPY;
}

/** Stagehand's Setup on the same server, as administrator. */
export async function openStagehand(scale: number): Promise<Opened> {
  const dir = extensionCopy();
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const ext: LoadedExtension = {
    context,
    worker,
    id: new URL(worker.url()).host,
  };
  const page = await context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await page.setViewportSize(VIEWPORT);
  await settle(page);
  return { page, context, close: () => context.close() };
}

export { settle };
