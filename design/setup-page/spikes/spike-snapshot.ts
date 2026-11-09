// Live check of Foundry's snapshot and backup dialogs on the test server.
// Creates one snapshot through Foundry's own dialog, opens the restore dialogs and cancels them,
// then deletes the snapshot through Foundry's own confirm-code dialog. No restore is ever confirmed.
// Run from the repo root with the server up and no world running. Never prints secrets.
import { chromium, type Page } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import { createAdminClient, hasActiveWorld } from "../../../scripts/foundry/admin.ts";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const NOTE = "Stagehand spike: safe to delete";
const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await context.request.post(`${env.url}/auth`, {
  form: { action: "adminAuth", adminPassword: env.adminPassword },
  headers: { Origin: env.url }, maxRedirects: 0,
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
const out: Record<string, unknown> = {};

/** The open window of a class, or null. */
const openApp = (p: Page, cls: string) => p.evaluate((c) => {
  const app = [...(globalThis as any).foundry.applications.instances.values()].find((a: any) => a.constructor.name === c && a.rendered);
  return app ? { id: app.id, title: app.title, text: (app.element as HTMLElement).innerText.replace(/\s+/g, " ").trim() } : null;
}, cls);
const waitApp = (cls: string, ms = 20000) => page.waitForFunction((c) => [...(globalThis as any).foundry.applications.instances.values()]
  .some((a: any) => a.constructor.name === c && a.rendered), cls, { timeout: ms });
const shot = (n: string) => page.screenshot({ path: `${OUT}/live-${n}.png` });
const listBackups = () => page.evaluate(async () => {
  const all = await (globalThis as any).game.listBackups();
  const counts = Object.fromEntries(["world", "module", "system"].map((t) => [t, Object.values(all?.[t] ?? {}).flat().length]));
  const snaps = Object.values(all?.snapshots ?? {}).map((s: any) => ({ id: s.id, note: s.note, generation: s.generation, build: s.build, size: s.size, backups: [...s.backups].length, createdAt: s.createdAt }));
  return { counts, snaps };
});

out.before = await listBackups();

// 1. "Create a snapshot": Foundry's dialog, then create it, logging the progress Foundry sends.
await page.evaluate(() => {
  const g = (globalThis as any).game;
  (globalThis as any).__progress = [];
  g.socket?.on?.("progress", (d: any) => (globalThis as any).__progress.push({ action: d.action, step: d.step, pct: d.pct, type: d.type, title: d.title }));
  (globalThis as any).__snap = g.createSnapshot({ dialog: true });
});
await waitApp("SnapshotOperationDialog");
await page.waitForFunction(() => /available/i.test(document.querySelector(".snapshot-dialog")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(400);
out.createDialog = await openApp(page, "SnapshotOperationDialog");
out.lockedWhileAsking = await page.evaluate(() => !!document.querySelector("#setup-packages [disabled], #setup-packages .locked"));
await shot("1-create-dialog");
await page.fill(".snapshot-dialog input[name=note], .snapshot-dialog textarea[name=note]", NOTE).catch(() => {});
const started = Date.now();
await page.click(".snapshot-dialog button[type=submit]");
await page.waitForTimeout(300);
await shot("2-create-progress");
await page.evaluate(() => (globalThis as any).__snap);
out.createSeconds = Math.round((Date.now() - started) / 100) / 10;
out.progress = await page.evaluate(() => {
  const p = (globalThis as any).__progress as any[];
  const steps = [...new Set(p.map((x) => `${x.action}:${x.step}`))];
  return { messages: p.length, steps, sample: p.slice(0, 3) };
});
out.notifications = await page.evaluate(() => [...document.querySelectorAll("#notifications .notification")].map((n) => n.textContent?.trim()).slice(-3));
out.after = await listBackups();

// 2a. Restore the whole snapshot: open Foundry's dialog, read it, cancel.
const snapId = (out.after as any).snaps.find((s: any) => s.note === NOTE)?.id;
if (!snapId) throw new Error("The new snapshot was not found.");
await page.evaluate((id) => { const g = (globalThis as any).game; (globalThis as any).__restoreSnap = g.restoreSnapshot(g.backupsCache.snapshots[id], { dialog: true }); }, snapId);
await waitApp("SnapshotOperationDialog");
await page.waitForFunction(() => /available/i.test(document.querySelector(".snapshot-dialog")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(400);
out.restoreSnapshotDialog = await openApp(page, "SnapshotOperationDialog");
out.restoreSnapshotHasCode = await page.evaluate(() => !!document.querySelector(".snapshot-dialog input[name=confirmCode], .snapshot-dialog [name*=onfirm]"));
await shot("3-restore-snapshot-dialog");
await page.click('.snapshot-dialog [data-action="cancel"]');
await page.evaluate(() => (globalThis as any).__restoreSnap);

// 2b. Restore one world backup (a member of the snapshot): open Foundry's dialog, read it, cancel.
await page.evaluate(() => {
  const g = (globalThis as any).game;
  const b = Object.values(g.backupsCache.world ?? {}).flat()[0] as any;
  (globalThis as any).__restoreBackup = g.restoreBackup(b, { dialog: true });
});
await waitApp("DialogV2");
await page.waitForTimeout(300);
out.restoreBackupDialog = await openApp(page, "DialogV2");
await shot("4-restore-backup-dialog");
await page.click('dialog.application [data-action="no"]');
await page.evaluate(() => (globalThis as any).__restoreBackup);

// 3. Delete the snapshot through Foundry's confirm-code dialog.
await page.evaluate((id) => { (globalThis as any).__del = (globalThis as any).game.deleteSnapshots([id], { dialog: true }); }, snapId);
await waitApp("DialogV2");
await page.waitForTimeout(300);
out.deleteDialog = await openApp(page, "DialogV2");
await shot("5-delete-dialog");
const code = await page.textContent("#confirm-code .reference");
await page.fill("#delete-confirm", code ?? "");
await page.click('dialog.application [data-action="yes"]');
await page.evaluate(() => (globalThis as any).__del);
out.afterDelete = await listBackups();

out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
