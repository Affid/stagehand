// Dev aid: records the layout box of every element on the new Setup page for
// each tab of each tab row, so a markup change can be shown to move nothing.
// Usage: node scripts/dev/tab-boxes.ts <out.json>. Foundry must be on Setup.
import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const out = process.argv[2] ?? "test-results/tab-boxes.json";
const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1366, height: 768 });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#ml-shell-root");

/** Every element's box, without our tab panels themselves. */
const boxes = (p: Page): Promise<string[]> =>
  p.evaluate(() =>
    [...document.querySelectorAll("#ml-shell-root *")]
      .filter((e) => !e.classList.contains("mls-tabpanel"))
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cls = typeof e.className === "string" ? e.className : "";
        return `${e.tagName}.${cls.replace(/\s*active\s*/, "")} ${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`;
      })
      .sort(),
  );

const result: Record<string, string[]> = {};
async function tabs(name: string, row: string): Promise<void> {
  const list = root.locator(row).first();
  await list.locator('[role="tab"]').first().waitFor();
  const n = await list.locator('[role="tab"]').count();
  for (let i = 0; i < n; i++) {
    await list.locator('[role="tab"]').nth(i).click();
    await page.waitForTimeout(700);
    result[`${name}#${String(i)}`] = await boxes(page);
  }
}

await root.locator(".mls-world").first().click();
await tabs("world", ".mls-main .mls-tablist");
await root.locator(".mls-lib").click();
await tabs("library", ".mls-main .mls-tablist");
await root.getByRole("tab").first().click();
await root.locator(".mls-main button.t").first().click();
await page.waitForTimeout(500);
await tabs("panel", ".mls-panel [role=tablist]");
await root.locator(".mls-top").getByRole("button", { name: "Backups" }).click();
await tabs("backups", ".mls-main .mls-tablist");
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(Object.keys(result).join(" "));
await ext.context.close();
