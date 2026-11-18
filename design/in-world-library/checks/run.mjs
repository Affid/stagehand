// Walks the mockup's flows in Chromium and checks what is visible. Serves out/
// on a local port; screenshots go to out/shots/. Run: node checks/run.mjs
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const OUT = new URL("../out/", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer((req, res) => {
  const path = normalize(join(OUT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  const file = path.endsWith("/") ? join(path, "index.html") : path;
  if (!file.startsWith(OUT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const open = async (query = "") => { await page.goto(`${base}/mock.html?reset=1&${query}`); await page.waitForSelector("#module-management"); };
const shot = (name) => page.screenshot({ path: `${OUT}shots/${name}.png` });
const visibleRows = () => page.locator("#module-management li.package:visible").count();
const win = page.locator("#module-management");

// Folders
await open();
await shot("01-folders");
check("folder headers show", (await win.locator(".stagehand-folder > .folder-header:visible").count()) === 9);
check("folders are one level, as Setup makes them", (await win.locator(".stagehand-folder .stagehand-folder").count()) === 0);
check("library tags show", (await win.locator(".stagehand-tag:visible").count()) > 10);
await win.locator('[data-folder-id="combat"] > .folder-header').click();
check("folding hides the folder's rows", (await win.locator('[data-folder-id="combat"] li.package:visible').count()) === 0);
await shot("02-folded");

// Search over tags and notes
await win.locator("#module-search").fill("heavy");
check("search finds tags", (await visibleRows()) === 3, `${await visibleRows()} rows`);
await shot("03-search-tag");
await win.locator("#module-search").fill("laptop");
check("search finds notes", (await visibleRows()) === 1);
await win.locator("#module-search").fill("");

// Note tooltip
await win.locator('[data-module-id="perfect-vision"] .stagehand-note').hover();
check("note tooltip shows the note", (await page.locator("#tooltip:visible").textContent())?.includes("3D Canvas") === true);
await shot("04-note-tooltip");

// A–Z
await win.locator('[data-action="stagehandView"]').click();
check("A–Z drops the folders", (await win.locator(".stagehand-folder").count()) === 0);
check("A–Z keeps tags", (await win.locator(".stagehand-tag:visible").count()) > 10);
await shot("05-a-z");
await win.locator('[data-action="stagehandView"]').click();

// Expanded rows carry the note
await win.locator('[data-action="toggleExpanded"]').click();
check("expanded rows show the note line", await win.locator('[data-module-id="cos-handouts"] .stagehand-note-line').isVisible());
await shot("06-expanded");
await win.locator('[data-action="toggleExpanded"]').click();

// Apply presets: Add with a dependency
await win.locator('[data-action="applyPresets"]').click();
const dlg = page.locator("dialog.stagehand-dialog");
check("Review waits for a preset", await dlg.locator('[data-action="next"]').isDisabled());
await dlg.locator('input[value="horror"]').check();
await shot("07-picker");
await dlg.locator('[data-action="next"]').click();
check("diff names the dependency", (await dlg.locator(".stagehand-diff").textContent()).includes("Added as dependencies"));
await shot("08-diff-add");
await dlg.locator('[data-action="apply"]').click();
await page.waitForSelector("#notifications .notification.info");
check("applied: notification", (await page.locator("#notifications").textContent()).includes("Horror ambience (Add)"));
await shot("09-applied");
await page.locator("#open-modules").click();
check("applied: Token Magic FX is on", await win.locator('[data-module-id="tokenmagic"] input').isChecked());

// Remove with a module still needing one
await win.locator('[data-action="applyPresets"]').click();
await dlg.locator('input[value="oneshot"]').check();
await dlg.locator('input[value="remove"]').check();
await dlg.locator('[data-action="next"]').click();
check("diff lists what still needs a removed module", (await dlg.locator(".stagehand-diff").textContent()).includes("Still needed by modules that stay"));
await shot("10-diff-remove");
await dlg.locator('[data-action="apply"]').click();
check("refuses without the dependents choice", await page.locator("#notifications .notification.warning").isVisible());
await dlg.locator('[data-action="back"]').click();

// Not installed
await dlg.locator('input[value="oneshot"]').uncheck();
await dlg.locator('input[value="strahd"]').check();
await dlg.locator('input[value="add"]').check();
await dlg.locator('[data-action="next"]').click();
check("diff skips a module that isn't installed", (await dlg.locator(".stagehand-diff").textContent()).includes("Monk's Enhanced Journal"));
await dlg.locator('footer [data-action="cancel"]').click();

// Unsaved ticks
await win.locator('[data-module-id="popout"] input').check();
await win.locator('[data-action="applyPresets"]').click();
check("picker warns about unsaved ticks", await dlg.locator(".stagehand-warning").isVisible());
await shot("11-unsaved");
await dlg.locator('footer [data-action="cancel"]').click();

// No library: Foundry's window untouched
await open("lib=0");
check("no library: no folders", (await win.locator(".stagehand-folder").count()) === 0);
check("no library: no Apply Presets", (await win.locator('[data-action="applyPresets"]').count()) === 0);
check("no library: no tags", (await win.locator(".stagehand-tag").count()) === 0);
await shot("12-no-library");

// Assistant GM and player
await open("role=assistant");
check("assistant: library, no Apply Presets", (await win.locator(".stagehand-folder").count()) > 0 && (await win.locator('[data-action="applyPresets"]').count()) === 0);
await open("role=player");
check("player: read-only, active modules only", (await visibleRows()) === 19 && (await win.locator("li.package input:not([disabled])").count()) === 0);
check("player: no library", (await win.locator(".stagehand-folder, .stagehand-tag").count()) === 0);
await shot("13-player");

// Light interface
await open("theme=light");
await shot("14-light");

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
