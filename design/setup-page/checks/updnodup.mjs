// The package summary on the right shows beside the notes and the history, not beside the full package list.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(500);
await p.click(".sth-ver"); await p.click(".st-pop [data-act=updpage]"); await p.waitForTimeout(100);
const state = () => p.evaluate(() => ({ summary: !!document.querySelector(".stu-side .stu-tags"), goTop: Math.round(document.querySelector(".stu-go")?.getBoundingClientRect().top ?? -1) }));
const r = { notes: await state() };
await p.click(".stu-side [data-act=updview][data-id=compat]"); await p.waitForTimeout(80); r.compat = await state();
await p.click(".stu-tabs [data-act=updview][data-id=history]"); await p.waitForTimeout(80); r.history = await state();
await p.click(".stu-tabs [data-act=updview][data-id=compat]"); await p.waitForTimeout(80);
await p.screenshot({ path: `${dir}out/shots/upd-9-nodup.png` });
const ok = r.notes.summary && !r.compat.summary && r.history.summary && r.notes.goTop === r.compat.goTop && r.compat.goTop === r.history.goTop;
console.log(r, ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
