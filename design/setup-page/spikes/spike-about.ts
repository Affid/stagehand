// Read-only spike: what Foundry 14.370 offers for a world's About and Backups.
// Opens dialogs and reads them; never confirms, submits or changes anything. Never prints secrets.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import { createAdminClient, hasActiveWorld } from "../../../scripts/foundry/admin.ts";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const WORLD = "module-library-test";
const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.request.post(`${env.url}/auth`, { form: { action: "adminAuth", adminPassword: env.adminPassword }, headers: { Origin: env.url }, maxRedirects: 0 });
const page = await context.newPage();
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
const out: Record<string, unknown> = {};

// 1. World data the Setup page holds (no secrets in it, but print only the keys and a few safe values).
out.worldFields = await page.evaluate((id) => {
  const w = (globalThis as any).game.worlds.get(id);
  const s = w.toObject();
  return { keys: Object.keys(s).sort(), coreVersion: s.coreVersion, compatibility: s.compatibility, lastPlayed: s.lastPlayed, nextSession: s.nextSession, hasBackground: !!s.background, playersField: "users" in s ? "present" : "absent" };
}, WORLD);

// 2. Backups listing: shape of one entry.
out.backups = await page.evaluate(async (id) => {
  const all = await (globalThis as any).game.listBackups();
  const worlds = all?.world ?? {};
  const mine = worlds[id] ?? [];
  const any = Object.values(worlds).flat()[0] ?? null;
  return { worldsWithBackups: Object.keys(worlds).length, mineCount: mine.length, sampleKeys: any ? Object.keys(any).sort() : [], sample: any ? Object.fromEntries(Object.entries(any).filter(([k]) => ["type","packageId","createdAt","size","coreVersion","systemVersion","note","title","id"].includes(k))) : null };
}, WORLD);

// 3. World configuration window: which fields it offers (then close without saving).
out.worldConfig = await page.evaluate(async (id) => {
  const { WorldConfig } = (globalThis as any).foundry.applications.sidebar.apps;
  const app = new WorldConfig({ world: (globalThis as any).game.worlds.get(id) });
  await app.render({ force: true });
  const names = [...app.element.querySelectorAll("[name]")].map((e: any) => e.name);
  const resetLabel = app.element.querySelector('[name="resetKeys"]')?.closest(".form-group")?.querySelector("label")?.textContent?.trim() ?? null;
  return { names, resetLabel, app };
}, WORLD).then((r: any) => ({ names: r.names, resetLabel: r.resetLabel }));
await page.screenshot({ path: `${OUT}/spike-world-config-370.png` });
await page.evaluate(async () => { for (const a of [...(globalThis as any).foundry.applications.instances.values()]) if (a.rendered && a.options.window?.frame !== false) await a.close(); });

// 4. Backup list window for this world: per-backup actions it renders.
out.backupList = await page.evaluate(async (id) => {
  const pkg = (globalThis as any).game.worlds.get(id);
  const cls = [...(globalThis as any).foundry.applications.instances.values()].find(() => false);
  return { note: "BackupList is module-private; opened through the card menu below", pkg: !!pkg, cls };
}, WORLD);
const card = page.locator(`#setup-packages li.package[data-package-id="${WORLD}"]`);
if (await card.count()) {
  await page.evaluate((id) => { document.querySelector(`li.package[data-package-id="${id}"]`)?.closest(".tab")?.classList.add("active"); }, WORLD);
  await page.evaluate((id) => { const li = document.querySelector(`li.package[data-package-id="${id}"]`)!; const r = li.getBoundingClientRect(); li.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 })); }, WORLD);
  await page.waitForTimeout(400);
  out.menu = await page.evaluate(() => [...document.querySelectorAll("#context-menu .context-item")].map((e) => e.textContent?.trim()));
  const manage = page.locator("#context-menu .context-item", { hasText: /Manage Backups/i });
  if (await manage.count()) {
    await manage.first().click(); await page.waitForTimeout(800);
    out.backupListActions = await page.evaluate(() => {
      const app = [...(globalThis as any).foundry.applications.instances.values()].find((a: any) => a.constructor.name === "BackupList" && a.rendered);
      if (!app) return null;
      return { entries: app.element.querySelectorAll("[data-entry]").length, actions: [...new Set([...app.element.querySelectorAll("[data-action]")].map((e: any) => e.dataset.action))] };
    });
    await page.screenshot({ path: `${OUT}/spike-backup-list-370.png` });
  }
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
