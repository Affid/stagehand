// Foundry windows opened from our page start where Foundry's hidden layout
// would put them; move them into view, centred under our header.
import type { PageGlobals } from "./globals.ts";

const PLACE_TOP = 80;
const PLACE_TRIES = 40;

/** Waits for the window to render (a few frames), then places it. */
export async function placeInView(
  page: Pick<PageGlobals, "foundry">,
  id: string,
): Promise<void> {
  for (let i = 0; i < PLACE_TRIES; i++) {
    const app = page.foundry?.applications?.instances?.get(id);
    if (app?.rendered) {
      const w = app.position?.width;
      const width = typeof w === "number" ? w : 600;
      const left = Math.max(16, Math.round((innerWidth - width) / 2));
      app.setPosition({ left, top: PLACE_TOP });
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}
