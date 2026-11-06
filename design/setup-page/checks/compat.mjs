// The Your packages tab follows Foundry's preview: newest versions, four statuses, dependencies, Systems first.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(500);
await p.click(".mlh-ver"); await p.click(".ml-pop [data-act=updpage]"); await p.click(".mlu-tabs [data-act=updview][data-id=compat]"); await p.waitForTimeout(100);
const read = () => p.evaluate(() => ({ tabs: [...document.querySelectorAll(".mlu-compat .mls-subtabs a")].map((a) => a.textContent.replace(/\s+/g, " ").trim()), sum: document.querySelector(".mlu-sum")?.innerText.replace(/\s+/g, " "), rows: [...document.querySelectorAll(".mlu-clist li")].map((l) => l.innerText.replace(/\s+/g, " ").slice(0, 150)) }));
const r = { systems14: await read() };
await p.click("[data-act=updccat][data-id=module]"); await p.waitForTimeout(60); r.modules14 = (await read()).rows.slice(0, 5);
await p.screenshot({ path: `${dir}out/shots/upd-10-compat14.png` });
await p.click("[data-act=updstate][data-id=manual]"); await p.waitForTimeout(80); r.modules15 = (await read()).rows.slice(0, 5); r.sum15 = (await read()).sum;
await p.screenshot({ path: `${dir}out/shots/upd-11-compat15.png` });
await p.click("[data-act=updccat][data-id=world]"); await p.waitForTimeout(60); r.worlds15 = (await read()).rows.slice(0, 3);
const ok = r.systems14.tabs[0].startsWith("Systems") && r.modules15.some((x) => /Missing|Needs ML Fixture: library/.test(x)) && r.modules14.some((x) => /→/.test(x)) && /risk/i.test(r.sum15);
console.log(JSON.stringify(r, null, 1), ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
