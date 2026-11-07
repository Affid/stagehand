// Phone layouts (?phone=a|b): every page at 360 and 412 px wide fits without sideways scrolling,
// Back and the tabs get you around, details open and close, and the launch review applies.
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
    // Clipped by a scrolling or hidden-overflow box that itself fits (a carousel's next slide): not a page overflow.
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.matches("#setup, .application")) continue; // the page's own frames clip everything
      if (["hidden", "clip"].includes(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= w + 1) return false;
    }
    return true;
  }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`);
  return [...new Set(out)].slice(0, 4);
});
const where = (p) => p.evaluate(() => `${document.body.dataset.screen}/${document.body.dataset.page}`);
const check = async (p, label) => { const o = await overflow(p); if (o.length) bad.push(`${label}: ${o.join(", ")}`); };

for (const v of ["a", "b"]) for (const width of [360, 412]) {
  const p = await b.newPage({ viewport: { width, height: width === 360 ? 736 : 871 } });
  p.on("pageerror", (e) => errs.push(`${v}${width}: ${e.message}`));
  await p.goto(`file://${dir}out/setup-shell.html?calm=1&phone=${v}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  const tag = `${v}@${width}`;
  await check(p, `${tag} home`);
  await click(p, '.mls-world[data-id="strahd"]');
  if ((await where(p)) !== "page/world") bad.push(`${tag}: a world didn't open (${await where(p)})`);
  await check(p, `${tag} world`);
  for (const t of ["about", "backups", "modules"]) { await click(p, `[data-act=wtab][data-id=${t}]`); await check(p, `${tag} world ${t}`); }
  await click(p, '.mlw-card[data-id="modular-av-dock"]'); await p.waitForTimeout(250);
  if (!(await p.$(".mls-panel"))) bad.push(`${tag}: details didn't open`);
  await check(p, `${tag} details`);
  await click(p, ".mlp-sheetbar [data-act=closepanel]");
  if (await p.$(".mls-panel")) bad.push(`${tag}: details didn't close`);
  await click(p, '.mlw-card[data-id="modular-av-jitsi"] input');
  const n = await p.evaluate(() => document.querySelector(".mlp-launch .mlc-badge")?.textContent);
  await click(p, ".mlp-launch");
  if (!(await p.$(".mls-dialog"))) bad.push(`${tag}: no launch review`);
  await check(p, `${tag} launch review`);
  await click(p, ".mls-dialog [data-act=closedialog]").catch(() => click(p, ".mls-backdrop"));
  if (v === "a") {
    await click(p, ".mlp-back");
    if ((await where(p)) !== "home/world") bad.push(`${tag}: Back didn't return home (${await where(p)})`);
    for (const [act, page] of [["srvbackups", "backups"], ["srvconfig", "config"]]) {
      await click(p, ".mlp-menu"); await click(p, `#context-menu [data-act=${act}], .ml-pop [data-act=${act}]`);
      if ((await where(p)) !== `page/${page}`) bad.push(`${tag}: menu didn't open ${page} (${await where(p)})`);
      await check(p, `${tag} ${page}`); await click(p, ".mlp-back");
    }
    await click(p, ".mls-lib");
  } else {
    for (const t of ["backups", "config", "library"]) {
      await click(p, `.mlp-tabs [data-id=${t}]`);
      if (!(await where(p)).endsWith(t === "config" ? "config" : t)) bad.push(`${tag}: tab ${t} (${await where(p)})`);
      await check(p, `${tag} ${t}`);
    }
  }
  if ((await where(p)) !== "page/library") bad.push(`${tag}: Library didn't open (${await where(p)})`);
  await check(p, `${tag} library`);
  await click(p, "[data-act=lsub][data-id=grid]"); await check(p, `${tag} by world`);
  await click(p, "[data-act=lsub][data-id=systems]"); await check(p, `${tag} systems`);
  // A: the update is in ⋮ off the home screen; B: the version chip shows on every tab's root page.
  if (v === "a") { await click(p, ".mlp-menu"); await click(p, "#context-menu [data-act=updpage]"); }
  else { await click(p, ".mlp-ver"); await click(p, ".ml-pop [data-act=updpage]"); }
  if ((await where(p)) !== "page/update") bad.push(`${tag}: update page (${await where(p)})`);
  await check(p, `${tag} update`);
  if (v === "a") { await click(p, ".mlp-back"); if ((await where(p)) !== "page/library") bad.push(`${tag}: Back from What's new went to ${await where(p)}`); }
  if (width === 412) console.log(`${tag}: launch badge ${n ?? "none"} after one more switch`);
  await p.close();
}
console.log(bad.length ? bad : "no layout problems");
console.log(errs.length ? errs : "no errors");
await b.close();
