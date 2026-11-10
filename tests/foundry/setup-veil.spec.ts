// No jump from Foundry's Setup to ours (owner, 2026-11-07): Foundry's own
// Setup UI stays out of sight from the first paint until the new page takes
// over, comes back at once when the new page gives up, and by itself if the
// extension's script never starts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
const CSS = join(
  import.meta.dirname,
  "..",
  "..",
  "packages",
  "extension",
  "dist",
  "setup-ui.css",
);
/** Foundry's Setup pieces the new page hides (page/shell.ts DEFAULT_SHELL). */
const FOUNDRY = ["#setup", "#setup-menu", "#main-header", "#watermark"];
/** The CSS failsafe: Foundry's page shows by itself after this long. */
const FAILSAFE_MS = 4000;

let ext: Target;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
});

interface Watch {
  readonly shownFrames: number;
  readonly shellOnAt: number | null;
}

test("Foundry's own Setup is never seen before the new page takes over", async () => {
  const watcher = await ext.context.newPage();
  await watcher.addInitScript((sel: readonly string[]) => {
    const w = window as unknown as { stWatch: Watch };
    w.stWatch = { shownFrames: 0, shellOnAt: null };
    const seen = (e: Element): boolean => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        Number(cs.opacity) > 0 &&
        r.width > 0 &&
        r.height > 0
      );
    };
    const frame = (): void => {
      // No body yet at the very start of the load.
      const body = document.body as HTMLElement | null;
      const on = body?.classList.contains("st-shell-on") ?? false;
      if (on && w.stWatch.shellOnAt === null)
        w.stWatch = { ...w.stWatch, shellOnAt: performance.now() };
      const shown = sel.some((s) => {
        const e = document.querySelector(s);
        return e !== null && seen(e);
      });
      if (shown)
        w.stWatch = { ...w.stWatch, shownFrames: w.stWatch.shownFrames + 1 };
      if (performance.now() < 15_000) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, FOUNDRY);
  await watcher.goto(`${env.url}/setup`);
  await watcher.locator("#st-shell-root .sts-top").waitFor();
  const watch = await watcher.evaluate(
    () => (window as unknown as { stWatch: Watch }).stWatch,
  );
  test.info().annotations.push({
    type: "took over",
    description: `${String(Math.round(watch.shellOnAt ?? 0))} ms after the load began`,
  });
  expect(watch.shownFrames).toBe(0);
  expect(watch.shellOnAt).not.toBeNull();
  expect(watch.shellOnAt ?? Infinity).toBeLessThan(FAILSAFE_MS);
  await watcher.close();
});

/** A bare page with the new page's stylesheet and Foundry's Setup pieces. */
async function bare(htmlClass: string): Promise<void> {
  await page.setContent(
    `<html class="${htmlClass}"><head><style>${readFileSync(CSS, "utf8")}</style></head>
     <body class="setup">${FOUNDRY.map((s) => `<div id="${s.slice(1)}">Foundry</div>`).join("")}</body></html>`,
  );
}

const visibility = (): Promise<string> =>
  page.locator("#setup").evaluate((e) => getComputedStyle(e).visibility);

test("if the new page gives up, Foundry's comes back at once", async () => {
  await bare("st-shell-off");
  expect(await visibility()).toBe("visible");
});

test("if the extension's script never starts, Foundry's page shows by itself", async () => {
  await bare("");
  expect(await visibility()).toBe("hidden");
  await expect
    .poll(visibility, { timeout: FAILSAFE_MS + 3000 })
    .toBe("visible");
});

test("while the early script waits, the CSS alone doesn't show Foundry's page", async () => {
  await bare("st-shell-wait");
  await page.waitForTimeout(FAILSAFE_MS + 500);
  expect(await visibility()).toBe("hidden");
});
