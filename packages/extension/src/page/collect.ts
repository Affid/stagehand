// Reads package data from Foundry's `game` on Setup (V-1). Reads package data
// and the UI language only: never game.data.options, licence or certificate
// (8.6).
import { toPackageInfo } from "@module-library/shared/package-read";
import {
  MAX_DESCRIPTION,
  MAX_ID,
  MAX_TITLE,
  MAX_VERSION,
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
    id: str(w.id).slice(0, MAX_ID),
    title: str(w.title).slice(0, MAX_TITLE),
    system: str(w.system).slice(0, MAX_ID),
    systemVersion: str(w.systemVersion).slice(0, MAX_VERSION),
    coreVersion: str(w.coreVersion).slice(0, MAX_VERSION),
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
  // Without an update the check names no channel: Foundry's setting does.
  const channel = str(u.channel) || str(game.data?.options?.updateChannel);
  return {
    coreUpdate: {
      hasUpdate: u.hasUpdate,
      channel: channel.slice(0, 30),
      version: str(u.version).slice(0, 30),
      canUpdate: u.canUpdate !== false,
      reachable: u.couldReachWebsite !== false,
    },
  };
}

/** Foundry's setup warnings, when it gives a plain count. */
function issues(game: SetupGame): Pick<SetupData, "issues"> {
  const n = game.issueCount?.total;
  return typeof n === "number" && Number.isInteger(n) && n >= 0
    ? { issues: Math.min(n, 1_000_000) }
    : {};
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
      id: str(s.id).slice(0, MAX_ID),
      title: str(s.title).slice(0, MAX_TITLE),
      version: str(s.version).slice(0, MAX_VERSION),
    })),
    worlds: all(game.worlds).map(toWorld),
    ...coreUpdate(game),
    ...issues(game),
  };
}
