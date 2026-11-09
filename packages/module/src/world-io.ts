// The companion's way to the world's flags and the server's clock
// (docs/COMPANION-WORLD-PROTOCOL.md). A full Gamemaster may save the
// running world through Foundry's own world edit (POST /setup "editWorld",
// checked on 13.351 and 14.370); the page's copy of the world shows a save
// only after a reload, so each save is also applied to it here, and told
// to whoever listens (the Android app watching its changes apply).
import { logError } from "@module-library/shared/log";
import { byteSize, MAX_SAVE_BYTES } from "@module-library/shared/world-flags";
import { FLAGS_KEY } from "@module-library/shared/world";
import type { FoundryWorld } from "./foundry.ts";

/** The server's time now and when the running world started (ms). */
export interface ServerClock {
  readonly now: number;
  readonly worldStart: number;
}

export interface WorldIo {
  /** Our flags as the page has them (untrusted). */
  readonly flags: () => unknown;
  /** Merges a change into our flags; false when Foundry refused it. */
  readonly save: (change: object) => Promise<boolean>;
  readonly clock: () => Promise<ServerClock | undefined>;
}

/** Neither request may hold the session up for long. */
const TIMEOUT_MS = 15_000;

/** Said after each save, with our flags as they now are. */
export const SAVED_HOOK = "stagehandSaved";

export interface WorldIoDeps {
  readonly fetch: typeof fetch;
  readonly route: (path: string) => string;
  readonly world: FoundryWorld;
  readonly hooks: { callAll(name: string, ...args: unknown[]): boolean };
}

type Loose = Readonly<Record<string, unknown>>;

const ourFlags = (world: FoundryWorld): unknown => world.flags?.[FLAGS_KEY];

async function post(deps: WorldIoDeps, body: object): Promise<boolean> {
  const res = await deps.fetch(deps.route("setup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Refused requests redirect to the join page: not a save.
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return false;
  const answer: unknown = await res.json().catch(() => null);
  const refused =
    typeof answer === "object" && answer !== null && "error" in answer;
  return !refused;
}

async function save(deps: WorldIoDeps, change: object): Promise<boolean> {
  const body = {
    action: "editWorld",
    id: deps.world.id,
    flags: { [FLAGS_KEY]: change },
  };
  // Foundry refuses a body over 100 KB: callers fit the report first.
  if (byteSize(body) > MAX_SAVE_BYTES) return false;
  try {
    if (!(await post(deps, body))) return false;
  } catch (error: unknown) {
    logError("companion save", error);
    return false;
  }
  // Saved on the server: the page's copy is a courtesy, and its failure
  // must not read as an unsaved record (review).
  try {
    deps.world.updateSource?.({ flags: { [FLAGS_KEY]: change } });
    deps.hooks.callAll(SAVED_HOOK, ourFlags(deps.world));
  } catch (error: unknown) {
    logError("companion save", error);
  }
  return true;
}

/**
 * Foundry's public status says how long the world has run (`uptime`, in
 * ms); its Date header is the server's time. A launch's intent is stamped
 * with the same clock on Setup, so device clocks never matter.
 */
async function clock(deps: WorldIoDeps): Promise<ServerClock | undefined> {
  try {
    // Never a cached answer: an old one would date an old launch's intent
    // as this launch's (security review).
    const res = await deps.fetch(deps.route("api/status"), {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const now = Date.parse(res.headers.get("Date") ?? "");
    const status = (await res.json()) as Loose;
    const uptime = status.uptime;
    if (!Number.isFinite(now) || typeof uptime !== "number" || uptime < 0)
      return undefined;
    return { now, worldStart: now - uptime };
  } catch (error: unknown) {
    logError("companion clock", error);
    return undefined;
  }
}

export function createWorldIo(deps: WorldIoDeps): WorldIo {
  return {
    flags: () => ourFlags(deps.world),
    save: (change) => save(deps, change),
    clock: () => clock(deps),
  };
}
