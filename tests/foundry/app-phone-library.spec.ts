// The Library on a phone (Android plan, phase 3, package 4), in the app
// harness on the local Foundry: one row with View and ⋮, no By world on a
// phone (a tablet on its side keeps it), Tags from the ⋮ menu as a sheet,
// selecting with the count and actions in the dock. Runs its own harness.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type AppHarness,
  type Device,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, SCREENS } from "./extension.ts";

const env = loadFoundryEnv();

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
});

const shell = (page: Page) => page.locator("#st-shell-root .sts-shell");

async function openLibrary(device: Device): Promise<[AppHarness, Page]> {
  const app = await launchApp({ device });
  const page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  await shell(page)
    .locator(".stp-tabs")
    .getByRole("button", { name: /^Library/ })
    .click();
  return [app, page];
}

test.describe("on a phone", () => {
  let app: AppHarness;
  let page: Page;
  test.beforeAll(async () => {
    [app, page] = await openLibrary("phone");
  });
  test.afterAll(async () => {
    await app.close();
  });

  test("one row: the filter, View and ⋮; no By world", async () => {
    await expect(shell(page).getByRole("tab")).toHaveText([
      /^Modules/,
      /^Systems/,
    ]);
    const head = shell(page).locator(".stp-libhead");
    await expect(head.getByRole("searchbox")).toBeVisible();
    await expect(
      head.getByRole("button", { name: /^Group by:/ }),
    ).toBeVisible();
    await expect(
      head.getByRole("button", { name: /^Select, install/ }),
    ).toBeVisible();
    const box = await head.boundingBox();
    expect(box?.height).toBeLessThan(70);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `${SCREENS}/phone-library.png` });
  });

  test("⋮ › Tags opens the Tags sheet", async () => {
    await shell(page)
      .getByRole("button", { name: /^Select, install/ })
      .click();
    await shell(page).getByRole("button", { name: "Tags…" }).click();
    await expect(
      shell(page).getByRole("dialog", { name: "Tags" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shell(page).getByRole("dialog")).toHaveCount(0);
  });

  test("selecting: the count and the actions sit in the dock", async () => {
    await shell(page)
      .getByRole("button", { name: /^Select, install/ })
      .click();
    await shell(page).getByRole("button", { name: "Select modules" }).click();
    const dock = shell(page).locator(".stp-dock .sts-selbar");
    await expect(dock).toBeVisible();
    await shell(page).locator(".stl-card input[type=checkbox]").first().check();
    await expect(dock.locator(".sts-selcount")).toHaveText("1 selected");
    await page.screenshot({ path: `${SCREENS}/phone-library-select.png` });
    await dock.getByRole("button", { name: "Done" }).click();
    await expect(dock).toHaveCount(0);
  });
});

test("a tablet on its side keeps By world", async () => {
  const [app, page] = await openLibrary("tablet-side");
  try {
    await expect(shell(page).getByRole("tab")).toHaveText([
      /^Modules/,
      /^Systems/,
      /^By world/,
    ]);
  } finally {
    await app.close();
  }
});
