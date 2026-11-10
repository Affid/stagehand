import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
async function page(q = "") {
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(`file://${dir}out/setup-shell.html${q}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${dir}out/shots/${n}.png` });
const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(120); };
let p = await page();
// grid
await click(p, ".sts-lib"); await click(p, '[data-act="lsub"][data-id="grid"]'); await shot(p, "i-1-grid");
await click(p, 'input[data-act="gcell"][data-id="heist"][data-mid="modular-av"]'); await shot(p, "i-2-grid-problem");
await click(p, '[data-act="gcolmenu"][data-id="heist"]'); await shot(p, "i-3-colmenu");
await click(p, '#context-menu [data-act="copyto"]'); await click(p, '.st-pop [data-act="docopyto"][data-id="oneshot"]'); await shot(p, "i-4-copy");
await click(p, '[data-act="copymode"][data-id="add"]'); await shot(p, "i-5-copy-add");
await click(p, '[data-act="copyapply"]'); await shot(p, "i-6-copied");
// intake
await click(p, ".sts-lib"); await click(p, '[data-act="lsub"][data-id="modules"]'); await shot(p, "i-7-intake-band");
await click(p, '[data-act="intake"]'); await shot(p, "i-8-intake");
await click(p, '[data-act="intakeaccept"]'); await shot(p, "i-9-intake-accepted");
await click(p, '[data-act="foundry"][data-what="Install Module"]'); await shot(p, "i-10-installed");
// copy from world page
await click(p, '.sts-world[data-id="strahd"]'); await click(p, '[data-act="copyfrom"]'); await shot(p, "i-11-copyfrom");
await p.close();
p = await page("?review=launch");
await shot(p, "i-12-review-world");
await click(p, ".sts-banner .sts-launch"); await shot(p, "i-13-launch-dialog");
console.log(errs.length ? errs : "no errors");
await b.close();
