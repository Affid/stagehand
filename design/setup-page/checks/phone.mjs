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
    if (el.closest(".sts-gridwrap, .stl-gridwrap, .stp-tabs, #notifications")) return false;
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
  await click(p, '.sts-world[data-id="strahd"]'); await expect(p, "page/world", `${tag} open a world`);
  const tabsOneRow = await p.evaluate(() => new Set([...document.querySelectorAll(".sts-subtabs > a")].map((a) => a.offsetTop)).size === 1);
  if (!tabsOneRow) bad.push(`${tag}: a world's tabs wrap to a second row`);
  for (const t of ["about", "backups", "modules"]) { await click(p, `[data-act=wtab][data-id=${t}]`); await check(p, `${tag} world ${t}`); }
  await click(p, '.stw-card[data-id="modular-av-dock"]');
  if (!(await p.$(".sts-panel"))) bad.push(`${tag}: details didn't open`);
  await check(p, `${tag} details`);
  await click(p, ".stp-sheetbar [data-act=closepanel]");
  if (await p.$(".sts-panel")) bad.push(`${tag}: details didn't close`);
  await click(p, '.stw-card[data-id="modular-av-jitsi"] input');
  const before = await p.evaluate(() => document.querySelector(".stp-launch .stc-badge")?.textContent);
  await click(p, ".stp-what"); await check(p, `${tag} next launch`);
  await click(p, ".sts-panel [data-act=undo]");
  const after = await p.evaluate(() => document.querySelector(".stp-launch .stc-badge")?.textContent);
  if (Number(after) !== Number(before) - 1) bad.push(`${tag}: undo in Next launch went ${before} → ${after}`);
  await click(p, ".sts-panel footer [data-act=launch]");
  if (!(await p.$(".sts-dialog")) || (await p.$(".sts-panel"))) bad.push(`${tag}: Launch in the sheet didn't swap to the review`);
  await check(p, `${tag} launch review`);
  await click(p, ".sts-dialog [data-act=closedialog]");
  await click(p, ".stp-back"); await expect(p, "home/world", `${tag} Back`);
  for (const t of ["backups", "config", "library"]) { await click(p, `.stp-tabs [data-id=${t}]`); await expect(p, `page/${t}`, `${tag} tab ${t}`); await check(p, `${tag} ${t}`); }
  await click(p, ".stp-tabs [data-id=backups]");
  if (!(await p.evaluate(() => new Set([...document.querySelectorAll(".sts-subtabs > a")].map((a) => a.offsetTop)).size === 1))) bad.push(`${tag}: Backups tabs wrap to a second row`);
  if (!(await p.$(".stp-bkbar [data-act=snapnew]"))) bad.push(`${tag}: Backups has no New snapshot bar`);
  await click(p, "[data-act=snapselect]"); await click(p, "[data-act=snappick]"); await check(p, `${tag} select snapshots`);
  if (!(await p.$(".stp-bkbar [data-act=snapdel]:not([disabled])"))) bad.push(`${tag}: selecting a snapshot didn't enable Delete in the bar`);
  await click(p, ".stp-bkbar [data-act=snapselect]");
  for (const t of ["world", "module"]) { await click(p, `[data-act=sbtab][data-id=${t}]`); await click(p, "[data-act=sbopen]"); await check(p, `${tag} backups ${t}`); }
  await click(p, ".stp-tabs [data-id=library]");
  await click(p, ".stp-more"); await check(p, `${tag} library menu`); await click(p, "#context-menu [data-act=panel][data-id=tags]");
  if (!(await p.$(".sts-panel"))) bad.push(`${tag}: Tags didn't open from the menu`);
  await click(p, ".stp-sheetbar [data-act=closepanel]");
  await click(p, "[data-act=lsub][data-id=grid]"); await check(p, `${tag} by world`);
  await click(p, "[data-act=lsub][data-id=systems]"); await check(p, `${tag} systems`);
  await click(p, ".stp-tabs [data-id=worlds]"); await click(p, ".stp-ver"); await click(p, ".st-pop [data-act=updpage]");
  await expect(p, "page/update", `${tag} What's new`); await check(p, `${tag} update`);
  await click(p, ".stp-back"); await expect(p, "home/world", `${tag} Back from What's new`);
  await p.close();
}
// A world is running: the app shows which one and Return to Setup; with people in the game it asks first.
for (const [people, width] of [[2, 360], [0, 412]]) {
  const p = await b.newPage({ viewport: { width, height: width === 360 ? 736 : 871 } });
  p.on("pageerror", (e) => errs.push(`running ${width}: ${e.message}`));
  await p.goto(`file://${dir}out/setup-shell.html?calm=1&phone=1&running=strahd&people=${people}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const tag = `running@${width}`;
  const shown = await p.evaluate(() => ({ title: document.querySelector(".stp-runhero h2")?.textContent, tabs: !!document.querySelector(".stp-tabs")?.offsetParent }));
  if (shown.title !== "Curse of Strahd" || shown.tabs) bad.push(`${tag}: expected the running world and no tabs, got ${JSON.stringify(shown)}`);
  await check(p, `${tag} screen`);
  await click(p, "[data-act=runreturn]");
  const asked = !!(await p.$(".sts-dialog [data-act=runclose]"));
  if (asked !== people > 0) bad.push(`${tag}: confirm ${asked ? "shown" : "missing"} with ${people} people in the game`);
  if (asked) { await check(p, `${tag} confirm`); await click(p, ".sts-dialog [data-act=runclose]"); }
  await p.waitForTimeout(1900);
  const back = await p.evaluate(() => ({ run: !!document.querySelector(".stp-run"), page: document.body.dataset.page, tabs: !!document.querySelector(".stp-tabs")?.offsetParent }));
  if (back.run || back.page !== "world" || !back.tabs) bad.push(`${tag}: Return to Setup didn't land on Setup: ${JSON.stringify(back)}`);
  await p.close();
}
console.log(bad.length ? bad : "no layout problems");
console.log(errs.length ? errs : "no errors");
await b.close();
