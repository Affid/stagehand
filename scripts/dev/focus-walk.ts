// Dev aid: presses Tab through each page of the new Setup page and lists
// every stop that is off screen, hidden or has no visible focus indicator.
// Usage: node scripts/dev/focus-walk.ts. Foundry must be running on Setup.
import type { Page } from "@playwright/test";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1366, height: 768 });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#st-shell-root");

/** The focused element and whether focus shows on it. */
const stop = (p: Page) =>
  p.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const ring =
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none";
    const label = (
      el.getAttribute("aria-label") ??
      el.getAttribute("name") ??
      el.textContent
    )
      .trim()
      .slice(0, 40);
    // Each element once: mark it, so cards with the same labels differ.
    el.dataset.stWalk ??= String(Math.random());
    const where = `${el.tagName.toLowerCase()}[${el.getAttribute("type") ?? ""}].${el.className.slice(0, 30)} "${label}" #${el.dataset.stWalk.slice(2, 7)}`;
    const inShell = !!el.closest("#st-shell-root");
    const visible = r.width > 0 && r.height > 0;
    return { where, ring, inShell, visible };
  });

async function walk(name: string, steps = 300): Promise<void> {
  await page.mouse.move(0, 0);
  await page.locator("body").focus();
  const seen = new Set<string>();
  const bad: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    const s = await stop(page);
    if (!s) continue;
    if (seen.has(s.where)) break;
    seen.add(s.where);
    if (!s.inShell) continue;
    if (!s.visible) bad.push(`hidden: ${s.where}`);
    else if (!s.ring) bad.push(`no ring: ${s.where}`);
  }
  console.log(`\n== ${name}: ${String(seen.size)} stops`);
  for (const b of bad) console.log(`  ${b}`);
}

await root.locator(".sts-world").first().click();
await walk("world");
await root.locator(".sts-main").getByRole("tab", { name: /About/ }).click();
await walk("about");
await root.locator(".sts-lib").click();
await walk("library");
await root
  .locator(".sts-main")
  .getByRole("tab", { name: /By world/ })
  .click();
await walk("by world");
const top = root.locator(".sts-top");
await top.getByRole("button", { name: "Backups" }).click();
await walk("server backups");
await top.getByRole("button", { name: "Configuration" }).click();
await walk("configuration");
await ext.context.close();
