// Foundry's own Setup, Modules tab: the page, each module card as its own
// image, and where every piece sits.
import type { Page } from "@playwright/test";
import { openStock } from "./browser.ts";
import {
  type Piece,
  piecesOf,
  type Rect,
  rectsOf,
  textRectOf,
} from "./rects.ts";
import { shootEach, shootPage } from "./shots.ts";

const TAB = '#setup-packages .tab[data-tab="modules"]';
const CARD = `${TAB} .package[data-package-id]`;

const CHROME = {
  title: "#main-header h1",
  panel: "#setup-packages",
  worldsHeading: '#setup-packages nav [data-tab="worlds"]',
  systemsHeading: '#setup-packages nav [data-tab="systems"]',
  modulesHeading: '#setup-packages nav [data-tab="modules"]',
  filter: `${TAB} label.filter`,
  install: `${TAB} [data-action="installPackage"]`,
  update: `${TAB} [data-action="updateAll"]`,
  list: `${TAB} .package-list`,
} as const;

export interface StockCapture {
  readonly chrome: Record<keyof typeof CHROME, Rect>;
  readonly cards: readonly Piece[];
}

async function openModules(page: Page): Promise<void> {
  await page.locator(CHROME.modulesHeading).first().click();
  await page.locator(CARD).first().waitFor();
  await page.waitForTimeout(800);
}

/** The cards and rects at one pixel density; `withPage` adds the page shot. */
export async function captureStock(
  scale: number,
  withPage: boolean,
): Promise<StockCapture> {
  const { page, close } = await openStock(scale);
  try {
    await openModules(page);
    const chrome = {
      ...(await rectsOf(page, CHROME)),
      title: await textRectOf(page.locator(CHROME.title)),
    };
    const cards = await piecesOf(page, CARD, "data-package-id");
    if (withPage) await shootPage(page, "stock/page.png");
    else await shootEach(page.locator(CARD), "data-package-id", "stock/cards");
    return { chrome, cards };
  } finally {
    await close();
  }
}
