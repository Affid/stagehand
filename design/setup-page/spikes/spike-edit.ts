// Spike: edit one world field without Foundry's World Configuration window.
// Changes nextSession on the test world and restores it. Checks the editor and file picker exist. Never prints secrets.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import { createAdminClient, hasActiveWorld } from "../../../scripts/foundry/admin.ts";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const WORLD = "module-library-test";
const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");
const worldJson = () => JSON.parse(readFileSync(`${homedir()}/foundry/data/Data/worlds/${WORLD}/world.json`, "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.request.post(`${env.url}/auth`, { form: { action: "adminAuth", adminPassword: env.adminPassword }, headers: { Origin: env.url }, maxRedirects: 0 });
const page = await context.newPage();
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
const out: Record<string, unknown> = {};
let before: unknown;
try { before = worldJson().nextSession ?? null; out.fileBefore = before; } catch (e) { out.fileRead = String(e).slice(0, 120); }

// 1. Validate like WorldConfig, then post one field.
out.edit = await page.evaluate(async (id) => {
  const g = (globalThis as any).game;
  const world = g.worlds.get(id);
  const changes = { id, nextSession: "2026-11-10T18:00:00.000Z" };
  world.validate({ changes, clean: true });
  const res = await g.post({ action: "editWorld", ...changes });
  const data = await res;
  world.updateSource(data);
  await (globalThis as any).ui.setupPackages.render();
  return { returnedNext: data?.nextSession ?? null, clientNext: world.nextSession, otherFieldsKept: data?.title === world.title && !!data?.system };
}, WORLD);
try { out.fileAfter = worldJson().nextSession ?? null; } catch { /* path differs */ }

// 2. A bad value is rejected before it is sent.
out.validation = await page.evaluate((id) => {
  const world = (globalThis as any).game.worlds.get(id);
  try { world.validate({ changes: { id, title: "" }, clean: true }); return "accepted (unexpected)"; } catch (e) { return `rejected: ${String((e as Error).message).split("\n")[0].slice(0, 120)}`; }
}, WORLD);

// 3. Restore the original value.
out.restore = await page.evaluate(async ([id, prev]) => {
  const g = (globalThis as any).game;
  const data = await g.post({ action: "editWorld", id, nextSession: prev });
  g.worlds.get(id).updateSource(data);
  return data?.nextSession ?? null;
}, [WORLD, before ?? null] as const);
try { out.fileRestored = worldJson().nextSession ?? null; } catch { /* ignore */ }

// 4. Foundry's own editor and file picker on the Setup page.
out.pieces = await page.evaluate(async () => {
  const f = (globalThis as any).foundry;
  const pm = f.applications.elements.HTMLProseMirrorElement;
  let editor = "missing";
  if (pm) { const el = pm.create({ name: "description", value: "<p>Test</p>", toggled: false }); document.body.append(el); await new Promise((r) => setTimeout(r, 300)); editor = el.querySelector(".ProseMirror") ? "renders" : "element only"; el.remove(); }
  const FP = f.applications.apps.FilePicker?.implementation ?? f.applications.apps.FilePicker;
  let picker = "missing";
  if (FP) { const fp = new FP({ type: "image", current: "", callback: () => {} }); await fp.render({ force: true }); await new Promise((r) => setTimeout(r, 800)); picker = fp.rendered ? `renders (${fp.element.querySelectorAll("[data-path]").length} entries)` : "no render"; }
  return { editor, picker };
});
await page.screenshot({ path: `${OUT}/spike-file-picker-370.png` });
console.log(JSON.stringify(out, null, 2));
await browser.close();
