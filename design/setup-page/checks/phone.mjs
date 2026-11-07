// Phone layout (?phone=1): every page at 360 and 412 px wide fits without sideways scrolling; the
// tabs, Back and the sheets get you around; the queued-changes sheet undoes; the launch review opens.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = []; const bad = [];
const click = async (p, sel) => { await p.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error(`missing ${s}`); el.click(); }, sel); await p.waitForTimeout(120); };
/** Elements wider than the screen, other than the By world grid, which scrolls on its own. */
const overflow = (p) => p.evaluate(() => {
  const w = innerWidth;
  const out = [...document.querySelectorAll("body *")].filter((el) => {
    if (el.closest(".mls-gridwrap, .mll-gridwrap, .mlp-tabs, #notifications")) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!(r.width > 0 && cs.visibility !== "hidden" && cs.display !== "none" && r.right > w + 1 && el.offsetParent !== null)) return false;
    // Clipped by a hidden-overflow box that itself fits (a carousel's next slide): not a page overflow.
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.matches("#setup, .application")) continue; // the page's own frames clip everything
      if (["hidden", "clip"].includes(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= w + 1) return false;
    }
    return true;
  }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`);
  return [...new Set(out)].slice(0, 4);
});
const where = (p) => p.evaluate(() => `${document.body.dataset.screen}/${document.body.dataset.page}`);
const check = async (p, label) => { await p.waitForTimeout(220); const o = await overflow(p); if (o.length) bad.push(`${label}: ${o.join(", ")}`); };
const expect = async (p, want, label) => { const got = await where(p); if (got !== want) bad.push(`${label}: at ${got}, expected ${want}`); };

for (const width of [360, 412]) {
  const p = await b.newPage({ viewport: { width, height: width === 360 ? 736 : 871 } });
  p.on("pageerror", (e) => errs.push(`${width}: ${e.message}`));
  await p.goto(`file://${dir}out/setup-shell.html?calm=1&phone=1`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const tag = `@${width}`;
  await check(p, `${tag} worlds`);
  await click(p, '.mls-world[data-id="strahd"]'); await expect(p, "page/world", `${tag} open a world`);
  const tabsOneRow = await p.evaluate(() => new Set([...document.querySelectorAll(".mls-subtabs > a")].map((a) => a.offsetTop)).size === 1);
  if (!tabsOneRow) bad.push(`${tag}: a world's tabs wrap to a second row`);
  for (const t of ["about", "backups", "modules"]) { await click(p, `[data-act=wtab][data-id=${t}]`); await check(p, `${tag} world ${t}`); }
  await click(p, '.mlw-card[data-id="modular-av-dock"]');
  if (!(await p.$(".mls-panel"))) bad.push(`${tag}: details didn't open`);
  await check(p, `${tag} details`);
  await click(p, ".mlp-sheetbar [data-act=closepanel]");
  if (await p.$(".mls-panel")) bad.push(`${tag}: details didn't close`);
  await click(p, '.mlw-card[data-id="modular-av-jitsi"] input');
  const before = await p.evaluate(() => document.querySelector(".mlp-launch .mlc-badge")?.textContent);
  await click(p, ".mlp-what"); await check(p, `${tag} next launch`);
  await click(p, ".mls-panel [data-act=undo]");
  const after = await p.evaluate(() => document.querySelector(".mlp-launch .mlc-badge")?.textContent);
  if (Number(after) !== Number(before) - 1) bad.push(`${tag}: undo in Next launch went ${before} → ${after}`);
  await click(p, ".mls-panel footer [data-act=launch]");
  if (!(await p.$(".mls-dialog")) || (await p.$(".mls-panel"))) bad.push(`${tag}: Launch in the sheet didn't swap to the review`);
  await check(p, `${tag} launch review`);
  await click(p, ".mls-dialog [data-act=closedialog]");
  await click(p, ".mlp-back"); await expect(p, "home/world", `${tag} Back`);
  for (const t of ["backups", "config", "library"]) { await click(p, `.mlp-tabs [data-id=${t}]`); await expect(p, `page/${t}`, `${tag} tab ${t}`); await check(p, `${tag} ${t}`); }
  await click(p, ".mlp-tabs [data-id=backups]");
  if (!(await p.evaluate(() => new Set([...document.querySelectorAll(".mls-subtabs > a")].map((a) => a.offsetTop)).size === 1))) bad.push(`${tag}: Backups tabs wrap to a second row`);
  if (!(await p.$(".mlp-bkbar [data-act=snapnew]"))) bad.push(`${tag}: Backups has no New snapshot bar`);
  await click(p, "[data-act=snapselect]"); await click(p, "[data-act=snappick]"); await check(p, `${tag} select snapshots`);
  if (!(await p.$(".mlp-bkbar [data-act=snapdel]:not([disabled])"))) bad.push(`${tag}: selecting a snapshot didn't enable Delete in the bar`);
  await click(p, ".mlp-bkbar [data-act=snapselect]");
  for (const t of ["world", "module"]) { await click(p, `[data-act=sbtab][data-id=${t}]`); await click(p, "[data-act=sbopen]"); await check(p, `${tag} backups ${t}`); }
  await click(p, ".mlp-tabs [data-id=library]");
  await click(p, ".mlp-more"); await check(p, `${tag} library menu`); await click(p, "#context-menu [data-act=panel][data-id=tags]");
  if (!(await p.$(".mls-panel"))) bad.push(`${tag}: Tags didn't open from the menu`);
  await click(p, ".mlp-sheetbar [data-act=closepanel]");
  await click(p, "[data-act=lsub][data-id=grid]"); await check(p, `${tag} by world`);
  await click(p, "[data-act=lsub][data-id=systems]"); await check(p, `${tag} systems`);
  await click(p, ".mlp-tabs [data-id=worlds]"); await click(p, ".mlp-ver"); await click(p, ".ml-pop [data-act=updpage]");
  await expect(p, "page/update", `${tag} What's new`); await check(p, `${tag} update`);
  await click(p, ".mlp-back"); await expect(p, "home/world", `${tag} Back from What's new`);
  await p.close();
}
console.log(bad.length ? bad : "no layout problems");
console.log(errs.length ? errs : "no errors");
await b.close();
