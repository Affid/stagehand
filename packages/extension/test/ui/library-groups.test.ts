import { listAuthors } from "@stagehand/shared/organise/authors";
import { smartGroups } from "@stagehand/shared/organise/groups";
import { parseCoreVersion } from "@stagehand/shared/version";
import { describe, expect, test } from "vitest";
import { createTranslator } from "../../src/ui/i18n.ts";
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

  test("every smart group's label is a real string", () => {
    const t = createTranslator("en");
    for (const label of [
      "groups.library",
      "groups.content",
      "groups.system",
      "groups.unverified",
      "groups.unused",
    ])
      expect(t(label, { param: "dnd5e" })).not.toBe(label);
  });

  test("no modules, no groups", () => {
    expect(groupLibrary([], "folder", ctx)).toEqual([]);
  });
});

describe("empty folders on the Library (6b3)", () => {
  test("kept, in order, when asked; Unfiled only when it holds any", () => {
    const library = {
      ...LIBRARY,
      folders: [
        {
          id: "f1",
          name: "One",
          color: "#111111",
          parentId: null,
          order: 0,
          collapsed: false,
          revision: 1,
        },
        {
          id: "f2",
          name: "Two",
          color: "#222222",
          parentId: null,
          order: 1,
          collapsed: false,
          revision: 1,
        },
      ],
      modules: { a: { folderId: "f2", tags: [], note: "" } },
    };
    const mods = [pkg("a")];
    const ctx = { library, smart: [], authors: [] };
    expect(groupLibrary(mods, "folder", ctx).map((g) => g.key)).toEqual(["f2"]);
    expect(
      groupLibrary(mods, "folder", { ...ctx, keepEmptyFolders: true }).map(
        (g) => [g.key, g.modules.length],
      ),
    ).toEqual([
      ["f1", 0],
      ["f2", 1],
    ]);
  });
});
