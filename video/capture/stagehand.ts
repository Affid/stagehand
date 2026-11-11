// Stagehand's Setup on the same server: the Library (page, each card and
// folder heading as its own image, where every piece sits), then the states
// the video walks through, each reached by the real clicks. The queued
// change is discarded again at the end and nothing is launched.
import type { Locator, Page } from "@playwright/test";
import { openStagehand, VIEWPORT } from "./browser.ts";
import { type Piece, piecesOf, type Rect, rectOf, rectsOf } from "./rects.ts";
import { shootEach, shootPage } from "./shots.ts";

/** The world and the module the video queues a change for. */
export const WORLD = "lighthouse-greywater";
export const MODULE = "healthEstimate";
/** The card the video opens to show a note. */
export const NOTED = "dice-so-nice";

const SHELL = "#st-shell-root";
const CARD = `${SHELL} .stl-card[data-module]`;
const SECTION = `${SHELL} .stl-sec`;

const CHROME = {
  title: `${SHELL} .sts-top h1`,
  logo: `${SHELL} .sts-top .logo`,
  rail: `${SHELL} .sts-rail`,
  railLibrary: `${SHELL} .sts-lib`,
  worldsHeading: `${SHELL} .sts-rail h2`,
  worlds: `${SHELL} .sts-worlds`,
  main: `${SHELL} .sts-main`,
  modulesTab: `${SHELL} .stl-page [role="tab"]:nth-child(1)`,
  systemsTab: `${SHELL} .stl-page [role="tab"]:nth-child(2)`,
  byWorldTab: `${SHELL} .stl-page [role="tab"]:nth-child(3)`,
  filter: `${SHELL} .stl-controls label.filter`,
  install: `${SHELL} .stl-controls button:nth-of-type(1)`,
  update: `${SHELL} .stl-controls button:nth-of-type(2)`,
  toolbar: `${SHELL} .stl-toolbar`,
  groupBy: `${SHELL} .stl-toolbar select`,
  list: `${SHELL} .stl-sections`,
} as const;

export interface LibraryCapture {
  readonly chrome: Record<keyof typeof CHROME, Rect>;
  readonly cards: readonly Piece[];
  readonly folders: readonly Piece[];
  readonly labels: readonly FolderLabel[];
}

export interface ByWorldCapture {
  readonly table: Rect;
  readonly columns: readonly Rect[];
}

export interface WalkCapture {
  readonly noted: Record<string, Rect>;
  readonly byWorld: ByWorldCapture;
  readonly world: Record<string, Rect>;
  readonly queued: Record<string, Rect>;
  readonly review: Record<string, Rect>;
}

const shell = (page: Page): Locator => page.locator(SHELL);

async function openLibrary(page: Page): Promise<void> {
  await shell(page).locator(".sts-lib").click();
  await page.locator(CARD).first().waitFor();
  await page.waitForTimeout(1200);
}

/** Folder headings carry no id: number them in page order. */
async function nameFolders(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    document.querySelectorAll(`${sel} .stw-headrow`).forEach((el, i) => {
      el.setAttribute("data-video-folder", String(i));
    });
  }, SECTION);
}

export interface FolderLabel {
  readonly name: string;
  /** The folder's colour as the page sets it, or "" for none (Unfiled). */
  readonly color: string;
}

/** Each folder's name and colour, in page order. */
function folderLabels(page: Page): Promise<FolderLabel[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((sec) => {
      const style = sec.getAttribute("style") ?? "";
      return {
        name: sec.querySelector(".stw-head .name")?.textContent ?? "",
        color: /#[0-9a-f]{3,8}|rgb\([^)]*\)/i.exec(style)?.[0] ?? "",
      };
    });
  }, SECTION);
}

/** What one pass over the Library takes: a pass has one pixel density. */
export type LibraryPass = "pieces" | "page" | "tall";

/** Tall enough that the Library and the By world table show every row. */
const TALL = { width: VIEWPORT.width, height: 3600 } as const;

/** The whole Library and the whole By world table, in a very tall window. */
async function shootTall(page: Page): Promise<void> {
  await page.setViewportSize(TALL);
  await page.waitForTimeout(800);
  await shootPage(page, "sh/library-tall.png");
  await page.locator(CHROME.byWorldTab).click();
  await page.locator(`${SHELL} .stl-grid`).waitFor();
  await shootPage(page, "sh/by-world-tall.png");
}

export async function captureLibrary(
  scale: number,
  pass: LibraryPass,
): Promise<LibraryCapture> {
  const { page, close } = await openStagehand(scale);
  try {
    await openLibrary(page);
    await nameFolders(page);
    const heads = `${SECTION} .stw-headrow`;
    const chrome = await rectsOf(page, CHROME);
    const cards = await piecesOf(page, CARD, "data-module", SECTION);
    const folders = await piecesOf(page, heads, "data-video-folder");
    const labels = await folderLabels(page);
    if (pass === "page") await shootPage(page, "sh/library.png");
    if (pass === "tall") await shootTall(page);
    if (pass === "pieces") {
      await shootEach(page.locator(CARD), "data-module", "sh/cards");
      await shootEach(page.locator(heads), "data-video-folder", "sh/folders");
    }
    return { chrome, cards, folders, labels };
  } finally {
    await close();
  }
}

async function notedCard(page: Page): Promise<Record<string, Rect>> {
  const card = page.locator(`${CARD}[data-module="${NOTED}"]`);
  await card.scrollIntoViewIfNeeded();
  const rects = {
    card: await rectOf(card),
    note: await rectOf(card.locator(".note")),
    tags: await rectOf(card.locator(".tg")),
  };
  return rects;
}

async function byWorld(page: Page): Promise<ByWorldCapture> {
  await page.locator(CHROME.byWorldTab).click();
  await page.locator(`${SHELL} .stl-grid`).waitFor();
  await shootPage(page, "sh/by-world.png");
  const columns = await piecesOf(
    page,
    `${SHELL} .stl-grid thead th:not(:first-child)`,
    "class",
  );
  return {
    table: await rectOf(page.locator(`${SHELL} .stl-gridwrap`)),
    columns: columns.map((c) => c.rect),
  };
}

const worldItem = (page: Page): Locator =>
  shell(page).locator(`.sts-world[data-world="${WORLD}"]`);

async function openWorld(page: Page): Promise<void> {
  await worldItem(page).click();
  await page.locator(`${SHELL} .stw-card`).first().waitFor();
  await page.waitForTimeout(600);
}

/** Drops a queued change (one an interrupted capture left behind, or ours). */
async function discardQueued(page: Page): Promise<void> {
  const discard = page
    .locator(`${SHELL} .sts-banner`)
    .getByRole("button", { name: "Discard" });
  await page.waitForTimeout(500);
  if (!(await discard.isVisible())) return;
  await discard.click();
  await discard.waitFor({ state: "detached" });
  await page.waitForTimeout(800);
}

async function worldPage(page: Page): Promise<Record<string, Rect>> {
  const railItem = await rectOf(worldItem(page));
  await openWorld(page);
  await shootPage(page, "sh/world.png");
  const card = page.locator(`${SHELL} .stw-card[data-module="${MODULE}"]`);
  return {
    railItem,
    card: await rectOf(card),
    toggle: await rectOf(card.locator('input[role="switch"]')),
    launch: await rectOf(page.locator(`${SHELL} .sts-launch`)),
    banner: await rectOf(page.locator(`${SHELL} .sts-main .sts-banner`)),
  };
}

async function queueAndReview(
  page: Page,
): Promise<Pick<WalkCapture, "queued" | "review">> {
  const card = page.locator(`${SHELL} .stw-card[data-module="${MODULE}"]`);
  await card.locator('input[role="switch"]').click();
  const waits = page.getByText(/waits? for the next launch/).first();
  await waits.waitFor();
  await shootPage(page, "sh/world-queued.png");
  const queued = {
    card: await rectOf(card),
    waits: await rectOf(waits.locator("xpath=..")),
    launch: await rectOf(page.locator(`${SHELL} .sts-launch`)),
  };
  await page.locator(`${SHELL} .sts-launch`).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await shootPage(page, "sh/review.png");
  const block = "xpath=ancestor-or-self::*[self::div or self::label][1]";
  const review = {
    dialog: await rectOf(dialog),
    apply: await rectOf(dialog.getByRole("button", { name: /^Apply/ })),
    verdict: await rectOf(
      dialog.getByText(/Dependencies are met/).locator(block),
    ),
    turnsOn: await rectOf(dialog.getByText(/^Turns on/).locator("xpath=..")),
    backup: await rectOf(dialog.getByText(/^Back up .* first$/).locator(block)),
  };
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await discardQueued(page);
  return { queued, review };
}

/** The walk through the page's states, at the page's pixel density. */
export async function captureWalk(scale: number): Promise<WalkCapture> {
  const { page, close } = await openStagehand(scale);
  try {
    await openWorld(page);
    await discardQueued(page);
    await openLibrary(page);
    const noted = await notedCard(page);
    const grid = await byWorld(page);
    const world = await worldPage(page);
    return { noted, byWorld: grid, world, ...(await queueAndReview(page)) };
  } finally {
    await close();
  }
}
