// Library > Updates (docs/UPDATES-PLAN.md): the chip opens the panel's Update box, the tab checks
// with progress, warnings and their fixes, Update with backup and progress on the tab, the rail,
// cards and Launch, the summary, and the "current" and "offline" scenes.
import { chromium } from "@playwright/test";
const dir = new URL("../", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
const shot = (n) => p.screenshot({ path: `${dir}out/shots/${n}.png` });
const text = (sel) => p.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, " ").trim() ?? null, sel);
const texts = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, " ").trim()), sel);
const tipOf = async (sel) => { await p.hover(sel, { force: true }); await p.waitForTimeout(700); return p.evaluate(() => document.querySelector("#tooltip.active")?.textContent ?? null); };
const row = (id) => `.spu-row[data-id="${id}"]`;
const fail = (msg) => errs.push(`check: ${msg}`);
const expect = (ok, msg) => { if (!ok) fail(msg); };
const r = {};

await p.goto(`file://${dir}out/setup-shell.html?calm=1&page=library&n=60`); await p.waitForTimeout(500);
r.modules = { updateAll: await p.locator('[data-what="Update All"]').count(), tab: await text('[data-act=lsub][data-id=updates]'), rail: await text(".sts-lib > span") };
expect(r.modules.updateAll === 0, "Update All is gone from the Modules tab");
expect(/Updates 7/.test(r.modules.tab), "the tab counts 7 updates (5 ready, 2 need attention)");
expect(/7 updates/.test(r.modules.rail), "the rail counts the same 7");

// The arrow chip opens the module's panel on the Package tab, at its Update box.
await p.click('li.stw-lib[data-package-id="modular-av"] .stw-upd'); await p.waitForTimeout(100);
r.box = await text(".sts-panel .spu-box");
expect(/0\.12\.0 is available/.test(r.box ?? ""), "the Update box offers 0.12.0");
await shot("updates-1-panel");
await p.click(".sts-panel .sts-close");

// Opening the tab checks again (the last check is two hours old), with progress.
await p.click("[data-act=lsub][data-id=updates]"); await p.waitForTimeout(400);
r.checking = { head: await text(".spu-head.busy strong"), rail: await text(".spu-rail") };
expect(/Checking \d+ of \d+/.test(r.checking.head ?? ""), "the head shows the check's progress");
expect(/Checking for updates/.test(r.checking.rail ?? ""), "the rail says it is checking");
await shot("updates-2-checking");
await p.waitForSelector(".spu-head:not(.busy)", { timeout: 8000 });
r.sections = await texts(".spu-sh");
r.ticked = await p.evaluate(() => [...ST.uc.ticked]);
expect(r.ticked.length === 5, "five Ready updates start ticked");
await shot("updates-3-list");

// A need another update meets; unticking that one shows the warning and its fix.
r.dockNote = await text(`${row("modular-av-dock")} .spu-note`);
await p.click(`${row("modular-av")} .spu-tick`); await p.waitForTimeout(60);
r.dockWarn = await text(`${row("modular-av-dock")} .spu-warn`);
expect(/Needs Modular A\/V/.test(r.dockWarn ?? ""), "the Dock warns without Modular A/V");
await p.click(`${row("modular-av-dock")} .spu-warn a`); await p.waitForTimeout(60);
expect(await p.locator(`${row("modular-av")} .spu-tick`).isChecked(), "Tick it too ticks Modular A/V");

// The system update: its impact on modules, and the module whose update fits the new version.
r.tidyBefore = await text(`${row("tidy5e-sheet")} .spu-warn`);
await p.click(`${row("dnd5e")} .spu-tick`); await p.waitForTimeout(60);
r.dndWarn = await text(`${row("dnd5e")} .spu-warn`);
await p.click(`${row("dnd5e")} .spu-warn a`); await p.waitForTimeout(60);
r.dndAfter = await text(`${row("dnd5e")} .spu-warn`);
r.tidyAfter = await text(`${row("tidy5e-sheet")} .spu-note`);
expect(/1 module declares/.test(r.dndAfter ?? ""), "with Tidy ticked, one module is left outside its range");
await shot("updates-4-warnings");

// Update: backup first, then each package with progress.
r.button = await text("[data-act=ugo]");
await p.click("[data-act=ugo]"); await p.waitForTimeout(500);
r.backup = await text(".spu-foot.busy strong");
expect(/Backing up 7 packages/.test(r.backup ?? ""), "the foot shows the backup");
await shot("updates-5-backup");
await p.waitForSelector(".spu-row .spu-st.dl", { timeout: 8000 }); await p.waitForTimeout(150);
r.running = { foot: await text(".spu-foot.busy strong"), tab: await text("[data-act=lsub][data-id=updates]"), rows: await texts(".spu-row.busy .spu-side") };
await shot("updates-6-running");
await p.click("[data-act=lsub][data-id=modules]"); await p.waitForTimeout(100);
r.elsewhere = { rail: await text(".spu-rail"), chips: await texts(".spu-chip") };
expect(/Updating \d+ of 7/.test(r.elsewhere.rail ?? ""), "the rail shows the run");
expect(r.elsewhere.chips.length > 0, "cards show their progress");
await shot("updates-7-cards");
await p.click('.sts-world[data-id="heist"]'); await p.waitForTimeout(100);
r.launch = { disabled: await p.evaluate(() => document.querySelector(".sts-launch")?.disabled), tip: await tipOf(".sts-banner .stw-tipwrap") };
expect(r.launch.disabled && /updates to finish/.test(r.launch.tip ?? ""), "Launch waits for the updates");
await p.click(".sts-lib"); await p.click("[data-act=lsub][data-id=updates]");
await p.waitForSelector(".spu-sum", { timeout: 20000 });
r.done = { sum: await text(".spu-sum"), sections: await texts(".spu-sh"), refused: await text(`${row("chat-portrait")} .spu-why`) };
expect(/6 packages updated · 1 failed/.test(r.done.sum ?? ""), "the summary counts what happened");
expect(/Couldn't check/i.test(r.done.sections.join()) && !/version newer than undefined/.test(await text(`${row("health-estimate")} .spu-why`)), "a check error keeps its own reason");
expect(r.done.sections[0]?.startsWith("UPDATED JUST NOW"), "what just updated comes first");
expect(/download was refused/.test(r.done.refused ?? ""), "the refused download is remembered");
await shot("updates-8-done");
await p.click(`${row("modular-av")} .t`); await p.waitForTimeout(100);
r.boxAfter = await text(".sts-panel .spu-box");
expect(/Up to date: updated to 0\.12\.0/.test(r.boxAfter ?? ""), "the panel says it was updated");
await p.click(".sts-panel .sts-close"); await p.waitForTimeout(80);

// Ways back: a manifest that refused access, checked again after renewing; a check that failed,
// tried again; a refused download, tried again after renewing.
await p.click(`${row("dungeon-draw")} .spu-why a[data-act=urecheck]`); await p.waitForTimeout(300);
r.rechecking = await text(`${row("dungeon-draw")} .spu-side`);
expect(/Checking/.test(r.rechecking ?? ""), "the row shows its own check");
await p.waitForTimeout(1100);
r.renewed = { section: await p.evaluate(() => ST.uc.results.get("dungeon-draw").section), ticked: await p.locator(`${row("dungeon-draw")} .spu-tick`).isChecked() };
expect(r.renewed.section === "ready" && r.renewed.ticked, "a renewed manifest comes back Ready and ticked");
await p.click(`${row("health-estimate")} .spu-why a[data-act=uretry]`); await p.waitForTimeout(1400);
r.retried = await p.evaluate(() => ST.uc.results.get("health-estimate").section);
expect(r.retried === "ready", "a check that answers on the second try offers its update");
await shot("updates-11-ways-back");
await p.click(`${row("chat-portrait")} .spu-why a[data-act=uagain]`); await p.waitForTimeout(200);
r.again = await text(`${row("chat-portrait")} .spu-side`);
await p.waitForSelector(".spu-sum", { timeout: 20000 });
r.againDone = { sum: await text(".spu-sum"), section: await p.evaluate(() => ST.uc.results.get("chat-portrait").section) };
expect(r.againDone.section === "updated", "the refused download installs once access is renewed");

// Nothing to update, and no manifest answering.
await p.goto(`file://${dir}out/setup-shell.html?calm=1&n=60&lsub=updates&upd=current`); await p.waitForSelector(".spu-head:not(.busy)", { timeout: 8000 });
r.current = { head: await text(".spu-head"), empty: await text(".spu-empty"), foot: await p.locator(".spu-foot").count() };
expect(/Everything is up to date/.test(r.current.head ?? "") && r.current.foot === 0, "the current scene has nothing to tick");
await shot("updates-9-current");
await p.goto(`file://${dir}out/setup-shell.html?calm=1&n=60&lsub=updates&upd=offline`); await p.waitForSelector(".spu-head:not(.busy)", { timeout: 8000 });
r.offline = { head: await text(".spu-head"), sections: await texts(".spu-sh"), rows: await p.locator(".spu-row").count() };
expect(/Couldn't check/.test(r.offline.head ?? "") && r.offline.rows === 0, "offline: one folded section, no rows open");
await p.click(".spu-sh[data-id=error]"); await p.waitForTimeout(80);
await p.click(`.spu-row:first-child .spu-why a[data-act=uretry]`); await p.waitForTimeout(1400);
r.offlineRetry = await text(".spu-row:first-child .spu-why");
expect(/Still no answer after 2 tries/.test(r.offlineRetry ?? ""), "offline: a second try says so and points to the project page");
await shot("updates-10-offline");

console.log(JSON.stringify(r, null, 1)); console.log(errs.length ? errs : "no errors"); await b.close();
