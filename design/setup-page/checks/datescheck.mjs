import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: "Europe/Luxembourg", locale: "en-GB" })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(800);
const box = async () => p.evaluate(() => { const r = document.querySelector(".mlw-sess").getBoundingClientRect(); return { x: Math.round(r.x) - 4, y: Math.round(r.y) - 4, width: Math.round(r.width) + 8, height: Math.round(r.height) + 8 }; });
const txt = () => p.evaluate(() => document.querySelector(".mlw-sess").innerText.replace(/\s+/g, " ").slice(0, 330));
// Dragon Heist: custom dates
await p.click('.mls-world[data-id="heist"]'); await p.click('[data-act=wtab][data-id=about]'); await p.waitForTimeout(150);
const heist = await txt(); await p.screenshot({ path: `${dir}out/shots/s-5-dates-view.png`, clip: await box() });
await p.click("[data-act=sedit]"); await p.waitForTimeout(150);
await p.click('[data-act=sday][data-id="2026-11-21"]'); await p.waitForTimeout(80);
await p.fill('[data-sdate="2026-11-27"]', "20:15"); await p.press('[data-sdate="2026-11-27"]', "Tab"); await p.waitForTimeout(100);
const quick = await p.evaluate(() => [...document.querySelectorAll(".mlw-sched .chips button")].map((b) => b.textContent + (b.dataset.tooltip ? "*" : "")));
const tzOpts = await p.evaluate(() => [...document.querySelectorAll("select[data-sched=tz] option")].map((o) => o.textContent));
await p.screenshot({ path: `${dir}out/shots/s-6-dates-editor.png`, clip: await box() });
await p.click("[data-act=tzfind]"); await p.keyboard.type("a"); await p.waitForTimeout(60);
const allZones = await p.evaluate(() => document.querySelectorAll("#tzlist li").length); await p.keyboard.press("Escape"); await p.waitForTimeout(60);
await p.selectOption("select[data-sched=tz]", "Europe/Berlin"); await p.waitForTimeout(80);
await p.click("[data-act=ssave]"); await p.waitForTimeout(150);
const saved = await txt();
// Strahd: switch a weekly rule to chosen dates, seeded from the rule
await p.click('.mls-world[data-id="strahd"]'); await p.click('[data-act=wtab][data-id=about]'); await p.click("[data-act=sedit]"); await p.waitForTimeout(100);
await p.selectOption("select[data-sched=freq]", "dates"); await p.waitForTimeout(120);
const seeded = await p.evaluate(() => [...document.querySelectorAll(".mlw-chosen li .d")].map((x) => x.textContent));
await p.screenshot({ path: `${dir}out/shots/s-7-seeded.png`, clip: await box() });
console.log({ heist, quick, tzOpts, allZones, saved, seeded }); console.log(errs.length ? errs : "no errors");
await b.close();
