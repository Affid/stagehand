// Dev aid: on every page and tab of the new Setup page, lists visible
// elements that stick out past the right edge of their column (middle pane
// or panel), unless a scrolling box holds them. Foundry must be on Setup.
// Usage: node scripts/dev/overflow-scan.ts [width] [height]
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const width = Number(process.argv[2] ?? 1280);
const height = Number(process.argv[3] ?? 800);
const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width, height });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#st-shell-root");
const main = root.locator(".sts-main");

async function scan(name: string): Promise<void> {
  await page.waitForTimeout(600);
  const out = await page.evaluate(() => {
    const cols = [...document.querySelectorAll(".sts-main, .sts-panel")];
    const bad: string[] = [];
    for (const col of cols) {
      const edge = col.getBoundingClientRect().right;
      for (const el of col.querySelectorAll<HTMLElement>("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= edge + 1) continue;
        // Inside a box that scrolls or clips sideways: by design.
        let p = el.parentElement;
        let held = false;
        while (p && p !== col) {
          const o = getComputedStyle(p).overflowX;
          if (o !== "visible") {
            held = true;
            break;
          }
          p = p.parentElement;
        }
        if (held) continue;
        const label = (el.getAttribute("aria-label") ?? el.textContent)
          .trim()
          .slice(0, 30);
        bad.push(
          `${el.tagName.toLowerCase()}.${el.className.slice(0, 30)} "${label}" +${String(Math.round(r.right - edge))}px`,
        );
      }
    }
    return bad.slice(0, 8);
  });
  console.log(`${name}: ${out.length ? `\n  ${out.join("\n  ")}` : "ok"}`);
}

const tab = (re: RegExp) => main.getByRole("tab", { name: re }).click();
await root.locator(".sts-world").first().click();
await scan("world modules");
await tab(/About/);
await scan("world about");
await tab(/Backups/);
await scan("world backups");
await root.locator(".sts-lib").click();
await scan("library");
await main.locator("button.t").first().click();
await scan("library + details");
await root
  .locator(".sts-panel")
  .getByRole("tab", { name: /Package/ })
  .click();
await scan("library + package tab");
await tab(/Systems/);
await scan("systems");
await tab(/By world/);
await scan("by world");
const top = root.locator(".sts-top");
await top.getByRole("button", { name: "Backups" }).click();
await scan("server backups");
await top.getByRole("button", { name: "Configuration" }).click();
await scan("configuration");
await top.locator(".sth-ver").click();
await root
  .getByRole("button", { name: /what's new|Update page/i })
  .first()
  .click();
await scan("update");
await ext.context.close();
