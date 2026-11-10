import type { WorldInfo } from "@stagehand/shared/world";
import { describe, expect, test } from "vitest";
import { gridWorlds } from "../../src/ui/model/world-grid.ts";
import { setupState } from "./harness.tsx";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString();

const world = (id: string, over: Partial<WorldInfo> = {}): WorldInfo => ({
  id,
  title: id,
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.369",
  ...over,
});

const worlds = [
  world("old", { lastPlayed: ago(200) }),
  world("fav", { favorite: true, lastPlayed: ago(400) }),
  world("new", { lastPlayed: ago(3) }),
  world("never"),
];
const snap = (id: string) => ({
  worldId: id,
  title: id,
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: [{ id: "stagehand", version: "1" }],
  companionVersion: "0.1.0",
  takenAt: ago(1),
});
const base = setupState();
const state = setupState({
  setup: base.setup ? { ...base.setup, worlds } : undefined,
  snapshots: { old: snap("old"), new: snap("new") },
  commands: [
    {
      id: "c1",
      scope: "world",
      worldId: "old",
      type: "preset.apply",
      payload: { mode: "add", presetIds: [], modules: ["a"] },
      createdAt: ago(1),
      baseSnapshotAt: null,
      status: "pending",
    },
  ],
});

const ids = (show: Parameters<typeof gridWorlds>[1], picked: string[] = []) =>
  gridWorlds(state, show, picked, NOW).shown.map((w) => w.id);

describe("which worlds the By world grid shows", () => {
  test("all, in Foundry's order", () => {
    expect(ids("all")).toEqual(["fav", "new", "old", "never"]);
  });

  test("favourites", () => {
    expect(ids("fav")).toEqual(["fav"]);
  });

  test("played in the last three months", () => {
    expect(ids("recent")).toEqual(["new"]);
  });

  test("with changes or problems", () => {
    expect(ids("attention")).toEqual(["old"]);
  });

  test("chosen worlds, still in Foundry's order", () => {
    expect(ids("pick", ["never", "fav"])).toEqual(["fav", "never"]);
  });

  test("names hidden worlds that have queued changes", () => {
    const r = gridWorlds(state, "fav", [], NOW);
    expect(r.total).toBe(4);
    expect(r.hiddenQueued.map((w) => w.id)).toEqual(["old"]);
    expect(gridWorlds(state, "all", [], NOW).hiddenQueued).toEqual([]);
  });
});
