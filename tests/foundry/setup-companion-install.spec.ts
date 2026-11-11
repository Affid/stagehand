// A server without the companion module (issue 1): the Library says so, and
// Install runs Foundry's own installer with the published manifest, from
// GitHub. The development link to the companion is moved aside for the run
// and put back afterwards, so the server ends as it began.
import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
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
  loginAsAdmin,
  setupPost,
  shutdownWorld,
  waitFor,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  COMPANION_ID,
  companionState,
} from "../../packages/shared/src/companion.ts";
import { audit } from "./axe.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
const folder = join(env.dataDir, "Data", "modules", COMPANION_ID);
/** Where the development link waits, outside Foundry's modules folder. */
const aside = join(env.dataDir, `${COMPANION_ID}-link-aside`);
const INSTALL_MS = 2 * 60_000;

let ext: Target | undefined;
let admin: APIRequestContext | undefined;
let page: Page;
let moved = false;

const shell = (): Locator => page.locator("#st-shell-root");
const band = (): Locator => shell().locator(".sts-companion-band");

/** Foundry's toasts (the admin login's) go, so they don't cover the page. */
const clearNotices = (): Promise<void> =>
  page.evaluate(() => {
    (
      globalThis as unknown as {
        ui: { notifications: { clear(): void } };
      }
    ).ui.notifications.clear();
  });

const isLink = (path: string): boolean =>
  lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true;

/** The installed companion's version; "" while missing or being written. */
function installedVersion(): string {
  try {
    const raw = JSON.parse(
      readFileSync(join(folder, "module.json"), "utf8"),
    ) as { version?: unknown };
    return typeof raw.version === "string" ? raw.version : "";
  } catch {
    return "";
  }
}

const RESTORE_TRIES = 10;
const RESTORE_WAIT_MS = 1000;

/**
 * The installed copy goes and the development link comes back. Tried again
 * while Foundry still writes into the folder (a run that failed mid-install).
 */
async function restore(api: APIRequestContext): Promise<void> {
  if (!moved) return;
  for (let tries = 1; ; tries++) {
    try {
      if (!isLink(folder)) rmSync(folder, { recursive: true, force: true });
      if (isLink(aside)) renameSync(aside, folder);
      break;
    } catch (error: unknown) {
      if (tries === RESTORE_TRIES)
        throw new Error(
          `The companion's link was not put back. By hand: rm -rf "${folder}" && mv "${aside}" "${folder}"`,
          { cause: error },
        );
      await new Promise((resolve) => setTimeout(resolve, RESTORE_WAIT_MS));
    }
  }
  await setupPost(api, { action: "resetPackages" });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // A companion installed for real is someone's: never removed.
  test.skip(
    existsSync(folder) && !isLink(folder),
    `${COMPANION_ID} is installed, not linked: left alone`,
  );
  test.skip(
    existsSync(aside) || isLink(aside),
    `${aside} is left from an earlier run: mv it back to ${folder}`,
  );
  const api = await createAdminClient(env.url);
  admin = api;
  await shutdownWorld(api, env.adminPassword);
  await loginAsAdmin(api, env.adminPassword, join(env.dataDir, "Config"));
  if (isLink(folder)) renameSync(folder, aside);
  moved = true;
  await setupPost(api, { action: "resetPackages" });
  const loaded = await loadTarget();
  ext = loaded;
  page = await loaded.context.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await openSetupAsAdmin(loaded, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  // Each step runs even when the one before fails.
  try {
    await ext?.close();
  } finally {
    if (admin) {
      try {
        await restore(admin);
      } finally {
        await admin.dispose();
      }
    }
  }
});

test("the Library says the companion is missing and offers to install it", async () => {
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(band()).toContainText(
    "Stagehand's companion module isn't installed on this server",
  );
  await expect(band().getByRole("button", { name: "Install" })).toBeEnabled();
  await clearNotices();
  await page.screenshot({ path: `${SCREENS}/library-companion-missing.png` });
  await audit(page, "library: the companion is missing");
});

test("a phone's Library says it in the same band", async () => {
  await page.setViewportSize({ width: 390, height: 800 });
  // A phone opens on its worlds; the Library is a tab.
  await shell()
    .locator(".stp-tabs")
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(band().getByRole("button", { name: "Install" })).toBeVisible();
  const box = await band().boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${SCREENS}/phone-companion-missing.png` });
  await page.setViewportSize({ width: 1366, height: 900 });
});

test("a world's setup steps start with installing the companion", async () => {
  await shell().locator(".sts-world").first().click();
  const steps = shell().locator(".stw-empty ol li");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toHaveText(
    "Install Stagehand's companion module.",
  );
  await expect(
    shell().getByRole("button", { name: "Install the companion" }),
  ).toBeEnabled();
  await expect(
    shell().getByRole("button", { name: "Launch to set it up" }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/world-companion-missing.png` });
  await audit(page, "world: the companion is missing");
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
});

test("Install runs Foundry's installer; the band goes once the module is there", async () => {
  await band().getByRole("button", { name: "Install" }).click();
  await expect(
    band().getByRole("button", { name: "Installing…" }),
  ).toBeDisabled();
  await waitFor(`${COMPANION_ID} to install`, INSTALL_MS, () =>
    Promise.resolve(installedVersion() !== ""),
  );
  expect(
    companionState([{ id: COMPANION_ID, version: installedVersion() }]),
  ).toBe("ok");
  await expect(band()).toHaveCount(0, { timeout: 60_000 });
  await expect(
    shell().locator(`.stl-card[data-module="${COMPANION_ID}"]`),
  ).toContainText(`v${installedVersion()}`);
  await page.screenshot({ path: `${SCREENS}/library-companion-installed.png` });
});
