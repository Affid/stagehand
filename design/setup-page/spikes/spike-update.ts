// Read-only look at Foundry's update flow on the test server: checks for an update (force mode returns the
// current release's data and notes), opens the Release Notes window and the compatibility preview, closes them.
// Never downloads: the server runs with --noupdate and the download step is never sent. Never prints secrets.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import { createAdminClient, hasActiveWorld } from "../../../scripts/foundry/admin.ts";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await context.request.post(`${env.url}/auth`, { form: { action: "adminAuth", adminPassword: env.adminPassword }, headers: { Origin: env.url }, maxRedirects: 0 });
const page = await context.newPage();
await page.goto(`${env.url}/update`);
await page.waitForFunction(() => (globalThis as any).ui?.setupUpdate?.rendered, null, { timeout: 20000 });
await page.screenshot({ path: `${OUT}/live-update-page.png` });
const out: Record<string, unknown> = {};
out.coreUpdate = await page.evaluate(() => { const c = (globalThis as any).game.data.coreUpdate; return { hasUpdate: c.hasUpdate, canUpdate: c.canUpdate, couldReachWebsite: c.couldReachWebsite, channel: c.channel, version: c.version }; });
out.page = await page.evaluate(() => document.getElementById("setup-update")?.innerText.replace(/\s+/g, " ").slice(0, 900));
// The check itself, as Foundry's form sends it, with force so a current release is returned.
const check = await page.evaluate(async () => {
  const g = (globalThis as any).game;
  try {
    const r = await g.post({ action: "updateCheck", updateChannel: "stable", forceUpdate: true }, { notify: false });
    const rel = r.info || r.warn ? null : new (globalThis as any).foundry.config.ReleaseData(r);
    return { info: r.info ?? null, warn: r.warn ?? null, keys: Object.keys(r).sort(), display: rel?.display, version: rel?.version, channel: rel?.channel, manual: rel?.requiresManualInstall, flags: rel?.flags, notesLength: rel?.notes?.length ?? 0, notes: rel?.notes ?? "" };
  } catch (e) { return { error: String((e as Error).message).slice(0, 200) }; }
});
writeFileSync(new URL("../out/release-notes-sample.html", import.meta.url), String((check as any).notes ?? ""));
out.check = { ...(check as any), notes: undefined };
// Foundry's own Release Notes window for that release.
if ((check as any).version) {
  await page.evaluate(async () => {
    const g = (globalThis as any).game;
    const r = await g.post({ action: "updateCheck", updateChannel: "stable", forceUpdate: true }, { notify: false });
    const rel = new (globalThis as any).foundry.config.ReleaseData(r);
    const { UpdateNotes } = (globalThis as any).foundry.applications.setup ?? {};
    const Cls = UpdateNotes ?? [...(globalThis as any).foundry.applications.instances.values()].find(() => false);
    if (Cls) { (globalThis as any).ui.updateNotes = new Cls({ release: rel }); await (globalThis as any).ui.updateNotes.render({ force: true }); }
    (globalThis as any).__rel = rel;
  });
  await page.waitForTimeout(800);
  out.notesWindow = await page.evaluate(() => { const el = document.getElementById("update-notes"); return el ? { title: el.querySelector(".window-title")?.textContent, footer: el.querySelector("footer.hints")?.textContent?.replace(/\s+/g, " ").trim(), buttons: [...el.querySelectorAll("footer.form-footer button")].map((b) => b.textContent?.trim() + (b.disabled ? " (disabled)" : "")) } : "UpdateNotes class not reachable"; });
  await page.screenshot({ path: `${OUT}/live-release-notes.png` });
  // The compatibility preview the window offers (a read-only server request).
  out.compat = await page.evaluate(async () => {
    const p = await (globalThis as any).game.previewCompatibility((globalThis as any).__rel);
    if (!p) return null;
    const sum = (o: any) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]: any) => [k, Array.isArray(v) ? v.length : typeof v === "object" ? Object.keys(v).length : v]));
    return { keys: Object.keys(p), summary: Object.fromEntries(Object.entries(p).map(([k, v]: any) => [k, typeof v === "object" ? sum(v) : v])) };
  });
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
