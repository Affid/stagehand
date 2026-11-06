// Which worlds the Library's By world grid shows (SETUP-REDESIGN.md: the
// Show filter), always in Foundry's own order.
import type { WorldInfo } from "@module-library/shared/world";
import type { SetupState } from "../../messages.ts";
import { worldOrder } from "./order.ts";
import { pendingFor } from "./preview.ts";
import { worldModules } from "./world-modules.ts";

export type GridShow = "all" | "fav" | "recent" | "attention" | "pick";
export const GRID_SHOWS: readonly GridShow[] = [
  "all",
  "fav",
  "recent",
  "attention",
  "pick",
];

/** "Played in the last 3 months". */
const RECENT_MS = 92 * 24 * 60 * 60 * 1000;

export interface GridWorlds {
  readonly shown: readonly WorldInfo[];
  readonly total: number;
  /** Hidden by the filter but with changes queued: worth a link. */
  readonly hiddenQueued: readonly WorldInfo[];
}

const queued = (state: SetupState, id: string): boolean =>
  pendingFor(state, id).length > 0;

function keep(
  state: SetupState,
  show: GridShow,
  picked: readonly string[],
  now: number,
): (w: WorldInfo) => boolean {
  switch (show) {
    case "fav":
      return (w) => w.favorite === true;
    case "recent":
      return (w) => {
        const t = Date.parse(w.lastPlayed ?? "");
        return Number.isFinite(t) && now - t <= RECENT_MS;
      };
    case "attention":
      return (w) =>
        queued(state, w.id) || worldModules(state, w.id).problems > 0;
    case "pick":
      return (w) => picked.includes(w.id);
    default:
      return () => true;
  }
}

export function gridWorlds(
  state: SetupState,
  show: GridShow,
  picked: readonly string[],
  now: number,
): GridWorlds {
  const all = worldOrder(state.setup?.worlds ?? [], state.setup?.lang);
  const shown = all.filter(keep(state, show, picked, now));
  return {
    shown,
    total: all.length,
    hiddenQueued: all.filter((w) => !shown.includes(w) && queued(state, w.id)),
  };
}
