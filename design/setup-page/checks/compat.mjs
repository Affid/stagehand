// The Your packages tab follows Foundry's preview: newest versions, four statuses, dependencies, Systems first.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(500);
await p.click(".sth-ver"); await p.click(".st-pop [data-act=updpage]"); await p.click(".stu-tabs [data-act=updview][data-id=compat]"); await p.waitForTimeout(100);
const read = () => p.evaluate(() => ({ tabs: [...document.querySelectorAll(".stu-compat .sts-subtabs a")].map((a) => a.textContent.replace(/\s+/g, " ").trim()), sum: [...document.querySelectorAll(".stu-chips a")].map((a) => a.textContent.trim()).join(" · "), sumRows: document.querySelectorAll(".stu-sum").length, rows: [...document.querySelectorAll(".stu-clist li")].map((l) => l.innerText.replace(/\s+/g, " ").slice(0, 150)) }));
const r = { systems14: await read() };
await p.click("[data-act=updccat][data-id=module]"); await p.waitForTimeout(60); r.modules14 = (await read()).rows.slice(0, 5);
await p.screenshot({ path: `${dir}out/shots/upd-10-compat14.png` });
await p.click("[data-act=updstate][data-id=manual]"); await p.waitForTimeout(80); r.modules15 = (await read()).rows.slice(0, 5); r.sum15 = (await read()).sum;
await p.screenshot({ path: `${dir}out/shots/upd-11-compat15.png` });
await p.click("[data-act=updccat][data-id=world]"); await p.waitForTimeout(60); r.worlds15 = (await read()).rows.slice(0, 3);
// The chips are the totals and the filters, on one line even at 1280 wide.
await p.setViewportSize({ width: 1280, height: 900 }); await p.click("[data-act=updccat][data-id=module]"); await p.waitForTimeout(100);
r.chipLines1280 = await p.evaluate(() => new Set([...document.querySelectorAll(".stu-chips a")].map((a) => Math.round(a.getBoundingClientRect().top))).size);
r.duplicateTotals = await p.evaluate(() => document.querySelectorAll(".stu-sum").length);
const ok = r.chipLines1280 === 1 && r.duplicateTotals === 0 && r.systems14.tabs[0].startsWith("Systems") && r.modules15.some((x) => /Missing|Needs Stagehand Fixture: library/.test(x)) && r.modules14.some((x) => /→/.test(x)) && /risk 17/i.test(r.sum15);
console.log(JSON.stringify(r, null, 1), ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
