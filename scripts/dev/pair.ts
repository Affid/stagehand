// Dev aid: puts each prototype screenshot beside the build's (from
// layout-compare.ts) in one image. Usage: node scripts/dev/pair.ts [dir]
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const dir = resolve(process.argv[2] ?? "test-results/layout");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2000, height: 700 } });
for (const f of readdirSync(dir).filter((x) => x.endsWith("-proto.png"))) {
  const name = f.replace("-proto.png", "");
  // A blank page can't load local files: inline them.
  const src = (kind: string): string =>
    `data:image/png;base64,${readFileSync(`${dir}/${name}-${kind}.png`).toString("base64")}`;
  await p.setContent(`<body style="margin:0;background:#222;display:flex;gap:8px;align-items:flex-start">
    <img src="${src("proto")}" style="width:996px">
    <img src="${src("build")}" style="width:996px"></body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/pair-${name}.png`, fullPage: true });
}
await b.close();
