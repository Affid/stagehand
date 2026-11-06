// The By world grid's Show filter: favourites, recently played, with changes or problems, chosen worlds.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1&worlds=12`); await p.waitForTimeout(500);
await p.click(".mls-lib"); await p.click("[data-act=lsub][data-id=grid]"); await p.waitForTimeout(100);
const cols = () => p.evaluate(() => [...document.querySelectorAll(".mls-grid thead th.w .t")].map((x) => x.textContent));
const showing = () => p.evaluate(() => document.querySelector(".mls-showing")?.innerText);
const r = {};
for (const k of ["fav", "recent", "attention"]) { await p.selectOption('[data-change="gridshow"]', k); await p.waitForTimeout(80); r[k] = { cols: await cols(), showing: await showing() }; }
await p.selectOption('[data-change="gridshow"]', "pick"); await p.waitForTimeout(80);
r.pickStart = await cols();
await p.click("[data-act=gridpick]"); await p.waitForTimeout(60);
await p.click('.ml-pop [data-act=gridpicktoggle][data-id="deadlands"]'); await p.waitForTimeout(60);
r.pickAfter = { cols: await cols(), popOpen: !!(await p.$(".ml-pop")) };
await p.screenshot({ path: `${dir}out/shots/grid-show-pick.png` });
await p.click(".ml-pop [data-act=gridpicknone]"); await p.keyboard.press("Escape"); await p.waitForTimeout(60);
r.empty = await p.evaluate(() => document.querySelector(".mlw-empty h3")?.textContent);
await p.click("[data-act=gridshowall]"); await p.waitForTimeout(60);
r.all = (await cols()).length;
// A queued change in a hidden world is still visible as a link.
await p.selectOption('[data-change="gridshow"]', "fav"); await p.waitForTimeout(60);
await p.click(".mls-gridwrap td input[data-act=gcell]"); await p.waitForTimeout(60);
await p.selectOption('[data-change="gridshow"]', "pick"); await p.click("[data-act=gridpick]"); await p.click(".ml-pop [data-act=gridpicknone]"); await p.click('.ml-pop [data-act=gridpicktoggle][data-id="heist"]'); await p.keyboard.press("Escape"); await p.waitForTimeout(80);
r.hiddenChanges = await showing();
const ok = r.fav.cols.join() === "Curse of Strahd" && r.recent.cols.length > 0 && r.recent.cols.length < 12 && r.attention.cols.length >= 1 && r.pickAfter.cols.includes("Deadlands: The Weird West") && r.pickAfter.popOpen && r.empty === "No worlds to show" && r.all === 12 && /hidden world/.test(r.hiddenChanges);
console.log(JSON.stringify(r, null, 1), ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
