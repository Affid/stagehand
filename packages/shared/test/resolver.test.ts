import { describe, expect, test } from "vitest";
import type { PackageInfo, Relation } from "../src/package.ts";
import { resolvePlan, type ResolveInput } from "../src/resolver.ts";
import { parseCoreVersion } from "../src/version.ts";

const pkg = (
  id: string,
  over: Partial<PackageInfo> & { req?: (string | Relation)[] } = {},
): PackageInfo => {
  const { req = [], ...rest } = over;
  return {
    id,
    title: id,
    version: "1.0.0",
    authors: [],
    library: false,
    hasPacks: false,
    hasCode: true,
    compatibility: { minimum: "13", verified: "14" },
    requires: req.map((r) =>
      typeof r === "string" ? { id: r, type: "module" } : r,
    ),
    recommends: [],
    conflicts: [],
    systems: [],
    ...rest,
  };
};

const installed: PackageInfo[] = [
  pkg("companion"),
  pkg("a", { req: ["lib"] }),
  pkg("lib", { req: ["base"] }),
  pkg("base"),
  pkg("x"),
  pkg("needs-ghost", { req: ["ghost-dep"] }),
  pkg("old-lib-user", {
    req: [{ id: "lib", type: "module", compatibility: { minimum: "2.0.0" } }],
  }),
  pkg("v12-only", { compatibility: { minimum: "11", maximum: "12" } }),
  pkg("pf2e-only", { systems: [{ id: "pf2e", type: "system" }] }),
  pkg("hates-a", {
    conflicts: [{ id: "a", type: "module", reason: "Both patch X." }],
  }),
  pkg("hates-old-x", {
    conflicts: [
      { id: "x", type: "module", compatibility: { maximum: "0.9.0" } },
    ],
  }),
];

const input = (over: Partial<ResolveInput>): ResolveInput => ({
  commands: [],
  current: ["companion"],
  installed,
  core: parseCoreVersion("14.369"),
  system: { id: "dnd5e", version: "5.1.0" },
  companionId: "companion",
  ...over,
});

const sorted = (ids: readonly string[]): string[] => [...ids].sort();

describe("resolvePlan: modes", () => {
  test("add keeps current modules and adds requirements recursively", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "x"],
        commands: [{ mode: "add", modules: ["a"] }],
      }),
    );
    expect(sorted(plan.target)).toEqual(
      sorted(["companion", "x", "a", "lib", "base"]),
    );
    expect(sorted(plan.enable)).toEqual(sorted(["a", "lib", "base"]));
    expect(sorted(plan.dependencyAdditions)).toEqual(["base", "lib"]);
    expect(plan.disable).toEqual([]);
  });

  test("replace keeps only the requested set and the companion", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "x"],
        commands: [{ mode: "replace", modules: ["base"] }],
      }),
    );
    expect(sorted(plan.target)).toEqual(["base", "companion"]);
    expect(plan.disable).toEqual(["x"]);
  });

  test("replace keeps requirements of requested modules even if not listed", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "a", "lib", "base"],
        commands: [{ mode: "replace", modules: ["a"] }],
      }),
    );
    expect(sorted(plan.target)).toEqual(
      sorted(["a", "base", "companion", "lib"]),
    );
  });

  test("remove never removes the companion (C-5)", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "x"],
        commands: [{ mode: "remove", modules: ["companion", "x"] }],
      }),
    );
    expect(plan.target).toEqual(["companion"]);
  });

  test("folds several commands in queue order (P-6)", () => {
    const plan = resolvePlan(
      input({
        current: ["companion"],
        commands: [
          { mode: "add", modules: ["x", "base"] },
          { mode: "remove", modules: ["x"] },
        ],
      }),
    );
    expect(sorted(plan.target)).toEqual(["base", "companion"]);
  });
});

describe("resolvePlan: problems", () => {
  test("reports requested ids that are not installed as missing", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "add", modules: ["ghost"] }] }),
    );
    expect(plan.missing).toEqual(["ghost"]);
    expect(plan.enable).toEqual([]);
  });

  test("blocks a new module whose requirement is not installed", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "add", modules: ["needs-ghost"] }] }),
    );
    expect(plan.blocked).toEqual([
      {
        id: "needs-ghost",
        reason: "missing-requirement",
        detail: ["ghost-dep"],
      },
    ]);
    expect(plan.target).toEqual(["companion"]);
  });

  test("blocks a new module whose requirement is outside the version range", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "add", modules: ["old-lib-user"] }] }),
    );
    expect(plan.blocked).toEqual([
      {
        id: "old-lib-user",
        reason: "incompatible-requirement",
        detail: ["lib"],
      },
    ]);
  });

  test("excludes modules core would refuse for this core version", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "add", modules: ["v12-only"] }] }),
    );
    expect(plan.incompatible).toEqual([
      {
        id: "v12-only",
        reason: "core",
        availability: "requires-core-downgrade",
      },
    ]);
    expect(plan.enable).toEqual([]);
  });

  test("checks compatibility against the world's own core version (V-7)", () => {
    const plan = resolvePlan(
      input({
        core: parseCoreVersion("12.331"),
        commands: [{ mode: "add", modules: ["v12-only"] }],
      }),
    );
    expect(plan.enable).toEqual(["v12-only"]);
  });

  test("excludes modules restricted to another system", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "add", modules: ["pf2e-only"] }] }),
    );
    expect(plan.incompatible).toEqual([{ id: "pf2e-only", reason: "system" }]);
  });

  test("flags declared conflicts between modules in the target", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "a", "lib", "base"],
        commands: [{ mode: "add", modules: ["hates-a"] }],
      }),
    );
    expect(plan.conflicts).toEqual([
      { id: "hates-a", with: "a", reason: "Both patch X." },
    ]);
    expect(plan.target).toContain("hates-a");
  });

  test("respects version ranges on conflicts", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "x"],
        commands: [{ mode: "add", modules: ["hates-old-x"] }],
      }),
    );
    expect(plan.conflicts).toEqual([]);
  });

  test("warns when a removed module is still required by one that stays", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "a", "lib", "base"],
        commands: [{ mode: "remove", modules: ["lib"] }],
      }),
    );
    expect(plan.dependents).toEqual([{ id: "lib", requiredBy: ["a"] }]);
    expect(plan.target).not.toContain("lib");
  });

  test("removes dependents too when the GM chooses so", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "a", "lib", "base", "x"],
        commands: [{ mode: "remove", modules: ["base"] }],
        removeDependents: true,
      }),
    );
    expect(sorted(plan.disable)).toEqual(["a", "base", "lib"]);
    expect(plan.dependents).toEqual([]);
  });

  test("survives dependency cycles", () => {
    const cyclic = [
      pkg("companion"),
      pkg("p", { req: ["q"] }),
      pkg("q", { req: ["p"] }),
    ];
    const plan = resolvePlan(
      input({ installed: cyclic, commands: [{ mode: "add", modules: ["p"] }] }),
    );
    expect(sorted(plan.target)).toEqual(["companion", "p", "q"]);
  });

  test("reports no change when the world already matches", () => {
    const plan = resolvePlan(
      input({
        current: ["companion", "x"],
        commands: [{ mode: "add", modules: ["x"] }],
      }),
    );
    expect(plan.enable).toEqual([]);
    expect(plan.disable).toEqual([]);
    expect(plan.changed).toBe(false);
  });
});

describe("resolvePlan: review fixes", () => {
  test("remove does not report uninstalled ids as missing", () => {
    const plan = resolvePlan(
      input({ commands: [{ mode: "remove", modules: ["ghost"] }] }),
    );
    expect(plan.missing).toEqual([]);
  });

  test("a mutual conflict is reported once", () => {
    const mutual = [
      pkg("companion"),
      pkg("p", { conflicts: [{ id: "q", type: "module" }] }),
      pkg("q", { conflicts: [{ id: "p", type: "module" }] }),
    ];
    const plan = resolvePlan(
      input({
        installed: mutual,
        commands: [{ mode: "add", modules: ["p", "q"] }],
      }),
    );
    expect(plan.conflicts).toHaveLength(1);
  });
});
