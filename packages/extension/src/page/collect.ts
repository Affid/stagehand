// Reads package data from Foundry's `game` on Setup (V-1). Reads package data
// and the UI language only: never game.data.options, licence or certificate
// (8.6).
import { toPackageInfo } from "@module-library/shared/package-read";
import {
  MAX_DESCRIPTION,
  type SetupData,
  type WorldInfo,
} from "@module-library/shared/world";
import type { Collection, SetupGame } from "./globals.ts";

type Loose = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const all = (c?: Collection): Loose[] => [...(c?.values() ?? [])] as Loose[];

const toWorld = (w: Loose): WorldInfo => {
  const lastPlayed = str(w.lastPlayed);
  const background = str(w.background);
  const description = str(w.description).slice(0, MAX_DESCRIPTION);
  const nextSession = str(w.nextSession).slice(0, 64);
  return {
    id: str(w.id),
    title: str(w.title),
    system: str(w.system),
    systemVersion: str(w.systemVersion),
    coreVersion: str(w.coreVersion),
    // Foundry's Setup marks favourites on its package objects when it renders.
    favorite: w.favorite === true,
    locked: w.locked === true,
    ...(lastPlayed ? { lastPlayed } : {}),
    ...(background ? { background } : {}),
    ...(description ? { description } : {}),
    ...(nextSession ? { nextSession } : {}),
  };
};

/**
 * Whether Foundry has an update, on which channel, and its version. Picked
 * field by field: the update data also holds a time-limited download link,
 * which must never be read, logged or stored.
 */
function coreUpdate(game: SetupGame): Pick<SetupData, "coreUpdate"> {
  const u = (game.data as { coreUpdate?: Record<string, unknown> } | undefined)
    ?.coreUpdate;
  if (!u || typeof u.hasUpdate !== "boolean") return {};
  return {
    coreUpdate: {
      hasUpdate: u.hasUpdate,
      channel: str(u.channel).slice(0, 30),
      version: str(u.version).slice(0, 30),
    },
  };
}

export function collect(game: SetupGame): SetupData {
  const release = game.release ?? { generation: 0, build: 0 };
  return {
    core: {
      version: `${String(release.generation)}.${String(release.build)}`,
      generation: release.generation,
      build: release.build,
    },
    isAdmin: game.data?.isAdmin === true,
    lang: game.i18n?.lang ?? "",
    modules: all(game.modules).map(toPackageInfo),
    systems: all(game.systems).map((s) => ({
      id: str(s.id),
      title: str(s.title),
      version: str(s.version),
    })),
    worlds: all(game.worlds).map(toWorld),
    ...coreUpdate(game),
  };
}
