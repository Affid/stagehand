// Reads package data from Foundry's `game` on Setup (V-1). Reads package data
// and the UI language only; of game.data.options only the update channel and
// whether a password is set; never the licence or certificate (8.6).
import { logError } from "@module-library/shared/log";
import { MAX_NEWS, toNewsItem } from "@module-library/shared/news";
import { toPackageInfo } from "@module-library/shared/package-read";
import {
  MAX_DESCRIPTION,
  MAX_ID,
  MAX_TITLE,
  MAX_VERSION,
  ScheduleSchema,
  type SetupData,
  type WorldInfo,
} from "@module-library/shared/world";
import type { Collection, SetupGame } from "./globals.ts";

type Loose = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const all = (c?: Collection): Loose[] => [...(c?.values() ?? [])] as Loose[];

const THEMES: readonly unknown[] = ["default", "minimal"];

/** Join screen, safe mode, play time and the verified version, when sound. */
function worldExtras(w: Loose): Partial<WorldInfo> {
  const verified = str((w.compatibility as Loose | undefined)?.verified).slice(
    0,
    MAX_VERSION,
  );
  const playtime = w.playtime;
  return {
    ...(THEMES.includes(w.joinTheme)
      ? { joinTheme: w.joinTheme as "default" | "minimal" }
      : {}),
    ...(w.safeMode === true ? { safeMode: true } : {}),
    ...(typeof playtime === "number" &&
    Number.isInteger(playtime) &&
    playtime >= 0
      ? { playtime }
      : {}),
    ...(verified ? { verified } : {}),
    ...scheduleOf(w),
  };
}

/** Our schedule in the world's flags, when it passes the schema. */
function scheduleOf(w: Loose): Partial<WorldInfo> {
  const flags = w.flags as Loose | undefined;
  const ours = flags?.["module-library"] as Loose | undefined;
  const parsed = ScheduleSchema.safeParse(ours?.schedule);
  return parsed.success ? { schedule: parsed.data } : {};
}

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
    ...worldExtras(w),
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

/**
 * Whether an admin password is set: Foundry only offers Log out and Shut
 * down then. Only the yes or no crosses; Setup sends a placeholder anyway.
 */
function passwordSet(game: SetupGame): Pick<SetupData, "passwordSet"> {
  const options = game.data?.options;
  // Foundry sends a placeholder string, "" or null; true after a change.
  return options ? { passwordSet: Boolean(options.adminPassword) } : {};
}

/** Foundry's News and Featured Content, when it has any (Phase 6). */
function news(game: SetupGame): Pick<SetupData, "news" | "featured"> {
  const raw = game.data?.news;
  const items = (Array.isArray(raw) ? (raw as unknown[]) : []).flatMap(
    (n) => toNewsItem(n) ?? [],
  );
  // One article per link: the link is its key (review).
  const list = items
    .filter((n, i) => items.findIndex((m) => m.url === n.url) === i)
    .slice(0, MAX_NEWS);
  const featured = toNewsItem(game.data?.featuredContent);
  return {
    ...(list.length ? { news: list } : {}),
    ...(featured ? { featured } : {}),
  };
}

/** One package's data; a manifest we can't read is left out, not the list (review). */
function readable<T>(pkg: unknown, read: (p: unknown) => T): T[] {
  try {
    return [read(pkg)];
  } catch (e: unknown) {
    logError("package read", e);
    return [];
  }
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
    modules: all(game.modules).flatMap((m) => readable(m, toPackageInfo)),
    systems: all(game.systems).flatMap((s) =>
      readable(s, (x) => ({
        ...toPackageInfo(x),
        id: str(s.id).slice(0, MAX_ID),
        title: str(s.title).slice(0, MAX_TITLE),
        version: str(s.version).slice(0, MAX_VERSION),
      })),
    ),
    worlds: all(game.worlds).map(toWorld),
    ...coreUpdate(game),
    ...issues(game),
    ...news(game),
    ...passwordSet(game),
  };
}
