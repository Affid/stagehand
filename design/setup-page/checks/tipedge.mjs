import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch();
for (const w of [1600, 1280]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(700);
  await p.click("[data-act=wtab][data-id=backups]"); await p.hover(".mlw-blist .nodel", { force: true }); await p.waitForTimeout(800);
  const r = await p.evaluate(() => { const t = document.getElementById("tooltip").getBoundingClientRect(); return { left: Math.round(t.left), right: Math.round(t.right), top: Math.round(t.top), vw: innerWidth }; });
  if (w === 1600) await p.screenshot({ path: `${dir}out/shots/t-tip-full.png`, clip: { x: 1000, y: r.top - 20, width: 600, height: 160 } });
  console.log(w, r, r.right <= r.vw && r.left >= 0 ? "inside" : "CLIPPED");
}
await b.close();
