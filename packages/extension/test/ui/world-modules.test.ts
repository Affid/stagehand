import type { Command, Snapshot } from "@stagehand/shared/world";
import { describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { flipModule, worldModules } from "../../src/ui/model/world-modules.ts";
import { pkg, setupState } from "./harness.tsx";

const snap = (active: string[]): Snapshot => ({
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

let n = 0;
const cmd = (
  mode: "add" | "remove",
  over: { presetIds?: string[]; modules?: string[] },
): Command => ({
  id: `c${String(++n)}`,
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: {
    mode,
    presetIds: over.presetIds ?? [],
    ...(over.modules ? { modules: over.modules } : {}),
  },
  createdAt: "2026-11-05T01:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending",
});

const state = (
  active: string[] | undefined,
  commands: Command[] = [],
  over: Partial<SetupState> = {},
): SetupState =>
  setupState({
    snapshots: active ? { w1: snap(active) } : {},
    commands,
    ...over,
  });

const row = (s: SetupState, id: string) =>
  worldModules(s, "w1").rows.find((r) => r.pkg.id === id);

describe("a world's modules, now and after the next launch", () => {
  test("untracked world: nothing is known", () => {
    const m = worldModules(state(undefined), "w1");
    expect(m.tracked).toBe(false);
    expect(m.rows).toEqual([]);
  });

  test("now comes from the snapshot; nothing queued means no changes", () => {
    const m = worldModules(state(["stagehand", "a"]), "w1");
    expect(m.tracked).toBe(true);
    expect(m.changes).toBe(0);
    expect(m.nowCount).toBe(2);
    expect(row(state(["stagehand", "a"]), "a")).toMatchObject({
      now: true,
      next: true,
    });
    expect(m.rows.find((r) => r.pkg.id === "b")?.delta).toBeUndefined();
  });

  test("queued changes show as turns on / turns off, with dependencies", () => {
    const s = state(
      ["stagehand", "a"],
      [cmd("add", { modules: ["c"] }), cmd("remove", { modules: ["a"] })],
    );
    const m = worldModules(s, "w1");
    expect(row(s, "c")).toMatchObject({ now: false, next: true, delta: "on" });
    expect(row(s, "lib")).toMatchObject({ next: true, delta: "on" });
    expect(row(s, "a")).toMatchObject({ next: false, delta: "off" });
    expect(m.changes).toBe(3);
    expect(m.nextCount).toBe(3);
  });

  test("the companion is always on and says so", () => {
    const s = state(["stagehand"]);
    expect(row(s, "stagehand")?.why).toEqual({ kind: "companion" });
  });

  test("why: from a queued preset", () => {
    const s = state(["stagehand"], [cmd("add", { presetIds: ["p1"] })]);
    expect(row(s, "a")?.why).toEqual({ kind: "preset", name: "QoL" });
  });

  test("why: a module here needs it (info when on, a problem when off)", () => {
    const on = state(["stagehand", "c", "lib"]);
    expect(row(on, "lib")).toMatchObject({
      why: { kind: "neededBy", ids: ["c"] },
      problem: false,
    });
    const off = state(
      ["stagehand", "c", "lib"],
      [cmd("remove", { modules: ["lib"] })],
    );
    expect(row(off, "lib")).toMatchObject({
      next: false,
      why: { kind: "neededBy", ids: ["c"] },
      problem: true,
    });
    expect(row(off, "c")).toMatchObject({
      why: { kind: "needs", id: "lib" },
      problem: true,
    });
    expect(worldModules(off, "w1").problems).toBe(2);
  });

  test("why: conflicts with another module that's on", () => {
    const s = setupState({
      snapshots: { w1: snap(["stagehand", "x", "y"]) },
      setup: {
        ...setupState().setup!,
        modules: [
          pkg("stagehand"),
          pkg("x", { conflicts: [{ id: "y", type: "module" }] }),
          pkg("y"),
        ],
      },
    });
    expect(row(s, "x")).toMatchObject({
      why: { kind: "conflict", id: "y" },
      problem: true,
    });
  });

  test("why: can't turn on, with the resolver's reason", () => {
    const s = setupState({
      snapshots: { w1: snap(["stagehand"]) },
      commands: [cmd("add", { modules: ["d"] })],
      setup: {
        ...setupState().setup!,
        modules: [
          pkg("stagehand"),
          pkg("d", { requires: [{ id: "gone", type: "module" }] }),
        ],
      },
    });
    expect(row(s, "d")).toMatchObject({
      next: false,
      delta: undefined,
      why: { kind: "blocked", ids: ["gone"] },
      problem: true,
    });
  });

  test("a newer build of the verified generation is fine, as Foundry rates it", () => {
    const base = setupState();
    const s = state(["stagehand"], [], {
      setup: base.setup && {
        ...base.setup,
        modules: base.setup.modules.map((m) =>
          m.id === "a"
            ? { ...m, compatibility: { minimum: "13", verified: "14.300" } }
            : m,
        ),
      },
    });
    expect(row(s, "a")?.why).toEqual({ kind: "note", text: "for Strahd" });
    expect(row(s, "a")?.risk).toBe(false);
    expect(row(s, "b")?.risk).toBe(true);
  });

  test("why: not verified, then the note, then the authors", () => {
    const s = state(["stagehand"]);
    expect(row(s, "b")?.why).toEqual({ kind: "unverified" });
    // "a" has a library note.
    expect(row(s, "a")?.why).toEqual({ kind: "note", text: "for Strahd" });
    expect(row(s, "c")?.why).toEqual({ kind: "authors", text: "Ann" });
  });

  test("why: the description before the authors, as the prototype's cards", () => {
    const base = state(["stagehand"]);
    const s = state(["stagehand"], [], {
      setup: base.setup && {
        ...base.setup,
        modules: base.setup.modules.map((m) =>
          m.id === "c" ? { ...m, description: "Dice in 3D." } : m,
        ),
      },
    });
    expect(row(s, "c")?.why).toEqual({
      kind: "description",
      text: "Dice in 3D.",
    });
  });
});

describe("flipping a module's switch", () => {
  test("turning one on queues a single-module change", () => {
    const s = state(["stagehand"]);
    expect(flipModule(s, "w1", "a", true)).toEqual({
      cancel: [],
      queue: { mode: "add", presetIds: [], modules: ["a"] },
    });
  });

  test("turning one off queues a removal", () => {
    const s = state(["stagehand", "a"]);
    expect(flipModule(s, "w1", "a", false)).toEqual({
      cancel: [],
      queue: { mode: "remove", presetIds: [], modules: ["a"] },
    });
  });

  test("flipping back undoes the earlier change instead of adding another", () => {
    const on = cmd("add", { modules: ["a"] });
    const s = state(["stagehand"], [on]);
    expect(flipModule(s, "w1", "a", false)).toEqual({ cancel: [on.id] });
  });

  test("turning off what a preset adds keeps the preset and removes the module", () => {
    const preset = cmd("add", { presetIds: ["p1"] });
    const s = state(["stagehand"], [preset]);
    expect(flipModule(s, "w1", "a", false)).toEqual({
      cancel: [],
      queue: { mode: "remove", presetIds: [], modules: ["a"] },
    });
  });

  test("a switch that already matches changes nothing", () => {
    const s = state(["stagehand", "a"]);
    expect(flipModule(s, "w1", "a", true)).toEqual({ cancel: [] });
  });
});
