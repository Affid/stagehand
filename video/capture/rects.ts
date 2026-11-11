// Positions of page elements, in CSS pixels of the capture viewport. An
// element below the fold reports where it sits with its list scrolled to
// the top, so a card's place in the whole list is known, not only on screen.
import type { Locator, Page } from "@playwright/test";

export type Rect = readonly [x: number, y: number, w: number, h: number];

export interface Piece {
  readonly id: string;
  readonly rect: Rect;
  /** The group it sits in (a folder's index), where the page has groups. */
  readonly group?: number;
}

const round = (n: number): number => Math.round(n * 100) / 100;

export async function rectOf(target: Locator): Promise<Rect> {
  const box = await target.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height] as const;
  });
  return [round(box[0]), round(box[1]), round(box[2]), round(box[3])];
}

/** The box of an element's text, not of the block that holds it. */
export async function textRectOf(target: Locator): Promise<Rect> {
  const box = await target.first().evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height] as const;
  });
  return [round(box[0]), round(box[1]), round(box[2]), round(box[3])];
}

/** Named rects, each of the first element its selector matches. */
export async function rectsOf<K extends string>(
  page: Page,
  selectors: Readonly<Record<K, string>>,
): Promise<Record<K, Rect>> {
  const entries: [string, Rect][] = [];
  for (const [name, selector] of Object.entries<string>(selectors))
    entries.push([name, await rectOf(page.locator(selector))]);
  return Object.fromEntries(entries) as Record<K, Rect>;
}

/** Every match of `selector`, with the id read from `attribute`. */
export function piecesOf(
  page: Page,
  selector: string,
  attribute: string,
  groupSelector?: string,
): Promise<Piece[]> {
  return page.evaluate(
    ([sel, attr, groupSel]) => {
      const groups = groupSel ? [...document.querySelectorAll(groupSel)] : [];
      return [...document.querySelectorAll(sel)].map((el) => {
        const r = el.getBoundingClientRect();
        const group = groups.findIndex((g) => g.contains(el));
        return {
          id: el.getAttribute(attr) ?? "",
          rect: [r.x, r.y, r.width, r.height] as const,
          ...(group >= 0 ? { group } : {}),
        };
      });
    },
    [selector, attribute, groupSelector ?? ""] as const,
  );
}
