// Screenshots for the video: a whole viewport, or one element as its own
// image (Playwright scrolls it into view first).
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Locator, Page } from "@playwright/test";

export const OUT = join(import.meta.dirname, "..", "public", "capture");

function target(name: string): string {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

export async function shootPage(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: target(name) });
}

export async function shootEach(
  items: Locator,
  attribute: string,
  folder: string,
): Promise<void> {
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const id = (await item.getAttribute(attribute)) ?? String(i);
    await item.screenshot({ path: target(`${folder}/${id}.png`) });
  }
}
