// Dev aid for the phone design (docs/ANDROID-APP-PLAN.md, phase 1): Foundry's
// own Setup page at phone width, as a phone shows it today, without the
// extension. Writes test-results/screens/phone-today.jpg (the whole
// page). Foundry must be running on Setup.
// Usage: node scripts/dev/phone-today.ts [width] [height]
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const [width, height] = [
  Number(process.argv[2] ?? 412),
  Number(process.argv[3] ?? 915),
];
const OUT = "test-results/screens";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
await page.goto(`${env.url}/auth`);
const status = await page.evaluate(async (password) => {
  const body = new URLSearchParams({
    action: "adminAuth",
    adminPassword: password,
  });
  return (await fetch("/auth", { method: "POST", body })).status;
}, env.adminPassword);
await page.goto(`${env.url}/setup`);
await page.waitForLoadState("load");
await page.waitForTimeout(2500);
await page.keyboard.press("Escape");
await page.screenshot({
  path: `${OUT}/phone-today.jpg`,
  fullPage: true,
  type: "jpeg",
  quality: 82,
});
console.log(`login ${String(status)}, at ${new URL(page.url()).pathname}`);
await browser.close();
