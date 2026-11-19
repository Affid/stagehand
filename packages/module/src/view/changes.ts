// Changes not saved yet: local commands for this world, oldest first. A
// switch undoes its module's own earlier change or adds one, as on Setup
// (flipModule); a preset adds one. Saving resolves them all (idsOn).
import type { Command } from "@stagehand/shared/world";
import type { ModulesData } from "@stagehand/ui/model/data.ts";
import { type NewChange, previewApply } from "@stagehand/ui/model/preview.ts";
import { flipModule } from "@stagehand/ui/model/world-modules.ts";

/** A new change's id and time. */
export interface Fresh {
  readonly id: string;
  readonly createdAt: string;
}

const command = (
  worldId: string,
  change: NewChange,
  fresh: Fresh,
): Command => ({
  id: fresh.id,
  scope: "world",
  worldId,
  type: "preset.apply",
  payload: {
    mode: change.mode,
    presetIds: [...change.presetIds],
    ...(change.modules ? { modules: [...change.modules] } : {}),
  },
  createdAt: fresh.createdAt,
  baseSnapshotAt: null,
  status: "pending",
});

export function flipChange(
  data: ModulesData,
  worldId: string,
  moduleId: string,
  on: boolean,
  fresh: Fresh,
): readonly Command[] {
  const flip = flipModule(data, worldId, moduleId, on);
  const kept = data.commands.filter((c) => !flip.cancel.includes(c.id));
  return flip.queue ? [...kept, command(worldId, flip.queue, fresh)] : kept;
}

export const addChange = (
  changes: readonly Command[],
  worldId: string,
  change: NewChange,
  fresh: Fresh,
): readonly Command[] => [...changes, command(worldId, change, fresh)];

/** The modules on once saved: every change resolved, as Save writes them. */
export function idsOn(data: ModulesData, worldId: string): string[] {
  const { plan } = previewApply(data, { worldId, removeDependents: false });
  if (plan) return [...plan.target];
  return data.snapshots[worldId]?.active.map((m) => m.id) ?? [];
}
