// Queued world commands (P-3, P-5, P-6) and their two-phase acknowledgement
// (PRD 8.4). Pure functions over the command list.
import type { Library } from "@module-library/shared/library/schema";
import type { ApplyMode } from "@module-library/shared/resolver";
import type { Command, WorldCommand } from "@module-library/shared/world";

export interface CommandAck {
  readonly id: string;
  /** The world the acknowledging companion runs in. */
  readonly worldId: string;
  readonly status: "applying" | "failed" | "declined";
  readonly target?: readonly string[] | undefined;
  readonly error?: string | undefined;
}

export interface NewCommand {
  readonly id: string;
  readonly worldId: string;
  readonly mode: ApplyMode;
  readonly presetIds: readonly string[];
  readonly createdAt: string;
  readonly baseSnapshotAt: string | null;
}

/** A comparable key for a set of module ids. */
export const activeIdsKey = (ids: readonly string[]): string =>
  [...ids].sort().join("\n");

export const queue = (list: readonly Command[], c: NewCommand): Command[] => [
  ...list,
  {
    id: c.id,
    scope: "world",
    worldId: c.worldId,
    type: "preset.apply",
    payload: { mode: c.mode, presetIds: [...c.presetIds] },
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

/** What the module receives: presets resolved against the current library. */
export function expandForWorld(
  commands: readonly Command[],
  library: Library,
): WorldCommand[] {
  return commands.map((c) => {
    const presets = c.payload.presetIds.flatMap((id) => {
      const p = library.presets.find((x) => x.id === id);
      return p ? [p] : [];
    });
    return {
      id: c.id,
      mode: c.payload.mode,
      presets: presets.map((p) => ({ id: p.id, name: p.name })),
      modules: [...new Set(presets.flatMap((p) => p.modules))],
    };
  });
}

const OPEN = new Set(["pending", "applying"]);

/** An ack counts only for an open command of the acknowledging world. */
export const isAcceptable = (
  list: readonly Command[],
  ack: CommandAck,
): boolean =>
  list.some(
    (c) => c.id === ack.id && c.worldId === ack.worldId && OPEN.has(c.status),
  );

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

export function acknowledge(
  list: readonly Command[],
  ack: CommandAck,
): Command[] {
  if (!isAcceptable(list, ack)) return [...list];
  return list.map((c) => {
    if (c.id !== ack.id) return c;
    const target = ack.target ? { targetKey: activeIdsKey(ack.target) } : {};
    const error = ack.error === undefined ? {} : { error: ack.error };
    return { ...c, ...target, ...error, status: ack.status };
  });
}

export interface ActiveState {
  readonly worldId: string;
  readonly active: readonly string[];
}

/** Applying commands of this world end as applied or failed by the snapshot. */
export function reconcile(
  list: readonly Command[],
  state: ActiveState,
): Command[] {
  const key = activeIdsKey(state.active);
  return list.map((c) => {
    if (c.worldId !== state.worldId || c.status !== "applying") return c;
    return c.targetKey === key
      ? { ...c, status: "applied" as const }
      : {
          ...c,
          status: "failed" as const,
          error:
            "After the reload, the world's modules differ from the target.",
        };
  });
}
