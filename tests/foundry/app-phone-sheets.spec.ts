// Sheets, menus, dialogs and touch in the phone and tablet layouts (Android
// plan, phase 3, package 2), in the app harness on the local Foundry: a
// module's details as a bottom sheet over an inert page, menus from the
// bottom over a scrim, a dialog from the bottom, a long press that explains,
// a tablet's sheet from the right. Runs its own app harness.
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
const tab = (page: Page, name: string) =>
  shell(page)
    .locator(".stp-tabs")
    .getByRole("button", { name: new RegExp(`^${name}`) });

async function open(device: Device): Promise<[AppHarness, Page]> {
  const app = await launchApp({ device });
  const page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  return [app, page];
}

/** Waits for the element's slide-in to end. */
async function settled(page: Page, selector: string): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => el.getAnimations().length),
    )
    .toBe(0);
}

/** The element's box against the screen's. */
async function edges(page: Page, selector: string) {
  await settled(page, selector);
  const box = await shell(page).locator(selector).first().boundingBox();
  const view = page.viewportSize();
  if (!box || !view) throw new Error(`${selector} isn't shown`);
  return {
    left: Math.round(box.x),
    right: Math.round(view.width - box.x - box.width),
    bottom: Math.round(view.height - box.y - box.height),
    width: Math.round(box.width),
  };
}

/** A finger held on the element for `ms` (CDP touch, as a phone sends it). */
async function longPress(app: AppHarness, page: Page, selector: string) {
  const box = await shell(page).locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} isn't shown`);
  const cdp = await app.context.newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await page.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
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

  test("a long press on a world's flag explains it, and doesn't open the world", async () => {
    await longPress(app, page, ".sts-world .flag.a");
    await expect(shell(page).getByRole("tooltip")).toBeVisible();
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
  });

  test("the version chip's menu comes up from the bottom; a tap outside only closes it", async () => {
    await shell(page).locator(".sth-ver").click();
    const menu = await edges(page, ".st-pop");
    expect(menu).toMatchObject({ left: 0, right: 0, bottom: 0 });
    await expect(shell(page).locator("> .stp-scrim.pop")).toBeVisible();
    // A finger's tap over the first world: it closes the menu and opens
    // nothing (the scrim outlives the menu until the tap's click).
    const world = await shell(page).locator(".sts-world").first().boundingBox();
    if (!world) throw new Error("no world shown");
    await page.touchscreen.tap(world.x + 60, world.y + world.height / 2);
    await expect(shell(page).locator(".st-pop")).toHaveCount(0);
    await expect(shell(page).locator(".stp-scrim")).toHaveCount(0);
    await expect(shell(page)).toHaveAttribute("data-screen", "home");
  });

  test("a module's details are a bottom sheet over an inert page; Back closes them", async () => {
    await tab(page, "Library").click();
    await shell(page).locator(".sts-main button.t").first().click();
    const sheet = shell(page).getByRole("dialog");
    await expect(sheet).toBeVisible();
    expect(await edges(page, ".stp-sheet")).toMatchObject({
      left: 0,
      right: 0,
      bottom: 0,
    });
    expect(
      await shell(page)
        .locator(".sts-main")
        .evaluate((el) => (el as HTMLElement).inert),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    // Focus goes back to the module that opened the details.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.activeElement?.closest(".stl-card") !== null,
        ),
      )
      .toBe(true);
    expect(
      await shell(page)
        .locator(".sts-main")
        .evaluate((el) => (el as HTMLElement).inert),
    ).toBe(false);
    await expect(shell(page)).toHaveAttribute("data-page", "library");
  });

  test("a dialog comes up from the bottom, the width of the screen", async () => {
    await tab(page, "Backups").click();
    await shell(page)
      .getByRole("button", { name: /New snapshot|Create a snapshot/i })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Create a snapshot" });
    await expect(dialog).toBeVisible();
    await settled(page, ".st-modal");
    const box = await dialog.boundingBox();
    const view = page.viewportSize();
    expect(box && view && Math.round(box.width)).toBe(view?.width);
    expect(box && view && Math.round(view.height - box.y - box.height)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test("a tablet's sheet comes in from the right, under the top bar", async () => {
  const [app, page] = await open("tablet-side");
  try {
    await tab(page, "Library").click();
    await shell(page).locator(".sts-main button.t").first().click();
    const sheet = await edges(page, ".stp-sheet");
    expect(sheet.right).toBe(0);
    expect(sheet.left).toBeGreaterThan(400);
    await expect(shell(page).locator(".stp-grab")).toHaveCount(0);
  } finally {
    await app.close();
  }
});
