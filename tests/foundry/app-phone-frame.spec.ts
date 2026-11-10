// The phone and tablet layouts' frame (Android plan, phase 3, package 1), in
// the app harness on the local Foundry: the worlds list as home, a world
// with Back, the tab bar, Escape as Android's Back, Foundry's window-size
// notice gone; the tablet keeps the list beside the page; a phone on its
// side has icon-only tabs. It runs its own app harness, so it runs the same
// in both runs of the suite.
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
import { exitTour } from "./extension.ts";

const env = loadFoundryEnv();

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
});

const shell = (page: Page) => page.locator("#st-shell-root .sts-shell");
const tabBar = (page: Page) => shell(page).locator(".stp-tabs");
const tab = (page: Page, name: string) =>
  tabBar(page).getByRole("button", { name: new RegExp(`^${name}`) });

/** The page is no wider than the screen: nothing scrolls sideways. */
async function noSidewaysScroll(page: Page): Promise<void> {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(width);
}

async function open(device: Device): Promise<[AppHarness, Page]> {
  const app = await launchApp({ device });
  const page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  return [app, page];
}

test.describe("on a phone", () => {
  let app: AppHarness;
  let page: Page;
  test.beforeAll(async () => {
    [app, page] = await open("phone");
  });
  test.afterAll(async () => {
    await app.close();
  });

  test("opens on the worlds list, without Foundry's window-size notice", async () => {
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
    await expect(
      shell(page).getByRole("heading", { name: "Foundry VTT" }),
    ).toBeVisible();
    await expect(shell(page).locator(".sts-world").first()).toBeVisible();
    await expect(tab(page, "Worlds")).toHaveAttribute("aria-current", "page");
    // The world behind the list keeps its bar to itself (seen in the emulator).
    await expect(shell(page).locator(".stp-dock")).toBeHidden();
    // Foundry raised it at load; the phone layout took it away.
    await expect(
      page.locator("#notifications li.permanent", { hasText: "1024px" }),
    ).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("a world opens with Back; Back and Escape return to the list", async () => {
    const first = shell(page).locator(".sts-world strong").first();
    const name = (await first.textContent()) ?? "";
    await first.click();
    await expect(shell(page)).toHaveAttribute("data-screen", "page");
    await expect(
      shell(page).getByRole("heading", { level: 1, name }),
    ).toBeVisible();
    await shell(page)
      .getByRole("button", { name: "Back", exact: true })
      .click();
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
    await first.click();
    await page.keyboard.press("Escape");
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
  });

  test("the tabs open the Library, Backups and Configuration", async () => {
    for (const [name, page_] of [
      ["Library", "library"],
      ["Backups", "backups"],
      ["Configuration", "config"],
    ] as const) {
      await tab(page, name).click();
      await expect(shell(page)).toHaveAttribute("data-page", page_);
      await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
      await expect(
        shell(page).getByRole("heading", { level: 1, name }),
      ).toBeVisible();
    }
    await tab(page, "Worlds").click();
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
  });
});

test("a tablet on its side keeps the worlds list beside the page", async () => {
  const [app, page] = await open("tablet-side");
  try {
    const rail = await shell(page).locator(".sts-rail").boundingBox();
    const main = await shell(page).locator(".sts-main").boundingBox();
    expect(rail && main && rail.x + rail.width <= main.x + 1).toBe(true);
    await tab(page, "Library").click();
    await expect(shell(page).locator(".sts-rail")).toBeVisible();
    await noSidewaysScroll(page);
  } finally {
    await app.close();
  }
});

test("a phone on its side has short bars and icon-only tabs", async () => {
  const [app, page] = await open("phone-side");
  try {
    await expect(shell(page)).not.toHaveClass(/stp-wide/);
    // The labels go from sight but stay the tabs' names.
    const label = tab(page, "Library").locator("span").first();
    await expect(label).toHaveText("Library");
    expect((await label.boundingBox())?.width).toBeLessThanOrEqual(1);
    const bar = await tabBar(page).boundingBox();
    expect(bar?.height).toBeLessThanOrEqual(50);
    await noSidewaysScroll(page);
  } finally {
    await app.close();
  }
});

test("a tablet held upright gets the phone layout", async () => {
  const [app, page] = await open("tablet");
  try {
    await expect(shell(page)).not.toHaveClass(/stp-wide/);
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
  } finally {
    await app.close();
  }
});
