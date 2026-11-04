// M0 spike: what does Foundry's Setup page expose to page JavaScript?
// Logs in as administrator, opens /setup and prints a summary as JSON.
import { chromium } from "@playwright/test";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const browser = await chromium.launch();
const context = await browser.newContext();

const auth = await context.request.post(`${env.url}/auth`, {
  form: { action: "adminAuth", adminPassword: env.adminPassword },
  headers: { Origin: env.url },
  maxRedirects: 0,
});
console.log("auth redirect:", auth.headers().location);

const page = await context.newPage();
await page.goto(`${env.url}/setup`);
await page.waitForFunction(() => "game" in globalThis);
await page.waitForTimeout(2000);

const summary = await page.evaluate(() => {
  const g = (globalThis as unknown as { game: Record<string, unknown> }).game;
  const keysOf = (v: unknown): string[] =>
    v && typeof v === "object" ? Object.keys(v) : [];
  const collection = (name: string) => {
    const c = g[name] as
      { size?: number; values?: () => Iterable<unknown> } | undefined;
    if (!c?.values) return { type: typeof c };
    const first = [...c.values()][0] as
      { constructor: { name: string }; toObject?: () => unknown } | undefined;
    return {
      ctor: (c as object).constructor.name,
      size: c.size,
      firstCtor: first?.constructor.name,
      first: first?.toObject ? first.toObject() : first,
    };
  };
  return {
    gameCtor: g.constructor.name,
    gameKeys: Object.keys(g),
    release: g.release,
    view: g.view,
    dataKeys: keysOf(g.data),
    modules: collection("modules"),
    worlds: collection("worlds"),
    systems: collection("systems"),
    uiKeys: keysOf((globalThis as unknown as { ui: unknown }).ui),
    bodyClasses: document.body.className,
    topIds: [...document.querySelectorAll("body [id]")]
      .slice(0, 60)
      .map((e) => `${e.tagName.toLowerCase()}#${e.id}`),
  };
});
console.log(JSON.stringify(summary, null, 2));
await page.screenshot({ path: "test-results/spike/setup.png", fullPage: true });
await browser.close();
