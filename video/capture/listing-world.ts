// The listing GIF's world screens (video/capture/listing.ts): the world's
// page, only its active modules, a queued change, the review, then Apply.
import type { Page } from "@playwright/test";
import { type Rect, rectOf } from "./rects.ts";
import { shootPage } from "./shots.ts";
import { MODULE, WORLD } from "./stagehand.ts";

const SHELL = "#st-shell-root";

const show = (page: Page, name: string) =>
  page
    .locator(`${SHELL} .sts-main`)
    .getByRole("radio", { name: new RegExp(`^${name}`) })
    .or(
      page
        .locator(`${SHELL} .sts-main`)
        .getByRole("button", { name: new RegExp(`^${name}\\b`) }),
    )
    .first();

async function openWorld(page: Page): Promise<Rect> {
  const item = page.locator(`${SHELL} .sts-world[data-world="${WORLD}"]`);
  const rail = await rectOf(item);
  await item.click();
  await page.locator(`${SHELL} .stw-card`).first().waitFor();
  await page.waitForTimeout(1000);
  return rail;
}

/** The world with every module, then with only those on. */
async function worldViews(page: Page): Promise<Record<string, Rect>> {
  const railItem = await openWorld(page);
  await show(page, "All").click();
  await page.waitForTimeout(600);
  await shootPage(page, "listing/world.png");
  const on = show(page, "On");
  const onButton = await rectOf(on);
  await on.click();
  await page.waitForTimeout(1000);
  await shootPage(page, "listing/world-on.png");
  const allButton = await rectOf(show(page, "All"));
  await show(page, "All").click();
  await page.waitForTimeout(800);
  return { railItem, onButton, allButton };
}

/** Flip the module on, open the review, then apply and launch. */
async function queueAndLaunch(page: Page): Promise<Record<string, Rect>> {
  const card = page.locator(`${SHELL} .stw-card[data-module="${MODULE}"]`);
  const toggle = await rectOf(card.locator('input[role="switch"]'));
  await card.locator('input[role="switch"]').click();
  const waits = page.getByText(/waits? for the next launch/).first();
  await waits.waitFor();
  await shootPage(page, "listing/world-queued.png");
  const launch = page.locator(`${SHELL} .sts-launch`);
  const rects = {
    toggle,
    waits: await rectOf(waits.locator("xpath=..")),
    launch: await rectOf(launch),
  };
  await launch.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await shootPage(page, "listing/review.png");
  const block = "xpath=ancestor-or-self::*[self::div or self::label][1]";
  const apply = dialog.getByRole("button", { name: /^Apply/ });
  const review = {
    dialog: await rectOf(dialog),
    verdict: await rectOf(
      dialog.getByText(/Dependencies are met/).locator(block),
    ),
    backup: await rectOf(dialog.getByText(/^Back up .* first$/).locator(block)),
    apply: await rectOf(apply),
  };
  // Shown ticked; no backup is made, to keep the demo server small.
  await dialog.getByRole("checkbox", { name: /Back up .* first/ }).uncheck();
  await apply.click();
  return { ...rects, ...review };
}

export async function worldShots(page: Page): Promise<Record<string, Rect>> {
  return { ...(await worldViews(page)), ...(await queueAndLaunch(page)) };
}
