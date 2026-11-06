// Spike part 2: Foundry's ContextMenu on hidden cards (async), favourite, lock, uninstall confirm, backup list.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
const OUT = new URL("../out/shots", import.meta.url).pathname;
const env = loadFoundryEnv();
const R: Record<string, unknown> = {};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.request.post(`${env.url}/auth`, { form: { action: "adminAuth", adminPassword: env.adminPassword }, headers: { Origin: env.url }, maxRedirects: 0 });
const page = await context.newPage();
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
await page.addStyleTag({ content: "#setup, #setup-menu, #main-header, #watermark { display: none !important; }" });
const mod = (id: string) => page.evaluate((i) => { const m = (globalThis as any).game.modules.get(i); return m ? { favorite: !!m.favorite, locked: !!m.locked } : null; }, id);
const openMenu = async (sel: string) => {
  await page.evaluate((s) => {
    document.querySelector(s)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 640, clientY: 360, button: 2 }));
  }, sel);
  await page.waitForFunction(() => document.querySelectorAll("#context-menu .context-item").length > 0, null, { timeout: 5000 });
  return page.evaluate(() => {
    const m = document.getElementById("context-menu")!;
    return { items: [...m.querySelectorAll(".context-item")].map((e) => e.textContent!.trim()), rect: m.getBoundingClientRect().toJSON() };
  });
};
const clickItem = (label: string) => page.evaluate((l) => {
  const it = [...document.querySelectorAll("#context-menu .context-item")].find((e) => e.textContent!.trim() === l) as HTMLElement | undefined;
  it?.click(); return !!it;
}, label);
const settle = () => page.waitForTimeout(1200);
const step = async (n: string, f: () => Promise<unknown>) => { try { R[n] = await f(); } catch (e) { R[n] = { error: String((e as Error).message).slice(0, 300) }; } };

await step("worldMenu", async () => { const m = await openMenu('#worlds-list li[data-package-id="module-library-test"]'); await page.screenshot({ path: `${OUT}/spike-context-menu-hidden-card.png` }); await page.keyboard.press("Escape"); await page.mouse.click(5, 5); return m; });
await step("favourite", async () => {
  const sel = '#modules-list li[data-package-id="ml-fixture-b"]';
  const before = await mod("ml-fixture-b");
  await openMenu(sel); const a = await clickItem("Mark Favorite"); await settle();
  const mid = await mod("ml-fixture-b");
  await openMenu(sel); const b = await clickItem(mid?.favorite ? "Unmark Favorite" : "Mark Favorite"); await settle();
  return { a, b, before, mid, after: await mod("ml-fixture-b") };
});
await step("lock", async () => {
  const sel = '#modules-list li[data-package-id="ml-fixture-b"]';
  const before = await mod("ml-fixture-b");
  const m1 = await openMenu(sel); const lockLabel = m1.items.find((t) => /^Lock/.test(t))!; const a = await clickItem(lockLabel); await settle();
  const mid = await mod("ml-fixture-b");
  const m2 = await openMenu(sel); const unl = m2.items.find((t) => /^Unlock/.test(t))!; const b = await clickItem(unl); await settle();
  return { labels: [lockLabel, unl], a, b, before, mid, after: await mod("ml-fixture-b") };
});
await step("uninstallConfirm", async () => {
  if ((await mod("ml-fixture-b"))?.locked) return { skipped: "locked" };
  await page.evaluate(() => { const g = (globalThis as any); void g.game.uninstallPackage(g.game.modules.get("ml-fixture-b")); });
  await page.waitForSelector(".application.dialog", { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/spike-uninstall-confirm.png` });
  const title = await page.evaluate(() => document.querySelector(".application.dialog .window-title")?.textContent);
  await page.click('.application.dialog [data-action="no"]');
  await settle();
  return { title, stillInstalled: !!(await mod("ml-fixture-b")) };
});
await step("backupList", async () => {
  await openMenu('#worlds-list li[data-package-id="module-library-test"]');
  const ok = await clickItem("Manage Backups");
  await page.waitForFunction(() => [...(globalThis as any).foundry.applications.instances.values()].some((a: any) => a.constructor.name === "BackupList" && a.rendered), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/spike-backup-list.png` });
  return { ok };
});
await step("installCount", async () => {
  await page.evaluate(() => { void (globalThis as any).game.browsePackages("module"); });
  await page.waitForFunction(() => document.querySelectorAll("#install-package .package").length > 10, null, { timeout: 45000 });
  return page.evaluate(() => document.querySelectorAll("#install-package .package").length);
});
console.log(JSON.stringify(R, null, 2));
await browser.close();
