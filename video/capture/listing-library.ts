// The listing GIF's Library and server screens (video/capture/listing.ts).
import { homedir } from "node:os";
import type { Page } from "@playwright/test";
import { type Rect, rectOf } from "./rects.ts";
import { shootPage } from "./shots.ts";
import { MODULE } from "./stagehand.ts";

const SHELL = "#st-shell-root";
const CARD = `${SHELL} .stl-card[data-module]`;
const GROUP_BY = `${SHELL} .stl-toolbar select`;
const HEAD = `${SHELL} .stl-sec .stw-headrow`;

async function openLibrary(page: Page): Promise<void> {
  await page.locator(`${SHELL} .sts-lib`).click();
  await page.locator(CARD).first().waitFor();
  await page.waitForTimeout(1200);
}

async function groupBy(page: Page, label: string): Promise<void> {
  await page.locator(GROUP_BY).selectOption({ label });
  await page.waitForTimeout(1000);
}

const moduleCard = (page: Page) =>
  page.locator(`${CARD}[data-module="${MODULE}"]`);

/** By folder, by tag, then the module's own panel. */
export async function libraryShots(page: Page): Promise<Record<string, Rect>> {
  await openLibrary(page);
  await groupBy(page, "Folder");
  await shootPage(page, "listing/library.png");
  const folder = await rectOf(page.locator(HEAD));
  const select = await rectOf(page.locator(GROUP_BY));
  const cardByFolder = await rectOf(moduleCard(page));
  await groupBy(page, "Tag");
  await shootPage(page, "listing/library-tags.png");
  const tag = await rectOf(page.locator(HEAD));
  const card = moduleCard(page);
  await card.scrollIntoViewIfNeeded();
  const title = await rectOf(card.locator("button.t"));
  await card.locator("button.t").click();
  const panel = page.locator(`${SHELL} .sts-panel`);
  await panel.waitFor();
  await page.waitForTimeout(2000);
  await shootPage(page, "listing/module-panel.png");
  const panelRect = await rectOf(panel);
  const note = await rectOf(panel.locator("textarea"));
  const worlds = await rectOf(panel.getByText(/On in worlds/i));
  await panel.locator(".sts-close").click();
  await groupBy(page, "Folder");
  return {
    folder,
    select,
    cardByFolder,
    tag,
    title,
    panel: panelRect,
    note,
    worlds,
  };
}

/**
 * The Configuration page shows the server's data path: the capture's home
 * folder (a person's name) becomes a neutral one in the picture only.
 */
async function hideHome(page: Page): Promise<void> {
  await page.evaluate(
    ([home, neutral]) => {
      const walker = document.createTreeWalker(document.body, 4);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (n.nodeValue?.includes(home))
          n.nodeValue = n.nodeValue.replaceAll(home, neutral);
      for (const input of document.querySelectorAll("input"))
        if (input.value.includes(home))
          input.value = input.value.replaceAll(home, neutral);
    },
    [homedir(), "/home/gm"] as const,
  );
}

/** The server's own pages: Backups, Configuration, Update. */
export async function serverPages(page: Page): Promise<Record<string, Rect>> {
  const top = page.locator(`${SHELL} .sts-top`);
  const backups = top.getByRole("button", { name: "Backups" });
  const config = top.getByRole("button", { name: "Configuration" });
  const rects = {
    backupsButton: await rectOf(backups),
    configButton: await rectOf(config),
  };
  await backups.click();
  await page.waitForTimeout(1500);
  // The demo has world backups (listing-backups.ts), no server snapshot.
  const worldsTab = page
    .locator(`${SHELL} .sts-main`)
    .getByRole("tab", { name: /^Worlds/ });
  const backupsWorldsTab = await rectOf(worldsTab);
  await worldsTab.click();
  await page.waitForTimeout(1200);
  await shootPage(page, "listing/backups.png");
  await config.click();
  await page.waitForTimeout(1500);
  await hideHome(page);
  await shootPage(page, "listing/config.png");
  const version = top.locator("button", { hasText: /Version/ }).first();
  const versionButton = await rectOf(version);
  await version.click();
  await page.getByRole("button", { name: /Update page/ }).click();
  await page.waitForTimeout(2500);
  await shootPage(page, "listing/update.png");
  return { ...rects, versionButton, backupsWorldsTab };
}
