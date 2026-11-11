// The Android app on a device (the emulator): installed fresh, the demo
// server added on its home screen, logged in, then its worlds, its Library
// and one world's page, each as the device's own screenshot. Run with the
// device suite's settings (tests/android), the demo server as the device
// reaches it:
//   ST_APP_SERVER=http://10.0.2.2:30015 FOUNDRY_PORT=30015 \
//     FOUNDRY_DATA_DIR=~/foundry/data-demo node video/capture/phone.ts
// Needs the debug APK (node scripts/android/gradle.ts assembleDebug, after
// packages/extension: pnpm build:release).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { App, installFresh } from "../../tests/android/app.ts";
import { addServer, shell, tab } from "../../tests/android/steps.ts";
import { OUT } from "./shots.ts";
import { WORLD } from "./stagehand.ts";

const DIR = join(OUT, "phone");
/** Foundry's notices and the advert Foundry picks stay out, as elsewhere. */
const HIDE = "#notifications, .str-feat { display: none !important; }";

const app = new App();

async function shoot(name: string): Promise<void> {
  await new Promise((done) => setTimeout(done, 1500));
  const device = await app.connect();
  await device.screenshot({ path: join(DIR, `${name}.png`) });
}

async function openLibrary(page: Page): Promise<void> {
  await tab(page, /^Library/).click();
  await shell(page).locator(".stl-card").first().waitFor();
}

async function openWorld(page: Page): Promise<void> {
  await tab(page, /^Worlds|^Home|^Game Worlds/)
    .click()
    .catch(() => undefined);
  await shell(page).locator(`.sts-world[data-world="${WORLD}"]`).click();
  await shell(page).locator(".sts-banner").waitFor();
}

mkdirSync(DIR, { recursive: true });
installFresh();
try {
  const page = await addServer(app);
  await page.addStyleTag({ content: HIDE });
  console.log("Stagehand's Setup is up in the app.");
  await shoot("worlds");
  await openLibrary(page);
  await shoot("library");
  await openWorld(page);
  await shoot("world");
} finally {
  await app.close();
}
