// Dev aid: opens Setup with the built extension and saves screenshots of
// both tabs to test-results/screens/. Foundry must be running on Setup.
import { exitTour, loadExtension } from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log(`[page error] ${m.text()}`);
});
await page.goto(`chrome-extension://${ext.id}/options.html`);
await page.locator("#server-url").fill(env.url);
await page.locator("#add-server button").click();
await page.locator("#status").filter({ hasText: "Registered" }).waitFor();
await ext.context.request.post(`${env.url}/auth`, {
  form: { action: "adminAuth", adminPassword: env.adminPassword },
  headers: { Origin: env.url },
  maxRedirects: 0,
});
await page.goto(`${env.url}/setup`);
await page.locator("#ml-worlds-root .ml-worlds").waitFor();
await exitTour(page);
await page.screenshot({ path: "test-results/screens/worlds.png" });
await page.locator('[data-tab="modules"]').first().click();
await page.locator("#ml-modules-root .ml-modules").waitFor();
await page.screenshot({ path: "test-results/screens/modules.png" });
await ext.context.close();
