import { describe, expect, test } from "vitest";
import { authorKey, authorsOf, listAuthors } from "../src/organise/authors.ts";
import { filterModules } from "../src/organise/filter.ts";
import { smartGroups } from "../src/organise/groups.ts";
import { usageCounts } from "../src/organise/usage.ts";
import {
  emptyLibrary,
  type Library,
  type ModuleFilterSpec,
} from "../src/library/schema.ts";
import type { PackageInfo } from "../src/package.ts";
import { parseCoreVersion } from "../src/version.ts";

const pkg = (id: string, over: Partial<PackageInfo> = {}): PackageInfo => ({
  id,
  title: id.toUpperCase(),
  version: "1.0.0",
  authors: [],
  library: false,
  hasPacks: false,
  hasCode: true,
  compatibility: { minimum: "13", verified: "14" },
  requires: [],
  recommends: [],
  conflicts: [],
  systems: [],
  ...over,
});

describe("authorKey (A-1)", () => {
  test("prefers url, then discord, then normalised name", () => {
    expect(authorKey({ name: "Ann", url: "https://Ann.example/" })).toBe(
      "url:ann.example",
    );
    expect(authorKey({ name: "Ann", discord: "Ann#1" })).toBe("discord:ann#1");
    expect(authorKey({ name: "  Ann   Lee " })).toBe("name:ann lee");
  });

  test("lists authors with their modules, keyed once per person", () => {
    const modules = [
      pkg("a", { authors: [{ name: "Ann", url: "https://ann.example" }] }),
      pkg("b", { authors: [{ name: "Ann L.", url: "http://ann.example/" }] }),
      pkg("c", { authors: [{ name: "Bob" }] }),
    ];
    expect(listAuthors(modules)).toEqual([
      {
        key: "url:ann.example",
        name: "Ann",
        url: "https://ann.example",
        moduleIds: ["a", "b"],
      },
      { key: "name:bob", name: "Bob", moduleIds: ["c"] },
    ]);
    expect(authorsOf(modules[2]!)).toEqual(["name:bob"]);
  });
});

describe("smartGroups (G-1..G-5, G-7)", () => {
  const modules = [
    pkg("lib", { library: true }),
    pkg("pack", { hasPacks: true, hasCode: false }),
    pkg("packcode", { hasPacks: true, hasCode: true }),
    pkg("dnd", { systems: [{ id: "dnd5e", type: "system" }] }),
    pkg("old", { compatibility: { minimum: "12", verified: "13" } }),
    pkg("noverified", { compatibility: {} }),
  ];
  const groups = smartGroups(modules, {
    core: parseCoreVersion("14.369"),
    activeInWorlds: { lib: 1, pack: 2 },
    hasSnapshots: true,
  });
  const ids = (key: string) => groups.find((g) => g.key === key)?.moduleIds;

  test("libraries and content packs", () => {
    expect(ids("library")).toEqual(["lib"]);
    expect(ids("content")).toEqual(["pack"]);
  });

  test("by system", () => {
    expect(ids("system:dnd5e")).toEqual(["dnd"]);
  });

  test("not verified for this core version", () => {
    expect(ids("unverified")).toEqual(["old", "noverified"]);
  });

  test("unused in any known world, only once snapshots exist", () => {
    expect(ids("unused")).toEqual(["packcode", "dnd", "old", "noverified"]);
    const none = smartGroups(modules, {
      core: parseCoreVersion("14.369"),
      activeInWorlds: {},
      hasSnapshots: false,
    });
    expect(none.find((g) => g.key === "unused")).toBeUndefined();
  });
});

describe("usageCounts (W-3)", () => {
  test("counts worlds each module is active in", () => {
    expect(
      usageCounts([
        { active: [{ id: "a" }, { id: "b" }] },
        { active: [{ id: "a" }] },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });
});

describe("filterModules (S-3, S-4, S-7)", () => {
  const modules = [
    pkg("dice-so-nice", {
      title: "Dice So Nice",
      authors: [{ name: "Simone" }],
    }),
    pkg("token-magic", { title: "Token Magic FX", authors: [{ name: "Feu" }] }),
    pkg("tidy", { title: "Tidy Sheet", authors: [{ name: "Sky" }] }),
  ];
  const library: Library = {
    ...emptyLibrary("s"),
    tags: [
      { id: "t1", name: "visual", color: "#000000", revision: 1 },
      { id: "t2", name: "combat", color: "#000000", revision: 1 },
    ],
    modules: {
      "dice-so-nice": { folderId: null, tags: ["t1"], note: "for Strahd" },
      "token-magic": { folderId: null, tags: ["t1", "t2"], note: "" },
    },
  };
  const base: ModuleFilterSpec = {
    text: "",
    tags: [],
    tagOp: "and",
    authors: [],
  };
  const run = (f: Partial<ModuleFilterSpec>) =>
    filterModules(modules, library, { ...base, ...f }).map((m) => m.id);

  test("empty filter keeps everything", () => {
    expect(run({})).toEqual(["dice-so-nice", "token-magic", "tidy"]);
  });

  test("search matches title, id, author, tag names and notes; all words must match", () => {
    expect(run({ text: "magic" })).toEqual(["token-magic"]);
    expect(run({ text: "simone" })).toEqual(["dice-so-nice"]);
    expect(run({ text: "combat" })).toEqual(["token-magic"]);
    expect(run({ text: "strahd" })).toEqual(["dice-so-nice"]);
    expect(run({ text: "visual fx" })).toEqual(["token-magic"]);
  });

  test("tags combine with AND or OR", () => {
    expect(run({ tags: ["t1", "t2"], tagOp: "and" })).toEqual(["token-magic"]);
    expect(run({ tags: ["t1", "t2"], tagOp: "or" })).toEqual([
      "dice-so-nice",
      "token-magic",
    ]);
  });

  test("author filter", () => {
    expect(run({ authors: ["name:sky"] })).toEqual(["tidy"]);
  });
});
