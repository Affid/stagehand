// Waits for slide-ins (sheets, menus, dialogs) to end, for checks and
// screenshots that must not catch them half way. Looping animations
// (spinners) are left out. Only animations already started count, so wait
// for the element itself to show first.
import { expect, type Page } from "@playwright/test";

export async function settled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                a.effect?.getTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
}
