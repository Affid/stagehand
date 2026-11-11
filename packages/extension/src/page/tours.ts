// Foundry's tours on our Setup page (owner, 2026-11-11). Its backups
// overview starts by itself the first time Setup opens (client/game.mjs,
// "Initial prompts"); its steps point at Foundry's own Setup, which our
// page covers, so over ours it only gets in the way. It is kept from
// starting here; Foundry's progress setting is left alone, so the tour
// still comes on Foundry's own Setup.
import type { PageGlobals } from "./globals.ts";

/** The tours Foundry starts without being asked on Setup. */
const SELF_STARTING = ["core.backupsOverview"];

interface Startable {
  start: () => Promise<void>;
}

const isStartable = (tour: unknown): tour is Startable =>
  typeof tour === "object" &&
  tour !== null &&
  typeof (tour as { start?: unknown }).start === "function";

/**
 * Makes Foundry's self-starting Setup tours do nothing when started; false
 * while Foundry hasn't registered them yet (asked again then).
 */
export function quietSetupTours(page: PageGlobals): boolean {
  const tours = page.game?.tours;
  let quiet = false;
  for (const id of SELF_STARTING) {
    const tour = tours?.get?.(id);
    if (!isStartable(tour)) continue;
    tour.start = () => Promise.resolve();
    quiet = true;
  }
  return quiet;
}

/** Closes a tour that is already on screen (ours came up after it started). */
export function exitActiveTour(page: PageGlobals): void {
  // Called on Foundry's object: exit reads its own step through `this`.
  page.foundry?.nue?.Tour?.activeTour?.exit();
}
