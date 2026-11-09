// A world running, as the app sees it from Foundry's /join (Android plan,
// phase 3, package 6): Foundry's public status, the world from the join
// page's own data, and closing the world. Seen live on 14.370:
// `/api/status` gives active, version, world, system, systemVersion, users
// and uptime (milliseconds since the world started: Foundry's
// `Date.now() - start`); POST /setup {action: "worldShutdown", adminPassword}
// closes the world and lands on /setup. Without the right password Foundry
// answers with /join again, even for an administrator's session (checked
// live; a server without an admin password needs none).
import { z } from "zod";

const StatusSchema = z.object({
  active: z.boolean(),
  version: z.string().max(40).optional(),
  world: z.string().max(200).optional(),
  system: z.string().max(200).optional(),
  systemVersion: z.string().max(40).optional(),
  users: z.number().int().min(0).max(10_000).optional(),
  uptime: z.number().min(0).optional(),
});

export type Status = z.infer<typeof StatusSchema>;

export function parseStatus(raw: unknown): Status | undefined {
  const parsed = StatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The world as the join page knows it (`game.world`, `game.data`). */
export interface RunningWorld {
  readonly id: string;
  readonly title: string;
  readonly background: string | undefined;
}

const text = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;

interface JoinGame {
  readonly view?: unknown;
  readonly world?: Readonly<Record<string, unknown>>;
}

/** The running world, once Foundry's join page has its data. */
export function joinWorld(game: unknown): RunningWorld | undefined {
  const g = game as JoinGame | undefined;
  if (g?.view !== "join" || !g.world) return undefined;
  const id = text(g.world.id, 200);
  const title = text(g.world.title, 500);
  if (!id || !title) return undefined;
  return {
    id,
    title,
    background: text(g.world.background, 2000),
  };
}

const MS_PER_MINUTE = 60_000;

/** "1 h 40 min", "25 min", "under a minute", from Foundry's milliseconds. */
export function uptimeParts(ms: number): {
  readonly h: number;
  readonly min: number;
} {
  const total = Math.floor(ms / MS_PER_MINUTE);
  return { h: Math.floor(total / 60), min: total % 60 };
}

export interface ServerDeps {
  readonly fetch: typeof fetch;
  /** The server's own path for a route (`foundry.utils.getRoute`). */
  readonly route: (path: string) => string;
}

/** A request Foundry doesn't answer in this time has failed. */
export const REQUEST_MS = 10_000;

export async function fetchStatus(
  deps: ServerDeps,
): Promise<Status | undefined> {
  try {
    const res = await deps.fetch(deps.route("api/status"), {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REQUEST_MS),
    });
    return res.ok ? parseStatus(await res.json()) : undefined;
  } catch {
    return undefined;
  }
}

export type CloseResult = "closing" | "password" | "failed";

/**
 * Asks Foundry to close the world. "password": Foundry wants the admin
 * password (no admin session, or a wrong one).
 */
export async function closeWorld(
  deps: ServerDeps,
  password?: string,
): Promise<CloseResult> {
  try {
    const res = await deps.fetch(deps.route("setup"), {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REQUEST_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "worldShutdown",
        ...(password === undefined ? {} : { adminPassword: password }),
      }),
    });
    if (!res.ok) return "failed";
    // Foundry redirects: to Setup when it closes the world, else back to
    // the join page (no password, or a wrong one).
    const path = new URL(res.url).pathname;
    if (path.endsWith("/setup")) return "closing";
    return path.endsWith("/join") ? "password" : "failed";
  } catch {
    return "failed";
  }
}

/** A user who can join, as the join page knows them (`game.users`). */
export interface JoinUser {
  readonly id: string;
  readonly name: string;
  /** Assistant GM or Gamemaster (Foundry's roles 3 and 4). */
  readonly gm: boolean;
  /** The full Gamemaster (role 4): the only one the companion applies for. */
  readonly full: boolean;
}

const GM_ROLE = 3;
const FULL_GM_ROLE = 4;

/** The join page's users, Gamemasters first. */
export function joinUsers(game: unknown): JoinUser[] {
  const users = (
    game as { users?: { values?: () => Iterable<unknown> } } | undefined
  )?.users;
  if (typeof users?.values !== "function") return [];
  const list: { readonly user: JoinUser; readonly role: number }[] = [];
  for (const raw of users.values()) {
    const u = raw as { id?: unknown; name?: unknown; role?: unknown };
    const id = text(u.id, 200);
    const name = text(u.name, 200);
    if (!id || !name) continue;
    const role = typeof u.role === "number" ? u.role : 0;
    list.push({
      user: { id, name, gm: role >= GM_ROLE, full: role >= FULL_GM_ROLE },
      role,
    });
  }
  // Highest role first; Foundry's order otherwise (the sort is stable).
  return list.sort((a, b) => b.role - a.role).map((x) => x.user);
}

const SAME_SERVER_PATH = /^\/(?![/\\])[^\s\\]*$/;

export type JoinResult =
  | { readonly kind: "joined"; readonly redirect: string }
  | { readonly kind: "refused"; readonly message: string }
  | { readonly kind: "failed" };

/**
 * Joins the world as Foundry's join form does (POST /join with action
 * "join"): where Foundry sends the user on success (a path on this
 * server), its message when it refuses.
 */
export async function joinGame(
  deps: ServerDeps,
  userId: string,
  password: string,
): Promise<JoinResult> {
  try {
    const res = await deps.fetch(deps.route("join"), {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(REQUEST_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password, action: "join" }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      redirect?: unknown;
      error?: unknown;
      message?: unknown;
    };
    if (!res.ok) {
      const message = text(body.error, 500) ?? text(body.message, 500);
      return message ? { kind: "refused", message } : { kind: "failed" };
    }
    // Only a plain path on this server: no "//", no backslash or blank a
    // URL parser would turn into another host (review).
    const redirect = text(body.redirect, 2000);
    if (!redirect || !SAME_SERVER_PATH.test(redirect))
      return { kind: "failed" };
    return { kind: "joined", redirect };
  } catch {
    return { kind: "failed" };
  }
}
