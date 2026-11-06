import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(700);
const HTML = '<p>Gothic horror in <strong>Barovia</strong>. Tuesday group, five players.</p><p>House rules:</p><ul><li>Milestone levelling</li><li>Lingering injuries on a crit</li><li>No flanking</li></ul><p>Voice through LiveKit; see the <a href="https://example.com" onclick="alert(1)">table guide</a>.</p><script>alert(2)</script><img src=x onerror="alert(3)"><p>Session zero notes, safety tools and the content list are in the Journal.</p>';
await p.evaluate((h) => { WORLDS_X.find((w) => w.id === "strahd").desc = h; }, HTML);
await p.click('.mls-world[data-id="heist"]'); await p.click('.mls-world[data-id="strahd"]'); await p.click("[data-act=wtab][data-id=about]"); await p.waitForTimeout(150);
const shot = (n) => p.screenshot({ path: `${dir}out/shots/${n}.png`, clip: { x: 340, y: 255, width: 700, height: 330 } });
const view = await p.evaluate(() => { const d = document.getElementById("mlw-desc"); return { leftovers: /alert/.test(d.textContent), showsTags: d.innerText.includes("<p>"), list: d.querySelectorAll("li").length, bold: !!d.querySelector("strong"), scripts: d.querySelectorAll("script,img,[onclick],[onerror]").length, link: d.querySelector("a")?.getAttribute("rel"), more: !document.querySelector(".mlw-more").hidden, folded: d.scrollHeight > d.clientHeight }; });
await shot("d-1-folded");
await p.click(".mlw-more"); await p.waitForTimeout(80);
const open = await p.evaluate(() => ({ cut: document.getElementById("mlw-desc").scrollHeight > document.getElementById("mlw-desc").clientHeight + 2, label: document.querySelector(".mlw-more").textContent }));
await shot("d-2-open");
await p.click("[data-act=aedit][data-id=desc]"); await p.waitForTimeout(100);
const editor = await p.evaluate(() => { const r = document.getElementById("mlw-rte"); return { rich: !!r, lists: r.querySelectorAll("li").length, rawTags: r.innerText.includes("<p>") }; });
await p.click("#mlw-rte"); await p.keyboard.press("Control+End"); await p.keyboard.press("Enter"); await p.keyboard.type("Line one"); await p.keyboard.press("Shift+Enter"); await p.keyboard.type("Line two");
await p.keyboard.press("Enter"); await p.click('[data-act=rte][data-id=bold]'); await p.keyboard.type("Bold paragraph");
await shot("d-3-editor");
await p.click("[data-act=asave][data-id=desc]"); await p.waitForTimeout(100);
const saved = await p.evaluate(() => { const d = document.getElementById("mlw-desc"); const ps = [...d.querySelectorAll("p")].map((x) => x.innerHTML); return { last: ps.slice(-2), boldSaved: !!d.querySelector("p:last-child strong, p:last-child b") }; });
// a short one-line description: no "Show more"
await p.click('.mls-world[data-id="heist"]'); await p.click("[data-act=wtab][data-id=about]"); await p.waitForTimeout(80);
const short = await p.evaluate(() => ({ more: !document.querySelector(".mlw-more")?.hidden, text: document.getElementById("mlw-desc").innerText }));
// older plain-text description with line breaks
await p.evaluate(() => { WORLDS_X.find((w) => w.id === "vaults").desc = "First line\nSecond line\n\nSecond paragraph"; });
await p.click('.mls-world[data-id="vaults"]'); await p.click("[data-act=wtab][data-id=about]"); await p.waitForTimeout(80);
const plain = await p.evaluate(() => document.getElementById("mlw-desc").innerHTML);
// emptying it
await p.click('.mls-world[data-id="heist"]'); await p.click("[data-act=wtab][data-id=about]"); await p.click("[data-act=aedit][data-id=desc]"); await p.evaluate(() => { document.getElementById("mlw-rte").innerHTML = "<p><br></p>"; }); await p.click("[data-act=asave][data-id=desc]"); await p.waitForTimeout(80);
const empty = await p.evaluate(() => document.querySelector(".mlw-box .desc").textContent);
console.log({ view, open, editor, saved, short, plain, empty }); console.log(errs.length ? errs : "no errors"); await b.close();
