// A module update against Foundry's real package list (Phase 6 follow-up):
// an older socketlib is installed from its pinned release manifest, so
// foundryvtt.com lists a newer one. The Library card shows Update with that
// version, and pressing it runs Foundry's own update. The module is removed
// again afterwards, so the server ends as it began.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  findPackage,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
  waitFor,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { bareVersion } from "../../packages/shared/src/version.ts";
import { audit } from "./axe.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
} from "./extension.ts";

const env = loadFoundryEnv();
const ID = "socketlib";
const OLD = "1.1.2";
/** A release whose manifest pins its own zip; it supports V11 and later. */
const OLD_MANIFEST = `https://github.com/farling42/foundryvtt-socketlib/releases/download/v${OLD}/module.json`;
const folder = join(env.dataDir, "Data", "modules", ID);
const manifestFile = join(folder, "module.json");

let ext: LoadedExtension | undefined;
let admin: APIRequestContext | undefined;
let page: Page;
/** The version Foundry's package list offers. */
let latest = "";

const shell = (): Locator => page.locator("#ml-shell-root");
const card = (): Locator => shell().locator(`.mll-card[data-module="${ID}"]`);
/** The installed version; "" while missing or still being written. */
function installedVersion(): string {
  try {
    const raw = JSON.parse(readFileSync(manifestFile, "utf8")) as {
      version?: unknown;
    };
    return typeof raw.version === "string" ? raw.version : "";
  } catch {
    return "";
  }
}

/** The module's folder goes, then Foundry reads its packages again. */
async function removeModule(api: APIRequestContext): Promise<void> {
  rmSync(folder, { recursive: true, force: true });
  await setupPost(api, { action: "resetPackages" });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Any socketlib already there is someone's: never replaced or removed.
  test.skip(existsSync(folder), `${ID} is installed already: left alone`);
  const api = await createAdminClient(env.url);
  admin = api;
  await shutdownWorld(api, env.adminPassword);
  await loginAsAdmin(api, env.adminPassword, join(env.dataDir, "Config"));
  latest = (await findPackage(api, "module", ID)).version ?? "";
  await setupPost(api, {
    action: "installPackage",
    type: "module",
    id: ID,
    manifest: OLD_MANIFEST,
  });
  await waitFor(`${ID} ${OLD} to install`, 2 * 60_000, () =>
    Promise.resolve(installedVersion() === OLD),
  );
  const loaded = await loadExtension();
  ext = loaded;
  page = await loaded.context.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSetupAsAdmin(loaded, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  // Each step runs even when the one before fails (code review).
  try {
    await ext?.context.close();
  } finally {
    if (admin) {
      try {
        await removeModule(admin);
      } finally {
        await admin.dispose();
      }
    }
  }
});

test("the Library card offers Foundry's newer version of the module", async () => {
  expect(latest).not.toBe(OLD);
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
  const button = card().getByRole("button", {
    name: `Update socketlib to ${latest}`,
  });
  await expect(button).toBeVisible({ timeout: 60_000 });
  await expect(button).toHaveAttribute("title", `Update from ${OLD}`);
  await card().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SCREENS}/library-module-update.png` });
  await audit(page, "library: a module with an update");
});

test("Update runs Foundry's own update; the card then shows the new version", async () => {
  await card()
    .getByRole("button", { name: `Update socketlib to ${latest}` })
    .click();
  await waitFor(`${ID} to update to ${latest}`, 2 * 60_000, () =>
    Promise.resolve(bareVersion(installedVersion()) === bareVersion(latest)),
  );
  await expect(card().locator(".mlw-upd")).toHaveCount(0, { timeout: 60_000 });
  // One "v", however the release spells its version.
  await expect(card()).toContainText(`v${bareVersion(latest)}`);
  await expect(card()).not.toContainText("vv");
});
