// Release history on the local Foundry's Update page (package 7), with the
// extension allowed to read foundryvtt.com at install, as after the options
// page's request: Foundry's public list and a release's notes, read through
// the background. Reads foundryvtt.com (two public pages); installs nothing.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
} from "./extension.ts";
import { audit } from "./axe.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let page: Page;

const shell = (): Locator => page.locator("#ml-shell-root");

test.beforeAll(async () => {
  ext = await loadExtension(["https://foundryvtt.com/*"]);
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
});

test("Release history reads Foundry's list and the release's notes from foundryvtt.com", async () => {
  // The local server has nothing newer: Foundry's real notes, as a newer build.
  await page.route(`${env.url}/update`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    if (body.action === "previewCompatibility") return route.continue();
    if (body.action !== "updateCheck") return route.abort();
    const real = await route.fetch({
      postData: JSON.stringify({ ...body, forceUpdate: true }),
    });
    const release = (await real.json()) as Record<string, unknown>;
    return route.fulfill({ json: { ...release, build: 371, flags: {} } });
  });
  await shell().locator(".mlh-ver").click();
  await shell()
    .getByRole("region", { name: "Foundry Virtual Tabletop" })
    .getByRole("button", { name: /Update page|See what's new/ })
    .click();
  const upd = shell().locator(".mlu-page");
  await upd.getByRole("button", { name: "All release notes" }).click();
  const hist = upd.locator(".mlu-hist");
  await expect(hist.locator(".mlu-rels li").first()).toContainText(/^14\.\d+/, {
    timeout: 30_000,
  });
  await expect(
    hist.locator(".mlu-rels li", { hasText: "14.370" }),
  ).toContainText("installed");
  await expect(hist.locator(".mlu-hnotes .mlu-sec").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(hist.locator(".mlu-hhead")).toContainText(/\d+ changes/);
  await page.screenshot({ path: `${SCREENS}/server-update-history.png` });
  await audit(page, "update: release history");
  await page.unroute(`${env.url}/update`);
});
