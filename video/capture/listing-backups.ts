// Takes one real backup of each demo world, with a note, through Stagehand's
// world page and Foundry's own backup dialog, so the Backups page in the
// listing GIF isn't empty. Run once on the demo server, before listing.ts:
//   FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
//     node video/capture/listing-backups.ts
import type { Page } from "@playwright/test";
import { openStagehand } from "./browser.ts";

const SHELL = "#st-shell-root";
const NOTES: Readonly<Record<string, string>> = {
  "lighthouse-greywater": "Before session 12",
  "clockwork-heist": "Before the finale",
  "starfall-season-two": "End of season one",
};

async function backUp(page: Page, world: string, note: string): Promise<void> {
  const item = page.locator(`${SHELL} .sts-world[data-world="${world}"]`);
  if ((await item.count()) === 0) {
    console.log(`No world ${world} on this server: skipped.`);
    return;
  }
  await item.click();
  await page.locator(`${SHELL} .stw-card`).first().waitFor();
  const tab = page
    .locator(`${SHELL} .sts-main`)
    .getByRole("tab", { name: /^Backups/ });
  await tab.click();
  await page
    .getByRole("button", { name: /Take (the first|a) backup/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").first().fill(note);
  await dialog.getByRole("button", { name: /Backup/ }).click();
  await page.waitForFunction(
    (sel) =>
      !/Backups\s*0\b/.test(document.querySelector(sel)?.textContent ?? ""),
    `${SHELL} .sts-main [role="tab"]:nth-child(3)`,
    { timeout: 120_000 },
  );
  console.log(`Backed up ${world}: ${note}`);
}

const { page, close } = await openStagehand(1);
try {
  for (const [world, note] of Object.entries(NOTES))
    await backUp(page, world, note);
} finally {
  await close();
}
