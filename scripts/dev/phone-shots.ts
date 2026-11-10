// Dev aid (Android plan, phase 3): the new Setup page in the app harness at
// the phone sizes, screenshots of each tab and a world to
// test-results/screens/phone/<device>-<screen>.png. Needs `pnpm build`
// (dist-app) and Foundry at Setup. Usage:
//   node scripts/dev/phone-shots.ts [device ...]
// with devices from tests/app/harness.ts (default: all phone sizes).
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  type Device,
  launchApp,
  openAppSetupAsAdmin,
  PHONE_SIZES,
} from "../../tests/app/harness.ts";
import { exitTour } from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const OUT = "test-results/screens/phone";
const env = loadFoundryEnv();
const asked = process.argv.slice(2) as Device[];
const devices = asked.length ? asked : PHONE_SIZES;
mkdirSync(OUT, { recursive: true });

const shell = (page: Page) => page.locator("#st-shell-root");

async function tab(page: Page, name: string): Promise<void> {
  await shell(page)
    .locator(".stp-tabs")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await page.waitForTimeout(400);
}

async function shots(device: Device): Promise<void> {
  const app = await launchApp({ device });
  try {
    const page = await app.context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") console.log(`[${device}] ${m.text()}`);
    });
    await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
    await exitTour(page);
    await page.waitForTimeout(600);
    const snap = (name: string) =>
      page.screenshot({ path: `${OUT}/${device}-${name}.png` });
    await snap("home");
    await shell(page).locator(".sts-world").first().click();
    await page.waitForTimeout(400);
    await snap("world");
    for (const [name, file] of [
      ["Library", "library"],
      ["Backups", "backups"],
      ["Configuration", "config"],
    ] as const) {
      await tab(page, name);
      await snap(file);
    }
    console.log(`${device}: done`);
  } finally {
    await app.close();
  }
}

for (const d of devices) await shots(d);
