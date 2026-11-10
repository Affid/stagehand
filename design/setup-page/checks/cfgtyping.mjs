// Typing in a text field, then clicking a switch or a button straight away, must not lose the click.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`file://${dir}out/setup-shell.html?calm=1`); await p.waitForTimeout(600);
await p.click("[data-act=srvconfig]"); await p.waitForTimeout(100);
const cases = [];
const run = async (name, field, text, target, read) => {
  await p.click(`[data-cfg="${field}"]`); await p.keyboard.press("Control+A"); await p.keyboard.type(text);
  const before = await read();
  await p.click(target); await p.waitForTimeout(150);
  const after = await read();
  const kept = await p.evaluate((f) => document.querySelector(`[data-cfg="${f}"]`)?.value, field);
  cases.push({ name, clickLanded: before !== after, textKept: kept === text });
};
await run("username → usage-data switch", "adminUsername", "gm", '[data-cfg="telemetry"]', () => p.evaluate(() => document.querySelector('[data-cfg="telemetry"]').checked));
await run("data path → hot-reload switch", "dataPath", "/srv/foundry/data2", '[data-cfg="hotReload"]', () => p.evaluate(() => document.querySelector('[data-cfg="hotReload"]').checked));
await run("port → UPnP box", "port", "30001", '[data-cfg="upnp"]', () => p.evaluate(() => document.querySelector('[data-cfg="upnp"]').checked));
await run("AWS path → Advanced link", "awsConfig", "aws.json", "[data-act=cfgadv]", () => p.evaluate(() => !!document.querySelector('[data-cfg="unixSocket"]')));
await run("username → Save…", "adminUsername", "gm2", "[data-act=cfgsave]", () => p.evaluate(() => !!document.querySelector(".sts-dialog")));
const bar = await p.evaluate(() => document.querySelector(".stc-pending span")?.textContent);
const ok = cases.every((c) => c.clickLanded && c.textKept);
console.log(cases, { bar }, ok ? "ok" : "WRONG"); if (!ok) process.exitCode = 1;
console.log(errs.length ? errs : "no errors"); await b.close();
// Elsewhere: a module note, then a click on another card; a session's date time, then Save.
{
  const b2 = await chromium.launch(); const q = await (await b2.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const e2 = []; q.on("pageerror", (e) => e2.push(e.message));
  await q.goto(`file://${dir}out/setup-shell.html?calm=1`); await q.waitForTimeout(600);
  const r = {};
  await q.click(".sts-lib"); await q.click('li.stw-lib[data-package-id="modular-av-dock"] .t'); await q.waitForTimeout(100);
  await q.click('[data-change="note"]'); await q.keyboard.type("Remember the dock layout");
  await q.click('li.stw-lib[data-package-id="modular-av-jitsi"] .t'); await q.waitForTimeout(150);
  r.noteThenCard = await q.evaluate(() => document.querySelector(".stw-lib.viewing")?.dataset.packageId);
  r.noteSaved = await q.evaluate(() => NOTES["modular-av-dock"]);
  await q.click('.sts-world[data-id="heist"]'); await q.click("[data-act=wtab][data-id=about]"); await q.click("[data-act=sedit]"); await q.waitForTimeout(80);
  await q.click('[data-sdate="2026-11-27"]'); await q.keyboard.press("Control+A"); await q.keyboard.type("21:00");
  await q.click("[data-act=ssave]"); await q.waitForTimeout(150);
  r.timeThenSave = await q.evaluate(() => ({ closed: !document.querySelector(".stw-sched"), has2100: document.querySelector(".stw-sess").innerText.includes("27 Nov, 21:00") }));
  // Keyboard: type a username, Tab: focus moves on and stays; a bad port shows its error while typing.
  await q.click("[data-act=srvconfig]"); await q.click('[data-cfg="adminUsername"]'); await q.keyboard.type("gm"); await q.keyboard.press("Tab"); await q.waitForTimeout(100);
  r.tabFocus = await q.evaluate(() => document.activeElement?.dataset?.cfg ?? document.activeElement?.tagName);
  await q.click('[data-cfg="port"]'); await q.keyboard.press("Control+A"); await q.keyboard.type("99999"); await q.waitForTimeout(80);
  r.liveError = await q.evaluate(() => ({ err: document.querySelector(".stc-set .err")?.textContent ?? null, focusKept: document.activeElement?.dataset?.cfg === "port", saveLocked: !document.querySelector("[data-act=cfgsave]") }));
  const ok2 = r.noteThenCard === "modular-av-jitsi" && r.noteSaved === "Remember the dock layout" && r.timeThenSave.closed && r.timeThenSave.has2100 && r.tabFocus === "world" && r.liveError.err && r.liveError.focusKept && r.liveError.saveLocked;
  console.log(r, ok2 ? "ok" : "WRONG"); if (!ok2) process.exitCode = 1;
  console.log(e2.length ? e2 : "no errors"); await b2.close();
}
