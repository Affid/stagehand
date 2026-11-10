// Dev aid: on an older Foundry build (one with a newer release out), opens
// the Update page with the built extension, logs what Foundry's /update
// route answers (never the download link) and saves screenshots to
// test-results/screens/. Foundry must be running on Setup, without
// --noupdate. Nothing is installed: the probe never presses Update.
import {
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const env = loadFoundryEnv();
const ext = await loadExtension();
const page = await ext.context.newPage();
await page.setViewportSize({ width: 1366, height: 900 });
page.on("console", (m) => {
  if (m.type() === "error") console.log(`[page error] ${m.text()}`);
});
page.on("response", (r) => {
  if (!r.url().endsWith("/update")) return;
  const action = (
    JSON.parse(r.request().postData() ?? "{}") as { action?: string }
  ).action;
  void r
    .json()
    .then((body: Record<string, unknown>) => {
      // Never the signed download link, nor any link with a query.
      const brief = JSON.stringify(body, (k, v: unknown) => {
        if (k === "download") return undefined;
        if (typeof v !== "string") return v;
        const safe = v.replace(/https?:\/\/[^\s"']*\?[^\s"']*/g, "[link]");
        return safe.length > 120 ? `${safe.slice(0, 120)}…` : safe;
      });
      console.log(
        `[/update ${action ?? "?"}] ${String(r.status())} ${brief.slice(0, 1500)}`,
      );
    })
    .catch(() => undefined);
});
await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
const shell = page.locator("#st-shell-root");
await shell.locator(".sth-ver").click();
await page.screenshot({ path: "test-results/screens/older-version-menu.png" });
await shell
  .getByRole("region", { name: "Foundry Virtual Tabletop" })
  .getByRole("button", { name: /Update page|See what's new/ })
  .click();
const upd = shell.locator(".stu-page");
await upd.waitFor();
await page.waitForTimeout(15_000);
console.log(`[page text] ${(await upd.innerText()).slice(0, 1500)}`);
await page.screenshot({ path: "test-results/screens/older-update.png" });
await upd
  .getByRole("tab", { name: /Your packages/ })
  .click()
  .catch(() => undefined);
await page.waitForTimeout(3_000);
await page.screenshot({ path: "test-results/screens/older-compat.png" });
await ext.context.close();
