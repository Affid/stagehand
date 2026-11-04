import { describe, expect, test } from "vitest";
import { computeTarget, type InstalledModule } from "../src/apply.ts";

const installed: readonly InstalledModule[] = [
  { id: "companion", requires: [] },
  { id: "a", requires: ["lib"] },
  { id: "lib", requires: ["base"] },
  { id: "base", requires: [] },
  { id: "x", requires: [] },
  { id: "needs-missing", requires: ["not-installed"] },
];

describe("computeTarget", () => {
  test("add mode keeps current modules and adds requirements recursively", () => {
    const result = computeTarget({
      mode: "add",
      current: ["companion", "x"],
      requested: ["a"],
      installed,
      companionId: "companion",
    });
    expect([...result.target].sort()).toEqual(
      ["a", "base", "companion", "lib", "x"].sort(),
    );
    expect(result.dependencyAdditions).toEqual(["lib", "base"]);
    expect(result.missing).toEqual([]);
  });

  test("replace mode keeps only the requested set and the companion", () => {
    const result = computeTarget({
      mode: "replace",
      current: ["companion", "x"],
      requested: ["base"],
      installed,
      companionId: "companion",
    });
    expect([...result.target].sort()).toEqual(["base", "companion"]);
  });

  test("remove mode never removes the companion", () => {
    const result = computeTarget({
      mode: "remove",
      current: ["companion", "x"],
      requested: ["companion", "x"],
      installed,
      companionId: "companion",
    });
    expect(result.target).toEqual(["companion"]);
  });

  test("reports requested ids that are not installed as missing", () => {
    const result = computeTarget({
      mode: "add",
      current: ["companion"],
      requested: ["ghost"],
      installed,
      companionId: "companion",
    });
    expect(result.missing).toEqual(["ghost"]);
    expect(result.target).toEqual(["companion"]);
  });

  test("blocks a module whose requirement is not installed", () => {
    const result = computeTarget({
      mode: "add",
      current: ["companion"],
      requested: ["needs-missing"],
      installed,
      companionId: "companion",
    });
    expect(result.blocked).toEqual([
      { id: "needs-missing", missing: ["not-installed"] },
    ]);
    expect(result.target).toEqual(["companion"]);
  });

  test("survives dependency cycles", () => {
    const cyclic: readonly InstalledModule[] = [
      { id: "companion", requires: [] },
      { id: "p", requires: ["q"] },
      { id: "q", requires: ["p"] },
    ];
    const result = computeTarget({
      mode: "add",
      current: ["companion"],
      requested: ["p"],
      installed: cyclic,
      companionId: "companion",
    });
    expect([...result.target].sort()).toEqual(["companion", "p", "q"]);
  });
});
