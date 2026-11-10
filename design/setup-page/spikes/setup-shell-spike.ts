// Throwaway spike: can our own page, drawn over Foundry V14 Setup with
// Foundry's layout hidden, still drive Foundry's own actions and dialogs?
// Run from the repo root: node <this file>. Prints JSON results; never prints secrets.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import {
  createAdminClient, hasActiveWorld, shutdownWorld,
} from "../../../scripts/foundry/admin.ts";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const WORLD = "stagehand-test";
const env = loadFoundryEnv();
const results: Record<string, unknown> = {};

const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.request.post(`${env.url}/auth`, {
  form: { action: "adminAuth", adminPassword: env.adminPassword },
  headers: { Origin: env.url }, maxRedirects: 0,
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });

// Our "page": Foundry's Setup layout hidden by CSS, a placeholder shell on top.
await page.addStyleTag({ content: `
  #setup, #setup-menu, #main-header, #watermark { display: none !important; }
  #st-shell { position: fixed; inset: 0; z-index: 0; display: grid; place-items: center;
    color: #8a8296; font: 600 22px Signika, sans-serif; background: #0e0c14; }` });
await page.evaluate(() => {
  const d = document.createElement("div");
  d.id = "st-shell"; d.textContent = "Our Setup page (placeholder)";
  document.body.prepend(d);
});

const step = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
  try { results[name] = await fn(); } catch (e) { results[name] = { error: String((e as Error).message).slice(0, 300) }; }
};
const shot = (n: string) => page.screenshot({ path: `${OUT}/spike-${n}.png` });
/** Open AppV2 windows other than Setup's own frameless parts. */
const openWindows = () => page.evaluate(() =>
  [...(globalThis as any).foundry.applications.instances.values()]
    .filter((a: any) => a.rendered && a.options.window?.frame !== false)
    .map((a: any) => ({ cls: a.constructor.name, id: a.id, title: a.title,
      visible: !!a.element?.checkVisibility?.(), rect: a.element?.getBoundingClientRect().toJSON() })));
const closeWindows = () => page.evaluate(async () => {
  for (const a of [...(globalThis as any).foundry.applications.instances.values()])
    if (a.rendered && a.options.window?.frame !== false) await a.close();
});
const waitWindow = async (cls: string, ms = 15000) => {
  await page.waitForFunction((c) => [...(globalThis as any).foundry.applications.instances.values()]
    .some((a: any) => a.constructor.name === c && a.rendered), cls, { timeout: ms });
};

// 1. Re-render while hidden
await step("rerender", () => page.evaluate(async () => {
  const g = globalThis as any;
  let n = 0;
  const id = g.Hooks.on("renderSetupPackages", () => { n += 1; });
  await g.ui.setupPackages.render();
  g.Hooks.off("renderSetupPackages", id);
  const el = document.getElementById("setup-packages")!;
  return { hookFired: n, stillHidden: !el.checkVisibility(), rendered: g.ui.setupPackages.rendered };
}));

// 2-3. Install dialog and package browser
for (const type of ["module", "system"]) {
  await step(`browse-${type}`, async () => {
    await page.evaluate((t) => { void (globalThis as any).game.browsePackages(t); }, type);
    await waitWindow("InstallPackage");
    await page.waitForFunction(() => document.querySelectorAll("#install-package .package-list li, #install-package li.package").length > 5, null, { timeout: 45000 }).catch(() => undefined);
    const count = await page.evaluate(() => document.querySelectorAll("#install-package .package-list li, #install-package li.package").length);
    await shot(`install-${type}`);
    const w = await openWindows();
    await closeWindows();
    return { listed: count, windows: w };
  });
}

// 4. Dry update check for one installed package with a manifest
await step("checkPackage", () => page.evaluate(async () => {
  const g = globalThis as any;
  const pkg = [...g.game.modules.values()].find((m: any) => m.manifest) ?? [...g.game.systems.values()].find((s: any) => s.manifest);
  if (!pkg) return { skipped: "no package with a manifest" };
  const r = await g.game.checkPackage({ type: pkg.type, id: pkg.id });
  return { id: pkg.id, type: pkg.type, keys: Object.keys(r ?? {}), version: r?.remote?.version ?? r?.version };
}));

// 5. Edit world (WorldConfig), cancel
await step("worldConfig", async () => {
  const cls = await page.evaluate((id) => {
    const g = globalThis as any;
    const C = g.foundry.applications.sidebar?.apps?.WorldConfig;
    if (!C) return "missing";
    new C({ world: g.game.worlds.get(id) }).render({ force: true });
    return "foundry.applications.sidebar.apps.WorldConfig";
  }, WORLD);
  await waitWindow("WorldConfig");
  await page.waitForTimeout(500);
  await shot("world-config");
  const w = await openWindows(); await closeWindows();
  return { cls, windows: w };
});

// 6. Create world route
await step("createWorld", async () => {
  const route = await page.evaluate(() => (globalThis as any).foundry.utils.getRoute("/create"));
  const r = await context.request.get(`${env.url}${route}`, { maxRedirects: 0 });
  return { route, status: r.status(), note: "SetupPackages.#createWorld navigates to /create (a separate Foundry view)" };
});

// 7. Foundry's ContextMenu on a hidden card
await step("contextMenuHidden", async () => {
  const opened = await page.evaluate((id) => {
    const li = document.querySelector(`#worlds-list li[data-package-id="${id}"]`)!;
    li.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 600, clientY: 400, button: 2 }));
    const m = document.getElementById("context-menu");
    return { menu: !!m, visible: !!m?.checkVisibility(), rect: m?.getBoundingClientRect().toJSON(),
      items: [...(m?.querySelectorAll(".context-item") ?? [])].map((e) => e.textContent?.trim()) };
  }, WORLD);
  await page.waitForTimeout(300);
  await shot("context-menu-hidden-card");
  await page.mouse.click(5, 5);
  return opened;
});

// 8. Favourite and lock, through the private handlers via Foundry's own menu (then restored)
const menuClick = (sel: string, label: string) => page.evaluate(([s, l]) => {
  const li = document.querySelector(s)!;
  li.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 600, clientY: 400, button: 2 }));
  const item = [...document.querySelectorAll("#context-menu .context-item")].find((e) => e.textContent?.trim().startsWith(l)) as HTMLElement | undefined;
  if (!item) return false;
  item.click();
  return true;
}, [sel, label]);
await step("favourite", async () => {
  const sel = '#modules-list li[data-package-id="st-fixture-b"]';
  const before = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").favorite);
  const a = await menuClick(sel, before ? "Unmark" : "Mark Favorite");
  await page.waitForTimeout(800);
  const mid = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").favorite);
  const b = await menuClick(sel, mid ? "Unmark" : "Mark Favorite");
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").favorite);
  return { clicked: [a, b], before, mid, after };
});
await step("lock", async () => {
  const sel = '#modules-list li[data-package-id="st-fixture-b"]';
  const before = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").locked);
  const a = await menuClick(sel, before ? "Unlock" : "Lock");
  await page.waitForTimeout(1000);
  const mid = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").locked);
  const b = await menuClick(sel, mid ? "Unlock" : "Lock");
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => (globalThis as any).game.modules.get("st-fixture-b").locked);
  return { clicked: [a, b], before, mid, after };
});

// 9. Uninstall: open the confirmation only, then dismiss it
await step("uninstallConfirm", async () => {
  await page.evaluate(() => { const g = globalThis as any; void g.game.uninstallPackage(g.game.modules.get("st-fixture-b")); });
  await waitWindow("DialogV2");
  await page.waitForTimeout(300);
  await shot("uninstall-confirm");
  const w = await openWindows();
  await page.evaluate(() => {
    const d = [...(globalThis as any).foundry.applications.instances.values()].find((a: any) => a.constructor.name === "DialogV2");
    (d.element.querySelector('[data-action="no"]') as HTMLElement).click();
  });
  await page.waitForTimeout(500);
  const still = await page.evaluate(() => !!(globalThis as any).game.modules.get("st-fixture-b"));
  return { windows: w, moduleStillInstalled: still };
});

// 10. Backups: take-backup dialog (cancel), Backup manager via hidden menu button
await step("backupDialog", async () => {
  await page.evaluate((id) => { const g = globalThis as any; void g.game.createBackup(g.game.worlds.get(id), { dialog: true }); }, WORLD);
  await waitWindow("DialogV2");
  await page.waitForTimeout(300);
  await shot("take-backup");
  const w = await openWindows();
  await page.evaluate(() => {
    const d = [...(globalThis as any).foundry.applications.instances.values()].find((a: any) => a.constructor.name === "DialogV2");
    return d.close();
  });
  return { windows: w };
});
await step("backupManager", async () => {
  await page.evaluate(() => (document.querySelector('#setup-menu [data-action="backups"]') as HTMLElement).click());
  await waitWindow("BackupManager");
  await page.waitForTimeout(800);
  await shot("backup-manager");
  const w = await openWindows(); await closeWindows();
  return { windows: w };
});
await step("backupList", async () => {
  const ok = await menuClick(`#worlds-list li[data-package-id="${WORLD}"]`, "Manage Backups");
  await waitWindow("BackupList");
  await page.waitForTimeout(500);
  const w = await openWindows(); await closeWindows();
  return { clicked: ok, windows: w };
});

// 11. Setup menu: configuration and warnings (no logout, shutdown or update navigation)
await step("setupMenu", async () => {
  const actions = await page.evaluate(() => [...document.querySelectorAll("#setup-menu [data-action]")].map((b) => (b as HTMLElement).dataset.action));
  await page.evaluate(() => (document.querySelector('#setup-menu [data-action="configure"]') as HTMLElement).click());
  await waitWindow("ServerSettingsConfig");
  await page.waitForTimeout(500);
  await shot("server-config");
  const conf = await openWindows(); await closeWindows();
  let warnings: unknown = "no warnings button";
  if (actions.includes("viewWarnings")) {
    await page.evaluate(() => (document.querySelector('#setup-menu [data-action="viewWarnings"]') as HTMLElement).click());
    await waitWindow("SetupWarnings").catch(() => undefined);
    await page.waitForTimeout(500);
    warnings = await openWindows(); await closeWindows();
  }
  const update = await page.evaluate(() => (globalThis as any).foundry.utils.getRoute("update"));
  return { actions, conf, warnings, updateRoute: update };
});

// 12. Notifications and a tour over our page
await step("notification", async () => {
  await page.evaluate(() => (globalThis as any).ui.notifications.info("Spike: a Foundry notification over our page"));
  await page.waitForTimeout(600);
  await shot("notification");
  return page.evaluate(() => ({ visible: !!document.querySelector("#notifications .notification")?.checkVisibility() }));
});
await step("tour", async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis as any;
    const ids = [...g.game.tours.keys()];
    const t = g.game.tours.get("core.backupsOverview") ?? g.game.tours.get("core.setup");
    if (!t) return { ids };
    try { await t.reset?.(); await t.start(); } catch (e) { return { ids, error: String(e) }; }
    await new Promise((r) => setTimeout(r, 800));
    const tip = document.querySelector("#tooltip.tour, .tour-overlay, #tour-fadeout, aside.tour");
    return { ids, started: t.id, step: t.currentStep?.id, target: t.currentStep?.selector,
      targetVisible: !!document.querySelector(t.currentStep?.selector ?? "#none")?.checkVisibility(),
      tipVisible: !!tip?.checkVisibility() };
  });
  await shot("tour");
  await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
  return r;
});

// 13. Launch through the hidden world card's own button, then shut down again
await step("launch", async () => {
  await page.evaluate((id) => (document.querySelector(`#worlds-list li[data-package-id="${id}"] [data-action="worldLaunch"]`) as HTMLElement).click(), WORLD);
  await page.waitForURL(/\/(game|join)/, { timeout: 120000 });
  const url = page.url();
  await shutdownWorld(api, env.adminPassword);
  return { reached: new URL(url).pathname, shutDown: !(await hasActiveWorld(api)) };
});

results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
await api.dispose();
