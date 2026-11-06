// Worlds are ordered as Foundry orders them: favourites, then last played, then title; launching moves a world up.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1&worlds=12`); await p.waitForTimeout(500);
const rail = () => p.evaluate(() => [...document.querySelectorAll(".mls-world")].map((li) => `${li.querySelector("strong").textContent.trim()} (${li.querySelector(".meta").textContent.split(" · ")[1]})`));
const r = { start: await rail() };
await p.click('.mls-world[data-id="heist"]'); await p.click(".mlw-star"); await p.waitForTimeout(80);
r.heistFavourite = (await rail()).slice(0, 3);
await p.click(".mlw-star"); await p.click('.mls-world[data-id="runelords"]'); await p.click(".mls-banner .mls-launch"); await p.waitForTimeout(150);
const dlg = await p.$("[data-act=launchplain]"); if (dlg) { await dlg.click(); await p.waitForTimeout(100); }
r.afterLaunch = (await rail()).slice(0, 3);
await p.click(".mls-lib"); await p.click("[data-act=lsub][data-id=grid]"); await p.waitForTimeout(80);
r.gridCols = await p.evaluate(() => [...document.querySelectorAll(".mls-grid thead th.w .t")].slice(0, 3).map((x) => x.textContent));
const names = (l) => l.map((x) => x.replace(/ \(.*/, ""));
const ok = names(r.start)[0] === "★ Curse of Strahd".replace("★ ", "") || r.start[0].includes("Curse of Strahd");
const order = r.start.slice(1).map((x) => x.match(/\((.*)\)/)[1]);
const okAll = ok && r.heistFavourite.some((x) => x.includes("Dragon Heist")) && r.afterLaunch[1].includes("Rise of the Runelords") && names(r.gridCols).join() === names(r.afterLaunch).join();
console.log(JSON.stringify(r, null, 1), okAll ? "ok" : "WRONG"); if (!okAll) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
