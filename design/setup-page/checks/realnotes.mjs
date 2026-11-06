// Foundry's real release notes (out/release-notes-sample.html, fetched by spikes/spike-update.ts; not in git)
// through the mockup's reader: everything in the source must show, nothing unsafe may.
import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
const dir = new URL("../", import.meta.url).pathname;
const file = `${dir}out/release-notes-sample.html`;
if (!existsSync(file)) { console.log("skipped: run spikes/spike-update.ts to fetch real notes"); process.exit(0); }
const html = readFileSync(file, "utf8");
// Expectations from the source itself.
const want = {
  entries: (html.match(/<li[\s>]/g) ?? []).length,
  issues: (html.match(/<li[\s>][\s\S]*?github\.com\/foundryvtt\/foundryvtt\/issues\/\d+[\s\S]*?<\/li>/g) ?? []).length,
  sections: [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter((t) => !/release notes/i.test(t)),
  codeInEntries: [...html.matchAll(/<li[\s>]([\s\S]*?)<\/li>/g)].reduce((t, m) => t + (m[1].match(/<code>/g) ?? []).length, 0),
};
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => { errs.push(`dialog opened: ${d.message()}`); d.dismiss(); });
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(600);
const load = (h) => p.evaluate((h) => { UPD_STATES.available.notesHtml = h; delete UPD_STATES.available._notes; ST.upd.open = new Set(notesFor(UPD_STATES.available).sections.map((s) => s.h)); A.updpage(); }, h);
await load(html); await p.waitForTimeout(300);
const got = await p.evaluate(() => {
  const n = notesFor(UPD_STATES.available);
  const all = n.sections.flatMap((s) => [...(s.items ?? []), ...(s.sub ?? []).flatMap((x) => x.items)]);
  const lis = [...document.querySelectorAll(".mlu-sec li")];
  return {
    title: n.title, banner: !!n.banner, introParas: n.intro.length,
    sections: n.sections.map((s) => `${s.h} [${s.kind}]`),
    entries: all.length, withIssue: all.filter((i) => i.n).length, rendered: lis.length,
    codeShown: document.querySelectorAll(".mlu-sec li code").length,
    // Tag-like text outside code means markup leaked; inside code it is Foundry naming an element.
    rawTagsVisible: lis.filter((li) => { const c = li.cloneNode(true); c.querySelectorAll("code").forEach((x) => x.remove()); return /<\/?[a-z]+[\s>]/i.test(c.textContent); }).length,
    issueChips: document.querySelectorAll(".mlu-sec .mlu-issue").length,
    breakingFirst: n.sections[0]?.kind === "breaking", breakingIntro: n.sections[0]?.intro.length,
  };
});
await p.screenshot({ path: `${dir}out/shots/real-notes-1.png` });
await p.fill('[data-filter="updq"]', "CalendarData"); await p.waitForTimeout(100);
const search = await p.evaluate(() => [...document.querySelectorAll(".mlu-sec li")].map((l) => l.innerText.slice(0, 80)));
await p.fill('[data-filter="updq"]', ""); await p.waitForTimeout(60);
await p.click("[data-act=upddev]"); await p.waitForTimeout(80);
const noDev = await p.evaluate(() => [...document.querySelectorAll(".mlu-jump a")].map((a) => a.textContent));
await p.click("[data-act=upddev]"); await p.waitForTimeout(60);
await p.screenshot({ path: `${dir}out/shots/real-notes-2.png` });
// A tampered copy: nothing unsafe may come through.
const evil = html.replace("<ul>", '<ul><li>Bad <script>window.__pwned = 1</script><img src=x onerror="window.__pwned=2"> <a href="javascript:window.__pwned=3">click</a> <a href="https://github.com/foundryvtt/foundryvtt/issues/1">(1)</a></li>');
await load(evil); await p.waitForTimeout(300);
const safe = await p.evaluate(() => ({ pwned: window.__pwned ?? null, scripts: document.querySelectorAll(".mlu-notes script, .mlu-notes [onerror], .mlu-notes a[href^='javascript']").length, imgsInEntries: document.querySelectorAll(".mlu-sec li img").length }));
const ok = got.entries === want.entries && got.withIssue === want.issues && got.rendered === want.entries && got.codeShown === want.codeInEntries
  && got.rawTagsVisible === 0 && got.issueChips === want.issues && want.sections.every((h) => got.sections.some((s) => s.startsWith(h)))
  && got.banner && got.breakingFirst && search.length > 0 && !noDev.some((t) => /API|documentation/.test(t)) && !safe.pwned && !safe.scripts && !safe.imgsInEntries;
console.log({ want, got, search, noDev, safe }, ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
