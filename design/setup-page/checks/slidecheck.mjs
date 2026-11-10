import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
const loaded = await p.evaluate(() => [...document.querySelectorAll(".str-news img")].map((i) => i.complete && i.naturalWidth > 0));
await p.click('[data-act=newsstep][data-id="1"]'); await p.waitForTimeout(150);
const mid = await p.evaluate(() => getComputedStyle(document.querySelector(".str-news .track")).transform);
await p.screenshot({ path: `${dir}out/shots/n-8-sliding.png`, clip: { x: 24, y: 760, width: 300, height: 230 } });
await p.waitForTimeout(400);
const end = await p.evaluate(() => [getComputedStyle(document.querySelector(".str-news .track")).transform, document.querySelector(".str-news .c").textContent, [...document.querySelectorAll(".str-news .banner")].map((b) => b.inert)]);
await p.screenshot({ path: `${dir}out/shots/n-9-slid.png`, clip: { x: 24, y: 760, width: 300, height: 230 } });
// a re-render keeps the slide
await p.click('.stw-card[data-id="modular-av-dock"] input'); await p.waitForTimeout(150);
const after = await p.evaluate(() => document.querySelector(".str-news .c").textContent);
console.log({ loaded, mid, end, after });
console.log(errs.length ? errs : "no errors");
await b.close();
