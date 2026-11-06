// Your packages on a release (package 7): Foundry's availability codes as
// the prototype's statuses, where each package is used, what to update, and
// a world judged by its system with its modules to check.
import type { Snapshot } from "@module-library/shared/world";
import { describe, expect, test } from "vitest";
import type { CompatEntry, Preview } from "../../src/page-compat.ts";
import {
  byConcern,
  compatData,
  statusOf,
  toCheck,
  updatesNeeded,
} from "../../src/ui/shell/server/update/compat.ts";
import { setupState } from "./harness.tsx";

const entry = (
  id: string,
  availability: number,
  over: Partial<CompatEntry> = {},
): CompatEntry => ({
  id,
  title: `Title ${id}`,
  version: "1.0.0",
  availability,
  verified: "14",
  maximum: null,
  requires: [],
  ...over,
});

const snap = (active: string[]): Snapshot => ({
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

const PREVIEW: Preview = {
  system: [entry("dnd5e", 1, { version: "5.2" })],
  module: [
    entry("a", 1, { version: "2.0.0" }),
    entry("b", 4, { verified: "13" }),
    entry("c", 6, { requires: ["lib"] }),
    entry("lib", 7, { maximum: "13" }),
    entry("module-library", 2),
  ],
  world: [entry("w1", 1, { version: null, system: "dnd5e" })],
};

describe("Foundry's availability codes", () => {
  test("as its Compatibility Checker groups them", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 99].map(statusOf)).toEqual([
      "ok",
      "unv",
      "unv",
      "risk",
      "dep",
      "dep",
      "bad",
      "bad",
      "bad",
      "bad",
      "dep",
      "risk",
      "risk",
    ]);
  });
});

describe("compatData", () => {
  const state = setupState({
    snapshots: { w1: snap(["module-library", "a", "c", "lib"]) },
  });
  const d = compatData(state, PREVIEW);

  test("a module: where it is on, and whether its newest is newer", () => {
    const a = d.module.find((x) => x.id === "a");
    expect(a?.worlds.map((w) => w.id)).toEqual(["w1"]);
    expect(a?.needsUpdate).toBe(true);
    expect(d.module.find((x) => x.id === "b")?.worlds).toEqual([]);
  });

  test("a missing dependency names the one that isn't compatible", () => {
    expect(d.module.find((x) => x.id === "c")?.dep).toBe("Title lib");
  });

  test("a system is used by the worlds on it; a world is as its system", () => {
    expect(d.system[0]?.worlds.map((w) => w.id)).toEqual(["w1"]);
    const w = d.world[0];
    expect(w?.status).toBe("ok");
    expect(w?.mine?.map((m) => m.id).sort()).toEqual(["a", "c", "lib"]);
    expect(w?.off?.map((m) => m.id).sort()).toEqual(["c", "lib"]);
    expect(w && toCheck(w)).toBe(true);
  });

  test("a world without the companion has unknown modules", () => {
    const d2 = compatData(setupState(), PREVIEW);
    expect(d2.world[0]?.unknown).toBe(true);
    expect(d2.world[0]?.mine).toEqual([]);
  });

  test("worst first, then the most used; updates needed leave out incompatible", () => {
    const order = [...d.module].sort(byConcern).map((x) => x.id);
    expect(order).toEqual(["lib", "c", "b", "module-library", "a"]);
    expect(updatesNeeded(d)).toBe(2);
  });
});
