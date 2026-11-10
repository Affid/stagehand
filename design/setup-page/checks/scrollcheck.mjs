import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
for (const [w, h] of [[1600, 1000], [1440, 900], [1280, 800]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, timezoneId: "Europe/Luxembourg" })).newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(700);
  const out = [];
  for (const id of ["strahd", "heist", "oneshot"]) {
    await p.click(`.sts-world[data-id="${id}"]`); await p.click("[data-act=wtab][data-id=about]"); await p.waitForTimeout(100);
    out.push(await p.evaluate((id) => { const a = document.querySelector(".stw-about"); return `${id}: overflow ${a.scrollHeight - a.clientHeight}px`; }, id));
  }
  if (w === 1600) { await p.click('.sts-world[data-id="strahd"]'); await p.click("[data-act=wtab][data-id=about]"); await p.waitForTimeout(100); await p.screenshot({ path: `${dir}out/shots/s-10-about-${w}.png` }); }
  console.log(`${w}x${h}`, out.join(" · "));
  await p.close();
}
console.log(errs.length ? errs : "no errors"); await b.close();
