// Queued world commands (P-3, P-5, P-6), and how they meet the world's own
// queue and the companion's report (docs/COMPANION-WORLD-PROTOCOL.md).
// Pure functions over the command list.
import type { Library } from "@stagehand/shared/library/schema";
import type { ApplyMode } from "@stagehand/shared/resolver";
import { type Command, changeModules } from "@stagehand/shared/world";
import type {
  QueueEntry,
  Result,
  StagehandFlags,
} from "@stagehand/shared/world-flags";

export interface NewCommand {
  readonly id: string;
  readonly worldId: string;
  readonly mode: ApplyMode;
  readonly presetIds: readonly string[];
  readonly modules?: readonly string[] | undefined;
  readonly createdAt: string;
  readonly baseSnapshotAt: string | null;
}

export const queue = (list: readonly Command[], c: NewCommand): Command[] => [
  ...list,
  {
    id: c.id,
    scope: "world",
    worldId: c.worldId,
    type: "preset.apply",
    payload: {
      mode: c.mode,
      presetIds: [...c.presetIds],
      ...(c.modules?.length ? { modules: [...c.modules] } : {}),
    },
    createdAt: c.createdAt,
    baseSnapshotAt: c.baseSnapshotAt,
    status: "pending",
  },
];

export const cancel = (list: readonly Command[], id: string): Command[] =>
  list.map((c) =>
    c.id === id && c.status === "pending"
      ? { ...c, status: "cancelled" as const }
      : c,
  );

export const pendingFor = (
  list: readonly Command[],
  worldId: string,
): Command[] =>
  list.filter((c) => c.worldId === worldId && c.status === "pending");

const isoOr = (time: string, fallback: string): string => {
  const ms = Date.parse(time);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
};

/**
 * The world's queue: presets resolved against the current library, plus
 * modules picked one by one. A change queued on another device keeps the
 * preset names it came with.
 */
export function toQueue(
  commands: readonly Command[],
  library: Library,
  now: string,
): QueueEntry[] {
  return commands.map((c) => {
    const presets = c.payload.presetIds.flatMap((id) => {
      const p = library.presets.find((x) => x.id === id);
      return p ? [p] : [];
    });
    const names = presets.length
      ? presets.map((p) => ({ id: p.id, name: p.name.slice(0, 100) }))
      : (c.payload.presets ?? []);
    return {
      id: c.id,
      mode: c.payload.mode,
      presets: names.slice(0, 20),
      modules: changeModules(presets, c.payload),
      queuedAt: isoOr(c.createdAt, now),
    };
  });
}

const OPEN: ReadonlySet<string> = new Set(["pending", "applying"]);

/**
 * Pending commands of this world whose presets were deleted fail, rather
 * than reaching the world as an empty (for Replace: destructive) change.
 */
export function failOrphans(
  list: readonly Command[],
  library: Library,
  worldId: string,
): Command[] {
  const known = new Set(library.presets.map((p) => p.id));
  return list.map((c) =>
    c.worldId === worldId &&
    c.status === "pending" &&
    c.payload.presetIds.some((id) => !known.has(id))
      ? {
          ...c,
          status: "failed" as const,
          error: "A preset of this command was deleted. Queue it again.",
        }
      : c,
  );
}

/** A change as the companion's report says it went. */
function fromResult(c: Command, r: Result): Command {
  const error = r.error === undefined ? {} : { error: r.error };
  if (r.status === "applying")
    return {
      ...c,
      status: "applying",
      ...(r.targetKey === undefined ? {} : { targetKey: r.targetKey }),
    };
  return { ...c, ...error, status: r.status };
}

/** Control and direction characters go from names read from the world. */
const isShown = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  const control = code < 0x20 || code === 0x7f;
  const direction =
    (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  return !control && !direction;
};
const cleanName = (name: string): string =>
  Array.from(name).filter(isShown).join("");

/**
 * A change another device queued for this world, as ours: dated when it
 * was imported (a forged early date must not untick "Back up first").
 */
const imported = (worldId: string, e: QueueEntry, now: string): Command => ({
  id: e.id,
  scope: "world",
  worldId,
  type: "preset.apply",
  payload: {
    mode: e.mode,
    presetIds: [],
    modules: [...e.modules],
    ...(e.presets.length
      ? {
          presets: e.presets.map((p) => ({
            id: p.id,
            name: cleanName(p.name),
          })),
        }
      : {}),
  },
  createdAt: now,
  baseSnapshotAt: null,
  status: "pending",
  inWorld: true,
});

const LOST =
  "The world no longer says how this change went. Check the world's modules.";

/**
 * Our change, written into the world, isn't in its queue and has no result:
 * removed by a later write (another device: cancelled), gone by our own last
 * write's time (the companion took it; its result wasn't kept), or read
 * from before our write (nothing to say).
 */
function leftQueue(c: Command, written: string | undefined): Command {
  const theirs = Date.parse(written ?? "");
  const ours = Date.parse(c.inWorldAt ?? "");
  if (!Number.isFinite(theirs) || !Number.isFinite(ours)) return c;
  if (theirs > ours) return { ...c, status: "cancelled" };
  if (theirs === ours) return { ...c, status: "failed", error: LOST };
  return c;
}

/** Changes of a world past this many, closed ones go, oldest first. */
export const MAX_CLOSED_PER_WORLD = 50;

function capClosed(list: readonly Command[], worldId: string): Command[] {
  const closed = list.filter(
    (c) => c.worldId === worldId && !OPEN.has(c.status),
  );
  const drop = new Set(
    closed.slice(0, Math.max(0, closed.length - MAX_CLOSED_PER_WORLD)),
  );
  return list.filter((c) => !drop.has(c));
}

/**
 * This world's changes as its flags tell them. Only changes written into
 * the world take its word (a result for anything else is ignored); changes
 * queued elsewhere join; the world's closed history stays bounded.
 */
export function syncFromWorld(
  list: readonly Command[],
  worldId: string,
  flags: StagehandFlags,
  now: string,
): Command[] {
  if (flags.newer) return [...list];
  const results = new Map((flags.report?.results ?? []).map((r) => [r.id, r]));
  const queued = new Set(flags.queue.map((e) => e.id));
  // An unreadable queue says nothing about what left it.
  const trustQueue = flags.unreadable !== true;
  const updated = list.map((c) => {
    if (c.worldId !== worldId || !OPEN.has(c.status) || !c.inWorld) return c;
    const r = results.get(c.id);
    if (r) return fromResult(c, r);
    if (trustQueue && c.status === "pending" && !queued.has(c.id))
      return leftQueue(c, flags.written);
    return c;
  });
  const known = new Set(list.map((c) => c.id));
  const added = trustQueue
    ? flags.queue.filter((e) => !known.has(e.id) && !results.has(e.id))
    : [];
  const all = [...updated, ...added.map((e) => imported(worldId, e, now))];
  return capClosed(all, worldId);
}

/** These pending changes are now in the world's queue, written at `at`. */
export const markInWorld = (
  list: readonly Command[],
  worldId: string,
  ids: readonly string[],
  at?: string,
): Command[] =>
  list.map((c) =>
    c.worldId === worldId && c.status === "pending" && ids.includes(c.id)
      ? { ...c, inWorld: true, ...(at === undefined ? {} : { inWorldAt: at }) }
      : c,
  );
