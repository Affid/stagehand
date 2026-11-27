// Package updates on the local Foundry (docs/UPDATES-PLAN.md), with fixture
// packages whose newer manifests and zips a local server serves
// (scripts/foundry/update-fixtures.ts), so Foundry's own check and install
// run end to end.
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  installFixtures,
  removeFixtures,
  startUpdateServer,
  type UpdateServer,
} from "../../scripts/foundry/update-fixtures.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
let server: UpdateServer;
let admin: APIRequestContext;
let ext: Target;
let page: Page;

const shell = (): Locator => page.locator("#st-shell-root");
const card = (id: string): Locator =>
  shell().locator(`.stl-card[data-module="${id}"]`);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  server = await startUpdateServer();
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  await shutdownWorld(admin, env.adminPassword);
  installFixtures(env.dataDir, server.base);
  await setupPost(admin, { action: "resetPackages" });
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
});

test.afterAll(async () => {
  await ext.close();
  removeFixtures(env.dataDir);
  await setupPost(admin, { action: "resetPackages" }).catch(() => undefined);
  await admin.dispose();
  await server.close();
});

test("phase 1: Foundry's own update shows its progress on the card, the panel and the rail", async () => {
  const plain = card("st-upd-plain");
  await plain.getByRole("button", { name: /Updates fixture: plain/ }).click();
  const panel = shell().getByRole("complementary", {
    name: /Updates fixture: plain/,
  });
  await panel.getByRole("tab", { name: "Package" }).click();
  await panel.getByRole("button", { name: "Update if available" }).click();
  // The download is spread over 3 seconds: its percentage shows on the chip.
  const chip = plain.locator(".spu-chip");
  await expect(chip).toHaveText(/^\d+%$/, { timeout: 15_000 });
  await expect(shell().locator(".sts-lib > span")).toHaveText(
    "Updating Updates fixture: plain…",
  );
  await expect(
    panel.getByRole("button", { name: /^Updating… \d+%$|^Installing…$/ }),
  ).toBeDisabled();
  await page.screenshot({ path: `${SCREENS}/updates-phase1-progress.png` });
  // Done: the chip goes and the card shows the new version.
  await expect(chip).toHaveCount(0, { timeout: 20_000 });
  await expect(plain).toContainText("v1.1.0", { timeout: 10_000 });
  await expect(shell().locator(".sts-lib > span")).not.toContainText(
    "Updating",
  );
});
