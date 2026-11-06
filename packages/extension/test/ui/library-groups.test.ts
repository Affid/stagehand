import { listAuthors } from "@module-library/shared/organise/authors";
import { smartGroups } from "@module-library/shared/organise/groups";
import { parseCoreVersion } from "@module-library/shared/version";
import { describe, expect, test } from "vitest";
import { groupLibrary } from "../../src/ui/model/library-groups.ts";
import { LIBRARY, pkg } from "./harness.tsx";

const modules = [
  pkg("b", {
    title: "Beta",
    authors: [{ name: "Bob" }],
    compatibility: { minimum: "12", verified: "13" },
  }),
  pkg("a", { title: "Alpha" }),
  pkg("c", { title: "Gamma", authors: [] }),
];
const ctx = {
  library: LIBRARY,
  smart: smartGroups(modules, {
    core: parseCoreVersion("14.369"),
    activeInWorlds: {},
    hasSnapshots: false,
  }),
  authors: listAuthors(modules),
};

const shape = (by: Parameters<typeof groupLibrary>[1]) =>
  groupLibrary(modules, by, ctx).map((g) => [
    g.name ?? g.label,
    g.modules.map((m) => m.id),
  ]);

describe("grouping the Library", () => {
  test("by folder: folders in order, then unfiled; titles sorted", () => {
    expect(shape("folder")).toEqual([
      ["Combat", ["a"]],
      ["sidebar.unfiled", ["b", "c"]],
    ]);
    const combat = groupLibrary(modules, "folder", ctx)[0];
    expect(combat?.color).toBe("#c94c4c");
  });

  test("by tag: each tag, then untagged; a module can be in several", () => {
    expect(shape("tag")).toEqual([
      ["visual", ["a"]],
      ["lib.untagged", ["b", "c"]],
    ]);
  });

  test("by author: by name, then modules without one", () => {
    expect(shape("author")).toEqual([
      ["Ann", ["a"]],
      ["Bob", ["b"]],
      ["lib.noAuthor", ["c"]],
    ]);
  });

  test("by smart group: only groups with modules", () => {
    const groups = groupLibrary(modules, "smart", ctx);
    expect(groups.every((g) => g.modules.length > 0)).toBe(true);
    expect(groups.map((g) => g.label)).toContain("groups.unverified");
  });

  test("no modules, no groups", () => {
    expect(groupLibrary([], "folder", ctx)).toEqual([]);
  });
});
