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

const card = (id) => win.locator(`.stw-card[data-id="${id}"]`);
const panelTitle = () => win.locator(".sts-panel .sts-modhead h3").textContent();
const changesCount = async () => ((await win.locator('.st-seg2 [data-id="changes"]').textContent()) ?? "").trim();

// Setup's world page inside Module Management
await open();
await shot("01-cards");
check("cards layout by default", (await win.getAttribute("class")).includes("stagehand-cards"));
check("folder sections show", (await win.locator(".stc-sec").count()) === 9);
check("every module has a card", (await win.locator(".stw-card").count()) === 38);
check("the panel opens with the mockup", (await panelTitle()) === "Modular A/V: LiveKit");
await card("perfect-vision").locator(".t").click();
check("clicking a card shows it in the panel", (await panelTitle()) === "Perfect Vision");
check("its folder and presets show", ((await win.locator(".sts-panel").textContent()) ?? "").includes("Lighting & weather") && ((await win.locator(".sts-panel").textContent()) ?? "").includes("Horror ambience"));
await win.locator('.sts-subtabs [data-id="package"]').click();
check("Package tab: relationships", ((await win.locator(".sts-panel").textContent()) ?? "").includes("Needs libWrapper"));
await shot("02-panel-package");
await win.locator('.sts-subtabs [data-id="library"]').click();
const before = await card("modular-av").boundingBox();
const wide = (await win.boundingBox()).width;
await win.locator('[data-action="closePanel"]').click();
check("x closes the panel", (await win.locator(".sts-panel").count()) === 0);
const after = await card("modular-av").boundingBox();
check("closing the panel moves no card", before.x === after.x && before.width === after.width);
check("the window narrows by the panel's width", wide - (await win.boundingBox()).width > 300);
check("the tools row still fits the narrower window", await win.locator(".stc-tools").evaluate((el) => el.scrollWidth <= el.clientWidth));
await card("modular-av").locator(".t").click();
const reopened = await card("modular-av").boundingBox();
check("opening it again moves no card either", reopened.x === after.x && reopened.width === after.width);
await win.locator('[data-action="closePanel"]').click();
await shot("03-panel-closed");

// Folding, search
await win.locator('.stc-head[data-id="combat"]').click();
check("folding hides a section's cards", (await win.locator('.stc-sec[data-group="combat"] .stw-card').count()) === 0);
await win.locator('.stc-head[data-id="combat"]').click();
await win.locator("#module-search").fill("heavy");
check("search finds tags", (await win.locator(".stw-card").count()) === 3);
await win.locator("#module-search").fill("laptop");
check("search finds notes", (await win.locator(".stw-card").count()) === 1);
await win.locator("#module-search").fill("");

// Group by
const groupBy = (v) => win.locator('select[name="groupBy"]').selectOption(v);
await groupBy("tag");
check("group by tag: a section per tag, then Untagged", (await win.locator(".stc-sec").count()) === 5 && ((await win.locator(".stc-sec").last().textContent()) ?? "").includes("Untagged"));
check("group by tag: a module shows under each of its tags", (await card("dice-so-nice").count()) === 2);
await shot("03b-group-tag");
await groupBy("author");
check("group by author: Wasp's three modules together", (await win.locator('.stc-sec[data-group="author:Wasp"] .stw-card').count()) === 3);
await groupBy("smart");
check("smart groups: Libraries, Content packs, System, Not verified", (await win.locator(".stc-sec").count()) === 4 && (await win.locator('.stc-sec[data-group="smart:library"] .stw-card').count()) === 3);
await shot("03c-group-smart");
await groupBy("folder");
check("back to folders", (await win.locator(".stc-sec").count()) === 9);

// A switch, a problem, the review
await card("modular-av").locator(".sts-switch").click();
check("a switch marks the card", ((await card("modular-av").textContent()) ?? "").includes("turns off"));
check("Changes counts it", (await changesCount()) === "Changes 1");
check("dependent cards name the problem", ((await card("modular-av-dock").textContent()) ?? "").includes("Needs Modular A/V, which is off"));
check("the pending line shows", await win.locator(".stc-pending").isVisible());
await shot("04-switched");
await win.locator('.st-seg2 [data-id="changes"]').click();
check("Changes shows only changed cards", (await win.locator(".stw-card").count()) === 1);
await win.locator('.st-seg2 [data-id="all"]').click();
await win.locator('button[type="submit"]').click();
const dlg = page.locator("dialog.stagehand-dialog");
check("saving opens the review", ((await dlg.locator(".stagehand-diff").textContent()) ?? "").includes("Turns off"));
check("the review names what still needs it", ((await dlg.locator(".stagehand-diff").textContent()) ?? "").includes("Still needed by modules that stay"));
await shot("05-review");
await dlg.locator('[data-action="apply"]').click();
check("it refuses without the dependents choice", await page.locator("#notifications .notification.warning").isVisible());
await dlg.locator('footer [data-action="cancel"]').click();
await win.locator('.stc-pending [data-action="discard"]').click();
check("Discard clears the changes", (await changesCount()) === "Changes" && (await win.locator(".stc-pending").count()) === 0);

// Add a preset
await win.locator('[data-action="addPreset"]').click();
check("Mark Changes waits for a preset", await dlg.locator('[data-action="mark"]').isDisabled());
await dlg.locator('input[value="horror"]').check();
await shot("06-preset");
await dlg.locator('[data-action="mark"]').click();
check("a preset marks its cards", ((await card("tokenmagic").textContent()) ?? "").includes("From the preset Horror ambience"));
check("its problem shows before saving", ((await card("modular-av-audio-reverb").textContent()) ?? "").includes("Needs Modular A/V: Audio mixer"));
await shot("07-preset-marked");
await win.locator('button[type="submit"]').click();
check("the review names the preset and the dependency", ((await dlg.textContent()) ?? "").includes("Horror ambience (Add)") && ((await dlg.textContent()) ?? "").includes("Added as dependencies"));
await dlg.locator('[data-action="apply"]').click();
await page.waitForSelector("#notifications .notification.info");
check("saved: notification", ((await page.locator("#notifications").textContent()) ?? "").includes("saved"));
await page.locator("#open-modules").click();
check("saved: Token Magic FX is on", await card("tokenmagic").locator(".sts-switch").isChecked());
await win.locator('[data-action="addPreset"]').click();
await dlg.locator('input[value="strahd"]').check();
await dlg.locator('[data-action="mark"]').click();
check("a module that isn't installed is named", ((await page.locator("#notifications").textContent()) ?? "").includes("Monk's Enhanced Journal"));

// Foundry's own list
await win.locator('.stw-layout [data-id="foundry"]').click();
check("Foundry's: Foundry's own rows", (await win.locator("li.package").count()) === 38 && (await win.locator(".stw-card").count()) === 0);
check("Foundry's: Foundry's Expand is there", (await win.locator('[data-action="toggleExpanded"]').count()) === 1);
await shot("08-foundrys");
await win.locator('.stw-layout [data-id="cards"]').click();
check("back to cards", (await win.locator(".stw-card").count()) === 38);

// No library, Assistant GM, player
await open("lib=0");
check("no library: Foundry's window, no switch", (await win.locator(".stw-layout, .stw-card").count()) === 0 && (await win.locator("li.package").count()) === 38);
await shot("09-no-library");
await open("role=assistant");
check("assistant: cards without Add a preset", (await win.locator(".stw-card").count()) === 38 && (await win.locator('[data-action="addPreset"]').count()) === 0);
await open("role=player");
check("player: Foundry's read-only list", (await win.locator("li.package:visible").count()) === 19 && (await win.locator("li.package input:not([disabled])").count()) === 0 && (await win.locator(".stw-card").count()) === 0);
await shot("10-player");
await open("theme=light");
await shot("11-light");

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
