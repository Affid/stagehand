// The By world grid keeps readable columns however many worlds there are: it scrolls sideways instead of shrinking.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const out = {};
for (const [label, n] of [["6", 6], ["12", 12], ["30", 30]]) {
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`file://${dir}out/setup-shell.html?calm=1${n > 6 ? "&worlds=12" : ""}`); await p.waitForTimeout(500);
  if (n === 30) await p.evaluate(() => { for (let i = 1; i <= 18; i++) WORLDS_X.push({ id: `extra${i}`, title: `Campaign ${i}: The Long Road`, system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: `${i + 2} months ago`, img: i % 2, pos: "center", desc: "" }); });
  await p.click(".sts-lib"); await p.click("[data-act=lsub][data-id=grid]"); await p.waitForTimeout(150);
  const m = await p.evaluate(() => { const g = document.querySelector(".sts-gridwrap"), th = document.querySelector(".sts-grid thead th.w"); return { cols: document.querySelectorAll(".sts-grid thead th.w").length, colW: Math.round(th.getBoundingClientRect().width), sideScroll: g.scrollWidth > g.clientWidth + 1, fade: g.classList.contains("more-right") }; });
  if (m.sideScroll) {
    await p.evaluate(() => { const g = document.querySelector(".sts-gridwrap"); g.scrollLeft = 600; g.dispatchEvent(new Event("scroll")); }); await p.waitForTimeout(80);
    m.namesPinned = await p.evaluate(() => { const th = document.querySelector(".sts-grid tbody tr[data-mid] th"), g = document.querySelector(".sts-gridwrap"); return Math.abs(th.getBoundingClientRect().left - g.getBoundingClientRect().left) < 3; });
    await p.screenshot({ path: `${dir}out/shots/grid-${label}-scrolled.png` });
    await p.evaluate(() => { const g = document.querySelector(".sts-gridwrap"); g.scrollLeft = g.scrollWidth; g.dispatchEvent(new Event("scroll")); }); await p.waitForTimeout(80);
    m.fadeAtEnd = await p.evaluate(() => document.querySelector(".sts-gridwrap").classList.contains("more-right"));
  }
  out[label] = m; await p.close();
}
const ok = out["6"].colW >= 92 && !out["6"].sideScroll && out["30"].colW >= 92 && out["30"].sideScroll && out["30"].namesPinned && out["30"].fade && !out["30"].fadeAtEnd;
console.log(JSON.stringify(out, null, 1), ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
