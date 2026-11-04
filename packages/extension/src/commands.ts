// Queued world commands and their two-phase acknowledgement (PRD 8.4).
import type { ApplyMode } from "@module-library/shared/apply";

export type CommandStatus =
  "pending" | "applying" | "applied" | "failed" | "declined" | "cancelled";

export interface Command {
  readonly id: string;
  readonly worldId: string;
  readonly type: "preset.apply";
  /** Spike: module ids directly; presets come with the library. */
  readonly payload: {
    readonly mode: ApplyMode;
    readonly modules: readonly string[];
  };
  readonly createdAt: string;
  readonly status: CommandStatus;
  readonly targetKey?: string;
  readonly error?: string;
}

export interface CommandAck {
  readonly id: string;
  readonly status: "applying" | "applied" | "failed" | "declined";
  readonly target?: readonly string[];
  readonly error?: string;
}

export interface ActiveState {
  readonly worldId: string;
  readonly active: readonly string[];
}

/** A comparable key for a set of module ids. */
export function activeIdsKey(ids: readonly string[]): string {
  return [...ids].sort().join("\n");
}

export function pendingFor(
  commands: readonly Command[],
  worldId: string,
): readonly Command[] {
  return commands.filter(
    (c) => c.worldId === worldId && c.status === "pending",
  );
}

export function acknowledge(
  commands: readonly Command[],
  ack: CommandAck,
): readonly Command[] {
  return commands.map((c) => {
    if (c.id !== ack.id) return c;
    const target = ack.target ? { targetKey: activeIdsKey(ack.target) } : {};
    const error = ack.error === undefined ? {} : { error: ack.error };
    return { ...c, ...target, ...error, status: ack.status };
  });
}

/** Applying commands of this world end as applied or failed by the snapshot. */
export function reconcile(
  commands: readonly Command[],
  state: ActiveState,
): readonly Command[] {
  const key = activeIdsKey(state.active);
  return commands.map((c) => {
    if (c.worldId !== state.worldId || c.status !== "applying") return c;
    return c.targetKey === key
      ? { ...c, status: "applied" as const }
      : {
          ...c,
          status: "failed" as const,
          error: "The world's modules after reload differ from the target.",
        };
  });
}
