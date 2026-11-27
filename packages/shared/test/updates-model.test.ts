import { describe, expect, test } from "vitest";
import type { PackageCheck } from "../src/updates/check.ts";
import {
  installOrder,
  type InstalledPackage,
  readyIds,
  risksOf,
  rowsOf,
  type UpdatesInput,
  warningsOf,
} from "../src/updates/model.ts";

const T = 1_800_000_000_000;

const mod = (
  id: string,
  version = "1.0.0",
  over: Partial<InstalledPackage> = {},
): InstalledPackage => ({
  id,
  type: "module",
  title: `T ${id}`,
  version,
  ...over,
});

const sys = (id: string, version: string): InstalledPackage => ({
  id,
  type: "system",
  title: `T ${id}`,
  version,
});

const update = (
  id: string,
  version: string,
  over: Partial<PackageCheck> = {},
): PackageCheck => ({
  id,
  type: "module",
  state: "update",
  version,
  availability: 1,
  checkedAt: T,
  ...over,
});

const input = (
  installed: InstalledPackage[],
  checks: PackageCheck[],
  refused: Record<string, string> = {},
): UpdatesInput => ({
  installed,
  checks: Object.fromEntries(checks.map((c) => [c.id, c])),
  refused,
});

const sectionOf = (i: UpdatesInput, id: string) =>
  rowsOf(i).find((r) => r.id === id)?.section;

describe("the Updates tab's sections", () => {
  test("a plain update is Ready; a current package has no row", () => {
    const i = input(
      [mod("a"), mod("b")],
      [
        update("a", "1.1.0"),
        { id: "b", type: "module", state: "current", checkedAt: T },
      ],
    );
    expect(rowsOf(i).map((r) => [r.id, r.section, r.from, r.to])).toEqual([
      ["a", "ready", "1.0.0", "1.1.0"],
    ]);
    expect(readyIds(i)).toEqual(["a"]);
  });

  test("a need another Ready update meets is Ready too", () => {
    const i = input(
      [mod("lib"), mod("dock")],
      [
        update("lib", "1.1.0"),
        update("dock", "1.1.0", {
          requires: [{ id: "lib", minimum: "1.1.0" }],
        }),
      ],
    );
    expect(sectionOf(i, "dock")).toBe("ready");
    expect(readyIds(i).sort()).toEqual(["dock", "lib"]);
  });

  test("blocked: another Foundry, or a required module that isn't installed", () => {
    const i = input(
      [mod("p2p"), mod("bar")],
      [
        update("p2p", "2.0.0", {
          state: "core",
          availability: 8,
          compatibility: { minimum: "14.372" },
        }),
        update("bar", "1.1.0", { requires: [{ id: "missing-lib" }] }),
      ],
    );
    const rows = rowsOf(i);
    expect(rows.find((r) => r.id === "p2p")).toMatchObject({
      section: "blocked",
      block: { kind: "core", minimum: "14.372" },
    });
    expect(rows.find((r) => r.id === "bar")).toMatchObject({
      section: "blocked",
      block: { kind: "missing", id: "missing-lib" },
    });
  });

  test("not available: a refused manifest, premium not owned, a refused download of this version", () => {
    const i = input(
      [mod("pat"), mod("prem"), mod("dl"), mod("dl2")],
      [
        {
          id: "pat",
          type: "module",
          state: "denied",
          errorCode: 403,
          checkedAt: T,
        },
        update("prem", "2.0.0", { state: "notOwned" }),
        update("dl", "1.1.0"),
        update("dl2", "1.2.0"),
      ],
      { dl: "1.1.0", dl2: "1.1.0" },
    );
    expect(rowsOf(i).map((r) => [r.id, r.section, r.block?.kind])).toEqual([
      ["pat", "noaccess", "denied"],
      ["prem", "noaccess", "notOwned"],
      ["dl", "noaccess", "refused"],
      // A newer version than the refused one is offered again.
      ["dl2", "ready", undefined],
    ]);
  });

  test("an error is its own section", () => {
    const i = input(
      [mod("slow")],
      [
        {
          id: "slow",
          type: "module",
          state: "error",
          error: "timeout",
          checkedAt: T,
        },
      ],
    );
    expect(sectionOf(i, "slow")).toBe("error");
  });

  test("a locked package has no row", () => {
    const i = input(
      [mod("l", "1.0.0", { locked: true })],
      [update("l", "1.1.0")],
    );
    expect(rowsOf(i)).toEqual([]);
  });
});

describe("warnings worked out before anything installs", () => {
  test("a module that needs a newer library: the fix is the library's update", () => {
    const i = input(
      [mod("lib"), mod("dock")],
      [
        update("lib", "1.1.0"),
        update("dock", "1.1.0", {
          requires: [{ id: "lib", minimum: "1.1.0" }],
        }),
      ],
    );
    expect(warningsOf(i, "dock", new Set(["dock"]))).toEqual([
      { kind: "needs", id: "lib", minimum: "1.1.0", have: "1.0.0", fix: "lib" },
    ]);
    expect(warningsOf(i, "dock", new Set(["dock", "lib"]))).toEqual([]);
  });

  test("a module whose update needs a newer system: the fix is the system's update", () => {
    const i = input(
      [sys("dnd5e", "5.1.4"), mod("tidy")],
      [
        update("dnd5e", "5.2.0", { type: "system" }),
        update("tidy", "1.9.0", {
          systems: [{ id: "dnd5e", minimum: "5.2.0" }],
        }),
      ],
    );
    expect(warningsOf(i, "tidy", new Set(["tidy"]))).toEqual([
      {
        kind: "system",
        id: "dnd5e",
        minimum: "5.2.0",
        have: "5.1.4",
        fix: "dnd5e",
      },
    ]);
  });

  test("a system update leaves modules outside the versions they declare", () => {
    const i = input(
      [
        sys("dnd5e", "5.1.4"),
        mod("tidy", "1.8.3", {
          systems: [
            {
              id: "dnd5e",
              type: "system",
              compatibility: { maximum: "5.1.9" },
            },
          ],
        }),
        mod("maps", "4.1.1", {
          systems: [
            {
              id: "dnd5e",
              type: "system",
              compatibility: { maximum: "5.1.9" },
            },
          ],
        }),
        mod("fine", "1.0.0", {
          systems: [
            { id: "dnd5e", type: "system", compatibility: { minimum: "5.0" } },
          ],
        }),
      ],
      [
        update("dnd5e", "5.2.0", { type: "system" }),
        update("tidy", "1.9.0", {
          systems: [{ id: "dnd5e", minimum: "5.2.0" }],
        }),
      ],
    );
    expect(warningsOf(i, "dnd5e", new Set(["dnd5e"]))).toEqual([
      {
        kind: "impact",
        dependents: [
          { id: "tidy", maximum: "5.1.9", fix: "tidy" },
          { id: "maps", maximum: "5.1.9" },
        ],
      },
    ]);
    // Updating Tidy with it leaves only the map pack behind.
    expect(warningsOf(i, "dnd5e", new Set(["dnd5e", "tidy"]))).toEqual([
      { kind: "impact", dependents: [{ id: "maps", maximum: "5.1.9" }] },
    ]);
    // The system has a warning even with everything Ready ticked: it needs attention.
    expect(sectionOf(i, "dnd5e")).toBe("attention");
    expect(sectionOf(i, "tidy")).toBe("attention");
  });

  test("a library update leaves modules that cap it behind", () => {
    const i = input(
      [
        mod("lib", "1.0.0"),
        mod("old", "1.0.0", {
          requires: [
            { id: "lib", type: "module", compatibility: { maximum: "1.0.9" } },
          ],
        }),
      ],
      [update("lib", "2.0.0")],
    );
    expect(warningsOf(i, "lib", new Set(["lib"]))).toEqual([
      { kind: "impact", dependents: [{ id: "old", maximum: "1.0.9" }] },
    ]);
  });
});

describe("installing", () => {
  test("systems, then the libraries others need, then the rest", () => {
    const i = input(
      [sys("dnd5e", "5.1.4"), mod("lib"), mod("dock"), mod("a")],
      [
        update("a", "1.1.0"),
        update("dock", "1.1.0", {
          requires: [{ id: "lib", minimum: "1.1.0" }],
        }),
        update("lib", "1.1.0"),
        update("dnd5e", "5.2.0", { type: "system" }),
      ],
    );
    expect(installOrder(i, ["a", "dock", "lib", "dnd5e"])).toEqual([
      "dnd5e",
      "lib",
      "a",
      "dock",
    ]);
  });

  test("a run's risks are judged on that run alone", () => {
    const i = input(
      [mod("lib"), mod("dock")],
      [
        update("lib", "1.1.0"),
        update("dock", "1.1.0", {
          requires: [{ id: "lib", minimum: "1.1.0" }],
        }),
      ],
    );
    expect(risksOf(i, ["dock", "lib"])).toEqual([]);
    expect(risksOf(i, ["dock"])).toEqual([
      {
        id: "dock",
        warnings: [
          {
            kind: "needs",
            id: "lib",
            minimum: "1.1.0",
            have: "1.0.0",
            fix: "lib",
          },
        ],
      },
    ]);
  });
});
