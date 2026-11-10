// Dev aid: prints how Foundry lays out the modules tab around our root.
import { addServer, loadExtension } from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await addServer(ext, page, env.url);
await ext.context.request.post(`${env.url}/auth`, {
  form: { action: "adminAuth", adminPassword: env.adminPassword },
  headers: { Origin: env.url },
  maxRedirects: 0,
});
await page.goto(`${env.url}/setup`);
await page.locator("#st-modules-root").waitFor({ state: "attached" });
const info = await page.evaluate(() =>
  [
    "#setup-packages",
    "#setup-packages-modules",
    "#modules-list",
    "#st-modules-root",
  ].map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return `${sel}: missing`;
    const s = getComputedStyle(el);
    return `${sel}: display=${s.display} dir=${s.flexDirection} overflow=${s.overflowY} height=${s.height} flex=${s.flex}`;
  }),
);
console.log(info.join("\n"));
await ext.context.close();
