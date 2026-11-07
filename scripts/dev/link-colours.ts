// Dev aid: the colour of every visible text link (`.ml-link`) on the main
// pages and its contrast against the panes behind it (tests/foundry/
// contrast.ts). Run under with-theme.ts for each Setup theme. Foundry must
// be running on Setup.
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { contrasts } from "../../tests/foundry/contrast.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#ml-shell-root");

async function links(name: string): Promise<void> {
  await page.waitForTimeout(600);
  console.log(`== ${name}`);
  for (const c of await contrasts(root.locator(".ml-link")))
    console.log(`  ${c.text} | ${c.color} | ${c.ratio.toFixed(2)}`);
}

const tab = (name: string) =>
  root.locator(".mls-main").getByRole("tab", { name: new RegExp(name) });
await root.locator(".mls-world").first().click();
await links("world modules");
await tab("About").click();
await links("world about");
await tab("Backups").click();
await links("world backups");
await root.locator(".mls-lib").click();
await tab("By world").click();
await links("library by world");
const top = root.locator(".mls-top");
await top.getByRole("button", { name: "Backups" }).click();
await links("server backups");
await top.getByRole("button", { name: "Configuration" }).click();
await links("configuration");
await ext.context.close();
