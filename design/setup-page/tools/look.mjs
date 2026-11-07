import { chromium } from "@playwright/test";
// Screenshot the built mockup at a given size, after clicking the given selectors in turn.
// Usage: node tools/look.mjs <width> <height> [query] [name] [selector...]  -> out/shots/<name>.png
const dir = new URL("../", import.meta.url).pathname;
const OUT = process.env.SHOTS ?? `${dir}out/shots/`;
const [w, h, q, name] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4] ?? "calm=1", process.argv[5] ?? "shot"];
const b = await chromium.launch(); const errs = [];
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?${q}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(900);
for (const sel of process.argv.slice(6)) { await p.evaluate((s) => document.querySelector(s)?.click(), sel); await p.waitForTimeout(250); }
await p.screenshot({ path: `${OUT}${name}.png` });
console.log(errs.length ? errs : "ok");
await b.close();
