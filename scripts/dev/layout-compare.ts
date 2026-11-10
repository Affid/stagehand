// Dev aid: measures the main columns of the prototype (design/setup-page)
// and of the build on Foundry, page by page, at 2560, 1366 and 1280 wide,
// and saves screenshots side by side for the eye. Foundry must be on Setup
// and the prototype built (node design/setup-page/build.mjs).
// Usage: node scripts/dev/layout-compare.ts [out-dir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const OUT = process.argv[2] ?? "test-results/layout";
mkdirSync(OUT, { recursive: true });
const SIZES = [
  [2560, 1440],
  [1366, 768],
  [1280, 800],
] as const;
const PROTO = `file://${join(import.meta.dirname, "../../design/setup-page/out/setup-shell.html")}?calm=1`;
const PAGES = {
  world: "&page=world",
  library: "&page=library&panel=modular-av",
  backups: "&page=backups",
  config: "&page=config",
} as const;
type PageName = keyof typeof PAGES;

const boxes = (p: Page) =>
  p.evaluate(() =>
    [".sts-top", ".sts-rail", ".sts-main", ".sts-panel"]
      .map((sel) => {
        const e = document.querySelector(sel);
        if (!e) return `${sel}: -`;
        const r = e.getBoundingClientRect();
        const pos = getComputedStyle(e).position;
        return `${sel}: x=${String(Math.round(r.x))} w=${String(Math.round(r.width))} y=${String(Math.round(r.y))} h=${String(Math.round(r.height))}${pos === "fixed" || pos === "absolute" ? ` (${pos})` : ""}`;
      })
      .join(" | "),
  );

async function proto(name: PageName, w: number, h: number): Promise<string> {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${PROTO}${PAGES[name]}`);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${name}-${String(w)}-proto.png` });
  const r = await boxes(p);
  await b.close();
  return r;
}

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const root = page.locator("#st-shell-root");
const top = root.locator(".sts-top");
const go: Record<PageName, () => Promise<void>> = {
  world: () => root.locator(".sts-world").first().click(),
  library: async () => {
    await root.locator(".sts-lib").click();
    await root.locator(".sts-main button.t").first().click();
  },
  backups: () => top.getByRole("button", { name: "Backups" }).click(),
  config: () => top.getByRole("button", { name: "Configuration" }).click(),
};

for (const [w, h] of SIZES) {
  await page.setViewportSize({ width: w, height: h });
  for (const name of Object.keys(PAGES) as PageName[]) {
    await go[name]();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}-${String(w)}-build.png` });
    console.log(`\n${name} ${String(w)}x${String(h)}`);
    console.log(`  proto: ${await proto(name, w, h)}`);
    console.log(`  build: ${await boxes(page)}`);
  }
}
await ext.context.close();
