// A world running, as the app sees it from Foundry's /join (Android plan,
// phase 3, package 6): Foundry's public status, the world from the join
// page's own data, and closing the world. Seen live on 14.370:
// `/api/status` gives active, version, world, system, systemVersion, users
// and uptime (seconds); POST /setup {action: "worldShutdown", adminPassword}
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

/** "1 h 40 min", "25 min", "under a minute". */
export function uptimeParts(seconds: number): {
  readonly h: number;
  readonly min: number;
} {
  const total = Math.floor(seconds / 60);
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
