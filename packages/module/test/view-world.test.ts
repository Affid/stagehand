// The in-world modules view's data: this world only, its live modules, and
// unsaved changes kept as local commands that Setup's model reads unchanged.
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import { previewApply } from "@stagehand/ui/model/preview.ts";
import { worldModules } from "@stagehand/ui/model/world-modules.ts";
import { describe, expect, it } from "vitest";
import { addChange, flipChange, idsOn } from "../src/view/changes.ts";
import { worldData } from "../src/view/world-data.ts";
import { fakeGame } from "./fakes.ts";

const NOW = "2026-11-19T10:00:00.000Z";
const LIB: Library = {
  ...emptyLibrary("here"),
  presets: [
    {
      id: "p1",
      name: "Combat",
      description: "",
      modules: ["b", "c"],
      source: "user",
      revision: 1,
    },
  ],
};

const game = () =>
  fakeGame([
    { id: "stagehand", active: true },
    { id: "a", active: true },
    { id: "b" },
    { id: "c", requires: ["lib"] },
    { id: "lib" },
  ]).game;

let n = 0;
const fresh = () => ({ id: `c${String(++n)}`, createdAt: NOW });

describe("worldData", () => {
  it("knows this world only, with its live modules as the snapshot", () => {
    // Arrange
    const g = game();

    // Act
    const data = worldData(g, LIB, [], NOW);

    // Assert
    expect(data.setup.worlds.map((w) => w.id)).toEqual(["w1"]);
    expect(data.setup.modules.map((m) => m.id)).toEqual([
      "stagehand",
      "a",
      "b",
      "c",
      "lib",
    ]);
    expect(data.setup.core.version).toBe("14.369");
    expect(Object.keys(data.snapshots)).toEqual(["w1"]);
    expect(data.snapshots.w1?.active.map((m) => m.id)).toEqual([
      "stagehand",
      "a",
    ]);
    expect(data.library).toBe(LIB);
  });

  it("shows every module as it is when nothing has changed", () => {
    const data = worldData(game(), LIB, [], NOW);

    const model = worldModules(data, "w1");

    expect(model.tracked).toBe(true);
    expect(model.changes).toBe(0);
    expect(model.next).toEqual(["stagehand", "a"]);
  });
});

describe("unsaved changes", () => {
  it("marks a switched-on module as turning on", () => {
    const data = worldData(game(), LIB, [], NOW);

    const changes = flipChange(data, "w1", "b", true, fresh());
    const model = worldModules(worldData(game(), LIB, changes, NOW), "w1");

    expect(changes).toHaveLength(1);
    expect(model.rows.find((r) => r.pkg.id === "b")?.delta).toBe("on");
    expect(model.changes).toBe(1);
  });

  it("forgets the change when the switch goes back", () => {
    const g = game();
    const on = flipChange(worldData(g, LIB, [], NOW), "w1", "b", true, fresh());

    const back = flipChange(
      worldData(g, LIB, on, NOW),
      "w1",
      "b",
      false,
      fresh(),
    );

    expect(back).toEqual([]);
  });

  it("adds a dependency with the module that needs it", () => {
    const g = game();
    const changes = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "c",
      true,
      fresh(),
    );

    const plan = previewApply(worldData(g, LIB, changes, NOW), {
      worldId: "w1",
      removeDependents: false,
    }).plan;

    expect(plan?.dependencyAdditions).toEqual(["lib"]);
    expect(idsOn(worldData(g, LIB, changes, NOW), "w1")).toEqual(
      expect.arrayContaining(["stagehand", "a", "c", "lib"]),
    );
  });

  it("marks a preset's modules, after the changes before it", () => {
    const g = game();
    const first = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "a",
      false,
      fresh(),
    );

    const changes = addChange(
      first,
      "w1",
      { mode: "add", presetIds: ["p1"] },
      fresh(),
    );
    const model = worldModules(worldData(g, LIB, changes, NOW), "w1");

    expect(changes.map((c) => c.payload.mode)).toEqual(["remove", "add"]);
    expect(model.next).toEqual(
      expect.arrayContaining(["stagehand", "b", "c", "lib"]),
    );
    expect(model.next).not.toContain("a");
  });
});
