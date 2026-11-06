// Read-only look at Foundry's Application Configuration window on the test server.
// Opens it, reads which fields show and their kinds of value, then closes it without saving.
// Never prints secrets: password fields are reported only as present or not.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../../../scripts/foundry/env.ts";
import { createAdminClient, hasActiveWorld } from "../../../scripts/foundry/admin.ts";

const OUT = new URL("../out/shots", import.meta.url).pathname;
const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) throw new Error("A world is running; leaving it alone.");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await context.request.post(`${env.url}/auth`, { form: { action: "adminAuth", adminPassword: env.adminPassword }, headers: { Origin: env.url }, maxRedirects: 0 });
const page = await context.newPage();
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => (globalThis as any).ui?.setupPackages?.rendered);
await page.evaluate(async () => { await (globalThis as any).foundry.nue.Tour.activeTour?.exit(); });
await page.evaluate(() => { document.querySelectorAll(".tour-overlay").forEach((e) => e.remove()); (document.querySelector('#setup-menu [data-action="configure"]') as HTMLElement).click(); });
await page.waitForSelector("#server-settings-config");
await page.waitForTimeout(500);
const out = await page.evaluate(() => {
  const g = (globalThis as any).game;
  const root = document.getElementById("server-settings-config")!;
  const SECRET = /password|salt/i;
  const fields = [...root.querySelectorAll("[name]")].map((el: any) => ({
    name: el.name, type: el.type ?? el.tagName.toLowerCase(),
    value: SECRET.test(el.name) ? (el.value ? "(set)" : "(empty)") : el.type === "checkbox" ? el.checked : String(el.value).slice(0, 60),
    options: el.tagName === "SELECT" ? [...el.options].map((o: any) => o.text).slice(0, 8) : undefined,
  }));
  const legends = [...root.querySelectorAll("legend")].map((l) => l.textContent?.trim());
  const buttons = [...root.querySelectorAll("[data-action]")].map((b: any) => b.dataset.action);
  const o = g.data.options;
  return { legends, fields, buttons, certificate: { managed: !!g.data.certificate?.managed, error: !!g.data.certificate?.error }, proxySSL: !!o.proxySSL,
    electron: !!globalThis.navigator.userAgent.match(/Electron/), noBackups: !!o.noBackups, updateChannel: o.updateChannel ?? g.serverSettings?.updateChannel, hostname: !!o.hostname, routePrefix: !!o.routePrefix };
});
await page.screenshot({ path: `${OUT}/live-config.png`, fullPage: true });
await page.evaluate(async () => { for (const a of [...(globalThis as any).foundry.applications.instances.values()]) if (a.id === "server-settings-config") await a.close(); });
console.log(JSON.stringify(out, null, 1));
await browser.close();
