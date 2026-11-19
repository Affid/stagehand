// Captures the screens of the companion's second foundryvtt.com GIF, the
// library view inside a world (video/src/listing/world-script.ts), off the
// demo server by the real clicks: the settings sidebar's Manage Modules,
// Token Magic FX's folder, its panel, the switch, the review, and the
// window again after Save & Reload. The change really saves: run
// scripts/demo/setup-demo.ts after (it resets the worlds' modules). The
// world is shut down at the end.
//   FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
//     node video/capture/listing-in-world.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
} from "../../scripts/foundry/admin.ts";
import { joinAs } from "../../scripts/foundry/session.ts";
import { env, VIEWPORT } from "./browser.ts";
import { reviewAndSave, viewShots } from "./listing-in-world-view.ts";
import { type Rect, rectOf } from "./rects.ts";
import { OUT, shootPage } from "./shots.ts";
import { shutdown } from "./shutdown.ts";

const SCALE = 2;
/** No modules or library are needed beyond what the demo already has. */
const WORLD = "clockwork-heist";

/** Foundry's notices (its small-window warning among them) stay out. */
const HIDE = "#notifications { display: none !important; }";

/** Other modules' popups close; the sidebar and bars stay. */
async function clearScreen(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry: {
        applications: {
          instances: Map<
            string,
            { hasFrame?: boolean; close: () => Promise<unknown> }
          >;
        };
      };
    };
    for (const app of g.foundry.applications.instances.values())
      if (app.hasFrame) await app.close();
  });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

/** The settings sidebar, open, with its Manage Modules button. */
async function settingsShot(page: Page): Promise<Record<string, Rect>> {
  await page.locator('#sidebar-tabs [data-tab="settings"]').click();
  const manage = page.locator('#settings button[data-app="modules"]');
  await manage.waitFor();
  await page.waitForTimeout(800);
  await shootPage(page, "listing-world/settings.png");
  return { manage: await rectOf(manage) };
}

async function launch(): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    await launchWorld(api, WORLD);
  } finally {
    await api.dispose();
  }
}

await launch();
const browser = await chromium.launch();
try {
  const page = await joinAs(browser, env.url, "Gamemaster", {
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
  });
  await clearScreen(page);
  const settings = await settingsShot(page);
  const view = await viewShots(page);
  const after = await reviewAndSave(page, () => clearScreen(page));
  writeFileSync(
    join(OUT, "listing-world.json"),
    `${JSON.stringify({ scale: SCALE, settings, view, after }, null, 1)}\n`,
  );
  console.log("Captured the in-world listing screens.");
} finally {
  await browser.close();
  await shutdown();
}
