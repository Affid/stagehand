// Dev aid: runs axe-core (WCAG 2.2 A and AA) over each page of the new Setup
// page and prints the violations. Foundry must be running on Setup.
// Usage: node scripts/dev/axe-scan.ts [width] [height]
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const width = Number(process.argv[2] ?? 1366);
const height = Number(process.argv[3] ?? 768);
const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width, height });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#st-shell-root");

async function scan(name: string, p: Page): Promise<void> {
  // No hover state: the scan is of the page at rest.
  await p.mouse.move(0, 0);
  await p.waitForTimeout(800);
  const r = await new AxeBuilder({ page: p })
    .include("#st-shell-root")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  console.log(`\n== ${name}: ${String(r.violations.length)} rules`);
  for (const v of r.violations) {
    console.log(
      `  [${v.impact ?? "?"}] ${v.id}: ${v.help} (${String(v.nodes.length)})`,
    );
    for (const n of v.nodes.slice(0, 6))
      console.log(
        `     ${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1, 3).join(" | ") ?? ""}`,
      );
  }
}

const tab = (name: string) =>
  root.locator(".sts-main").getByRole("tab", { name: new RegExp(name) });
await root.locator(".sts-world").first().click();
await scan("world modules", page);
await tab("About").click();
await scan("world about", page);
await tab("Backups").click();
await scan("world backups", page);
await root.locator(".sts-lib").click();
await scan("library modules", page);
await root.locator(".sts-main button.t").first().click();
await scan("module panel library", page);
await root
  .locator(".sts-panel")
  .getByRole("tab", { name: /Package/ })
  .click();
await scan("module panel package", page);
await tab("Systems").click();
await scan("library systems", page);
await tab("By world").click();
await scan("library by world", page);
const top = root.locator(".sts-top");
await top.getByRole("button", { name: "Backups" }).click();
await scan("server backups", page);
await top.getByRole("button", { name: "Configuration" }).click();
await scan("configuration", page);
await top.locator(".sth-ver").click();
await scan("version menu", page);
await page.keyboard.press("Escape");
await ext.context.close();
