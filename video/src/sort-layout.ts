// Where each module card goes during the scene change: from its place in
// Foundry's A to Z list, to a board that shows every folder at once, to its
// place in Stagehand's Library. The board is the video's own arrangement;
// both ends are the pages as captured.
import { capture, type Rect } from "./data";
import { PAGE } from "./theme";

export const BOARD_SCALE = 0.38;
/** Room on the board for each folder's name above its cards. */
export const LABEL_SPACE = 16;
const UNFILED = "#6b6f7a";
const COLUMNS = 3;
const GAP_X = 28;
const GAP_Y = 20;
const TOP = 50;
/** Cards far down Foundry's list start just under the frame, not a page away. */
const START_BELOW = PAGE.height + 30;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Flight {
  readonly id: string;
  readonly group: number;
  /** Its turn to fly: folder by folder, row by row. */
  readonly order: number;
  readonly stock: Rect;
  readonly start: Point;
  readonly board: Point;
  readonly real: Rect;
}

export interface Head {
  readonly id: string;
  readonly group: number;
  readonly board: Point;
  readonly real: Rect;
  readonly name: string;
  readonly color: string;
  /** The turn of the first card that lands under it. */
  readonly order: number;
}

const { cards, folders } = capture.library;
const headOf = (group: number): Rect => folders[group]?.rect ?? [0, 0, 0, 0];

function groupHeight(group: number): number {
  const top = headOf(group)[1];
  const bottoms = cards
    .filter((c) => c.group === group)
    .map((c) => c.rect[1] + c.rect[3]);
  return Math.max(top + headOf(group)[3], ...bottoms) - top;
}

/** Each folder's top-left corner on the board. */
function boardSlots(): Point[] {
  const width = headOf(0)[2] * BOARD_SCALE;
  const left = (PAGE.width - (COLUMNS * width + (COLUMNS - 1) * GAP_X)) / 2;
  const slots: Point[] = [];
  let y = TOP;
  for (let row = 0; row * COLUMNS < folders.length; row++) {
    const groups = folders.slice(row * COLUMNS, (row + 1) * COLUMNS);
    groups.forEach((_, col) => {
      slots.push({ x: left + col * (width + GAP_X), y });
    });
    const tallest = Math.max(
      ...groups.map((_, col) => groupHeight(row * COLUMNS + col)),
    );
    y += tallest * BOARD_SCALE + LABEL_SPACE + GAP_Y;
  }
  return slots;
}

const SLOTS = boardSlots();
const slotOf = (group: number): Point => SLOTS[group] ?? { x: 0, y: 0 };

const onBoard = (group: number, rect: Rect): Point => ({
  x: slotOf(group).x + (rect[0] - headOf(group)[0]) * BOARD_SCALE,
  y: slotOf(group).y + LABEL_SPACE + (rect[1] - headOf(group)[1]) * BOARD_SCALE,
});

const { labels } = capture.library;
export const colorOf = (group: number): string =>
  labels[group]?.color || UNFILED;

const stockRects = new Map(capture.stock.cards.map((c) => [c.id, c.rect]));

const ordered = [...cards].sort(
  (a, b) =>
    (a.group ?? 0) - (b.group ?? 0) ||
    a.rect[1] - b.rect[1] ||
    a.rect[0] - b.rect[0],
);

export const FLIGHTS: readonly Flight[] = ordered.flatMap((card, order) => {
  const stock = stockRects.get(card.id);
  if (!stock) return [];
  const group = card.group ?? 0;
  const below = START_BELOW + (order % 6) * 26;
  return [
    {
      id: card.id,
      group,
      order,
      stock,
      start: { x: stock[0], y: Math.min(stock[1], below) },
      board: onBoard(group, card.rect),
      real: card.rect,
    },
  ];
});

export const HEADS: readonly Head[] = folders.map((folder, group) => ({
  id: folder.id,
  group,
  board: slotOf(group),
  real: folder.rect,
  name: labels[group]?.name ?? "",
  color: colorOf(group),
  order: FLIGHTS.find((f) => f.group === group)?.order ?? 0,
}));

/** The Library's list ends here: what lands lower is below the fold. */
export const FOLD =
  capture.library.chrome.list[1] + capture.library.chrome.list[3];
