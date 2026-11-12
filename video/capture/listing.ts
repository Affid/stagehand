// Captures the screens of the companion's foundryvtt.com GIF (video/src/
// listing), off the demo server, each reached by the real clicks: the
// Library by folder and by tag, a module's panel, the server's own pages,
// a world (all modules, then only those on), a queued change, the launch
// review, and the world after the companion applied it. The world really
// launches and the change really applies; the world is shut down at the
// end. Run scripts/demo/setup-demo.ts before (it resets the worlds' modules)
// and after, and video/capture/listing-backups.ts once before the first run.
//   FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
//     node video/capture/listing.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { joinWorld } from "../../tests/foundry/extension.ts";
import { env, openStagehand } from "./browser.ts";
import { libraryShots, serverPages } from "./listing-library.ts";
import { worldShots } from "./listing-world.ts";
import type { Rect } from "./rects.ts";
import { rectOf } from "./rects.ts";
import { OUT, shootPage } from "./shots.ts";
import { shutdown } from "./shutdown.ts";

const SCALE = 2;

/** Foundry asks for at least 1024 x 768 in a world, or it warns. */
const WORLD_VIEWPORT = { width: 1280, height: 800 } as const;

/**
 * Other modules' popups (Levels' migration notes) and Foundry's notices
 * stay out: only windows with a frame close, never the sidebar or bars.
 */
async function clearScreen(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      ui: {
        windows: Record<string, { close: () => Promise<unknown> }>;
        notifications: { clear?: () => void };
      };
      foundry: {
        applications: {
          instances: Map<
            string,
            { hasFrame?: boolean; close: () => Promise<unknown> }
          >;
        };
      };
    };
    for (const app of Object.values(g.ui.windows)) await app.close();
    for (const app of g.foundry.applications.instances.values())
      if (app.hasFrame) await app.close();
    g.ui.notifications.clear?.();
    document.querySelector("#notifications")?.replaceChildren();
  });
  await page.waitForTimeout(800);
}

/** In the world: the companion's own notice for a reviewed launch. */
async function inWorld(page: Page): Promise<Record<string, Rect>> {
  await page.setViewportSize(WORLD_VIEWPORT);
  await page.waitForURL(/\/(join|game)$/, { timeout: 120_000 });
  if (page.url().endsWith("/join"))
    await joinWorld(page, env.url, "Gamemaster");
  // The companion applies, says so, and reloads once: wait for the reload.
  await page.waitForEvent("load", { timeout: 60_000 });
  await page.waitForFunction(
    () => (globalThis as { game?: { ready?: boolean } }).game?.ready === true,
    null,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(2500);
  await clearScreen(page);
  // The notice went with the reload; show it again, as it was, to take it.
  await page.evaluate(() => {
    const g = globalThis as unknown as {
      game: { i18n: { localize: (k: string) => string } };
      ui: { notifications: { info: (m: string, o?: object) => void } };
    };
    g.ui.notifications.info(g.game.i18n.localize("STAGEHAND.Apply.Reviewed"), {
      permanent: true,
    });
  });
  const notice = page.locator("#notifications .notification").last();
  await notice.waitFor();
  await page.waitForTimeout(800);
  await shootPage(page, "listing/in-world.png");
  return { notice: await rectOf(notice) };
}

const { page, context, close } = await openStagehand(SCALE);
await context.addInitScript(() => {
  localStorage.setItem("core.noCanvas", "true");
});
try {
  const library = await libraryShots(page);
  const server = await serverPages(page);
  const world = await worldShots(page);
  const game = await inWorld(page);
  await shutdown();
  writeFileSync(
    join(OUT, "listing.json"),
    `${JSON.stringify({ scale: SCALE, library, server, world, game }, null, 1)}\n`,
  );
  console.log("Captured the listing's screens.");
} finally {
  await close();
}
