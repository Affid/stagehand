// Commands and snapshots shared by the Game Worlds tests.
import type { Command, Snapshot } from "@stagehand/shared/world";

export const pending: Command = {
  id: "c1",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: ["p1"] },
  createdAt: "2026-11-05T09:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending",
};

export const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: [
    { id: "stagehand", version: "0.1.0" },
    { id: "b", version: "1.0.0" },
  ],
  companionVersion: "0.1.0",
  takenAt: new Date().toISOString(),
  ...over,
});

export const W2 = {
  id: "w2",
  title: "Phandelver",
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.369",
};
