// The in-world GIF's screens of Module Management (listing-in-world.ts):
// the library view at Token Magic FX's folder, its panel's Library and
// Package tabs, the switch, the review, then the window after the reload.
import type { Locator, Page } from "@playwright/test";
import { type Rect, rectOf } from "./rects.ts";
import { shootPage } from "./shots.ts";

/** It has a folder, a tag, a note and a preset, and needs libWrapper. */
const MODULE = "tokenmagic";
const FOLDER = "Effects";
const NOTE = "Keep effects short on big maps.";

const win = (page: Page): Locator => page.locator("#module-management");
const card = (page: Page): Locator =>
  win(page).locator(`.stw-card[data-module="${MODULE}"]`);
const panel = (page: Page): Locator => win(page).locator(".sts-panel");
const shot = (page: Page, name: string): Promise<void> =>
  shootPage(page, `listing-world/${name}.png`);

/** Scrolls the cards so the module's folder heads the list. */
async function toFolder(page: Page): Promise<Locator> {
  const head = win(page).locator(".stw-head").filter({ hasText: FOLDER });
  await head.first().waitFor();
  await head.first().evaluate((e) => {
    e.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(700);
  return head.first();
}

/** The cards, then the module's panel on its Library tab. */
async function cardsAndPanel(page: Page): Promise<Record<string, Rect>> {
  await win(page).locator(".stagehand-view .stw-card").first().waitFor();
  const head = await toFolder(page);
  await shot(page, "cards");
  const title = card(page).locator("button.t");
  const rects = { head: await rectOf(head), title: await rectOf(title) };
  await title.click();
  await panel(page).getByText(NOTE).waitFor();
  await page.waitForTimeout(600);
  await shot(page, "panel");
  return {
    ...rects,
    note: await rectOf(panel(page).getByText(NOTE)),
    tag: await rectOf(
      panel(page).locator(".stl-tag").filter({ hasText: "heavy" }),
    ),
    preset: await rectOf(
      panel(page).locator(".preset").filter({ hasText: "Cinematic" }),
    ),
    packageTab: await rectOf(packageTab(page)),
  };
}

const packageTab = (page: Page): Locator =>
  panel(page)
    .locator(".sts-subtabs button")
    .filter({ hasText: /Package/ });

/** The Package tab: what the module needs. */
async function packageShot(page: Page): Promise<Record<string, Rect>> {
  await packageTab(page).click();
  const needs = panel(page)
    .locator(".sts-chg li")
    .filter({ hasText: "libWrapper" });
  await needs.first().waitFor();
  await page.waitForTimeout(600);
  await shot(page, "package");
  return {
    needs: await rectOf(needs),
    toggle: await rectOf(card(page).locator('input[role="switch"]')),
  };
}

/** The switch flipped: marked on the card, not saved yet. */
async function changedShot(page: Page): Promise<Record<string, Rect>> {
  await card(page).locator('input[role="switch"]').click();
  const pending = win(page).locator(".stc-pending");
  await pending.waitFor();
  await page.waitForTimeout(600);
  await shot(page, "changed");
  return {
    pending: await rectOf(pending),
    save: await rectOf(
      win(page).getByRole("button", { name: /Save Module Settings/ }),
    ),
  };
}

export async function viewShots(page: Page): Promise<Record<string, Rect>> {
  await page.locator('#settings button[data-app="modules"]').click();
  return {
    ...(await cardsAndPanel(page)),
    ...(await packageShot(page)),
    ...(await changedShot(page)),
  };
}

/** The review, Save & Reload, then the window again with the module on. */
export async function reviewAndSave(
  page: Page,
  settle: () => Promise<void>,
): Promise<Record<string, Rect>> {
  await win(page)
    .getByRole("button", { name: /Save Module Settings/ })
    .click();
  const review = page
    .locator(".application.dialog")
    .filter({ hasText: "Review Changes" });
  await review.getByText("Added as dependencies").waitFor();
  await page.waitForTimeout(800);
  await shot(page, "review");
  const block = "xpath=ancestor-or-self::*[self::div or self::section][1]";
  const saveReload = review.getByRole("button", { name: "Save & Reload" });
  const rects = {
    dialog: await rectOf(review),
    added: await rectOf(
      review.getByText("Added as dependencies").locator(block),
    ),
    saveReload: await rectOf(saveReload),
  };
  await saveReload.click();
  await page.waitForEvent("load", { timeout: 60_000 });
  await page.waitForFunction(
    () => (globalThis as { game?: { ready?: boolean } }).game?.ready === true,
    null,
    { timeout: 120_000 },
  );
  await settle();
  await page.locator('#sidebar-tabs [data-tab="settings"]').click();
  await page.locator('#settings button[data-app="modules"]').click();
  await win(page).locator(".stagehand-view .stw-card").first().waitFor();
  await toFolder(page);
  await shot(page, "after");
  return { ...rects, card: await rectOf(card(page)) };
}
