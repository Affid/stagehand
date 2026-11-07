// Dev aid: screenshots of the main views at several widths (wide screens).
import {
  openSetupAsAdmin,
  loadExtension,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const shell = page.locator("#ml-shell-root");
const out = "test-results/screens";
const box = async (sel: string) => {
  const b = await shell.locator(sel).first().boundingBox();
  return b ? `${String(Math.round(b.x))}+${String(Math.round(b.width))}` : "-";
};
for (const [w, h] of [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
] as const) {
  await page.setViewportSize({ width: w, height: h });
  await shell.locator(".mls-world").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/wide-world-${String(w)}.png` });
  const world = `rail ${await box(".mls-rail")} main ${await box(".mls-main")}`;
  await shell.locator(".mls-lib").click();
  await shell.locator(".mls-main button.t").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/wide-library-${String(w)}.png` });
  console.log(
    `${String(w)}: ${world} | library main ${await box(".mls-main")} panel ${await box(".mls-panel")}`,
  );
  await shell
    .locator(".mls-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await shell.getByRole("tab", { name: /By world/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/wide-grid-${String(w)}.png` });
  await shell.getByRole("tab", { name: /^Modules/ }).click();
}
await ext.context.close();
