// Dev aid: opens each menu and dialog of the new Setup page by keyboard,
// then Escape, and reports where focus is at each step.
// Usage: node scripts/dev/menu-keys.ts. Foundry must be running on Setup.
import type { Locator } from "@playwright/test";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import { TEST_WORLD } from "../foundry/world.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1366, height: 768 });
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#ml-shell-root");
const main = root.locator(".mls-main");

const focused = () =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body) return "body";
    const name = (e.getAttribute("aria-label") ?? e.textContent)
      .trim()
      .slice(0, 30);
    return `${e.tagName.toLowerCase()} "${name}"${e.closest("[role=dialog],.ml-pop,.mlh-menu,[role=menu]") ? " (inside)" : ""}`;
  });

async function check(name: string, trigger: Locator): Promise<void> {
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const open = await focused();
  await page.keyboard.press("Tab");
  const next = await focused();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const back = await focused();
  const ok = (await trigger.evaluate((e) => e === document.activeElement))
    ? "returns"
    : "LOST";
  console.log(`${name}: open→ ${open} | Tab→ ${next} | Esc→ ${back} [${ok}]`);
}

const snapshot = {
  worldId: TEST_WORLD.id,
  title: TEST_WORLD.title,
  system: { id: TEST_WORLD.system, version: "1" },
  coreVersion: "14.370",
  active: ["stagehand", "ml-fixture-lib"].map((id) => ({
    id,
    version: "1.0.0",
  })),
  companionVersion: "0.1.0",
  takenAt: new Date().toISOString(),
};
await ext.worker.evaluate(
  async ([k, s]) => {
    await chrome.storage.local.set({ [k]: { [s.worldId]: s } });
  },
  [`snapshots:${env.url}`, snapshot] as const,
);
await page.reload();
await root.locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
const top = root.locator(".mls-top");
await check("version menu", top.locator(".mlh-ver"));
await check(
  "power menu",
  top.getByRole("button", { name: "Log out or shut down" }),
);
await check("View options", main.getByRole("button", { name: "View options" }));
await check("Add", main.getByRole("button", { name: "Add" }));
await check(
  "group menu",
  main.getByRole("button", { name: /: actions$/ }).first(),
);
// Launch reviews only queued changes; with none it launches at once.
await main.locator('.mlw-card input[role="switch"]').first().click();
await check(
  "launch review",
  main.getByRole("button", { name: "Launch", exact: false }).first(),
);
await main.getByRole("button", { name: "Discard" }).click();
await root.locator(".mls-lib").click();
await check(
  "Import and export",
  main.getByRole("button", { name: "Import and export" }),
);
await check(
  "library group menu",
  main.getByRole("button", { name: /: actions$/ }).first(),
);
await main.getByRole("tab", { name: /By world/ }).click();
await check(
  "grid world menu",
  main.getByRole("button", { name: /: actions$/ }).first(),
);
await ext.context.close();
