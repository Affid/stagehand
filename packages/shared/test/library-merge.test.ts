import { describe, expect, test } from "vitest";
import { mergeLibraries } from "../src/library/merge.ts";
import {
  emptyLibrary,
  type Folder,
  type Library,
  MAX_NOTE,
  type Preset,
  type Tag,
} from "../src/library/schema.ts";

const SERVER = "http://a:1";

const folder = (id: string, over: Partial<Folder> = {}): Folder => ({
  id,
  name: id,
  color: "#336699",
  parentId: null,
  order: 0,
  collapsed: false,
  revision: 1,
  ...over,
});

const tag = (id: string, over: Partial<Tag> = {}): Tag => ({
  id,
  name: id,
  color: "#33aa77",
  revision: 1,
  ...over,
});

const preset = (id: string, over: Partial<Preset> = {}): Preset => ({
  id,
  name: id,
  description: "",
  modules: [],
  source: "user",
  revision: 1,
  ...over,
});

const lib = (over: Partial<Library> = {}): Library => ({
  ...emptyLibrary(SERVER),
  ...over,
});

const merge = (base: Library | null, local: Library, server: Library) =>
  mergeLibraries({
    base: base && { library: base, sorted: null },
    local: { library: local, sorted: null },
    server: { library: server, sorted: null },
  });

describe("library merge: one side changed", () => {
  test("takes the server's change when this device changed nothing", () => {
    const base = lib({ tags: [tag("t1")] });
    const server = lib({ tags: [tag("t1", { name: "combat", revision: 2 })] });
    const result = merge(base, base, server);
    expect(result.library.tags.map((t) => t.name)).toEqual(["combat"]);
    expect(result.changedLocal).toBe(true);
    expect(result.changedServer).toBe(false);
    expect(result.clashes).toEqual([]);
  });

  test("keeps this device's change and asks to push it", () => {
    const base = lib({ tags: [tag("t1")] });
    const local = lib({ tags: [tag("t1", { name: "combat", revision: 2 })] });
    const result = merge(base, local, base);
    expect(result.library.tags.map((t) => t.name)).toEqual(["combat"]);
    expect(result.changedLocal).toBe(false);
    expect(result.changedServer).toBe(true);
  });

  test("reports nothing to do when both sides match", () => {
    const base = lib({ folders: [folder("f1")] });
    const result = merge(base, base, base);
    expect(result).toMatchObject({
      changedLocal: false,
      changedServer: false,
      clashes: [],
    });
  });

  test("ignores revision-only differences, so devices don't push forever", () => {
    const local = lib({ revision: 9, tags: [tag("t1", { revision: 7 })] });
    const server = lib({ revision: 2, tags: [tag("t1", { revision: 3 })] });
    const result = merge(local, local, server);
    expect(result.changedLocal).toBe(false);
    expect(result.changedServer).toBe(false);
    expect(result.library.tags[0]?.revision).toBe(7);
  });
});

describe("library merge: adds and deletes", () => {
  test("keeps items added on either side", () => {
    const base = lib();
    const local = lib({ presets: [preset("p1")] });
    const server = lib({ presets: [preset("p2")] });
    const result = merge(base, local, server);
    expect(result.library.presets.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(result.changedServer).toBe(true);
    expect(result.changedLocal).toBe(true);
  });

  test("deletes an item removed on one side and unchanged on the other", () => {
    const base = lib({ tags: [tag("t1"), tag("t2")] });
    const local = lib({ tags: [tag("t2")] });
    const server = lib({ tags: [tag("t1"), tag("t2")] });
    expect(merge(base, local, server).library.tags.map((t) => t.id)).toEqual([
      "t2",
    ]);
    expect(merge(base, server, local).library.tags.map((t) => t.id)).toEqual([
      "t2",
    ]);
  });

  test("an edit beats a delete, and says so", () => {
    const base = lib({ tags: [tag("t1")] });
    const local = lib({ tags: [] });
    const server = lib({ tags: [tag("t1", { name: "combat", revision: 2 })] });
    const result = merge(base, local, server);
    expect(result.library.tags.map((t) => t.name)).toEqual(["combat"]);
    expect(result.clashes).toEqual([
      { kind: "tag", id: "t1", name: "combat", reason: "kept-edit" },
    ]);
  });

  test("an item deleted on both sides stays deleted", () => {
    const base = lib({ tags: [tag("t1")] });
    expect(merge(base, lib(), lib()).library.tags).toEqual([]);
  });
});

describe("library merge: both sides changed", () => {
  test("merges different fields of the same item without a clash", () => {
    const base = lib({ folders: [folder("f1")] });
    const local = lib({
      folders: [folder("f1", { name: "Maps", revision: 2 })],
    });
    const server = lib({
      folders: [folder("f1", { color: "#aa0000", revision: 2 })],
    });
    const result = merge(base, local, server);
    expect(result.library.folders[0]).toMatchObject({
      name: "Maps",
      color: "#aa0000",
    });
    expect(result.clashes).toEqual([]);
  });

  test("the same field changed on both: this device wins, with a notice", () => {
    const base = lib({ tags: [tag("t1")] });
    const local = lib({ tags: [tag("t1", { name: "mine", revision: 2 })] });
    const server = lib({ tags: [tag("t1", { name: "theirs", revision: 2 })] });
    const result = merge(base, local, server);
    expect(result.library.tags[0]?.name).toBe("mine");
    expect(result.clashes).toEqual([
      { kind: "tag", id: "t1", name: "mine", reason: "kept-this-device" },
    ]);
    expect(result.changedServer).toBe(true);
  });

  test("two edited notes are both kept", () => {
    const meta = (note: string) => ({ folderId: null, tags: [], note });
    const base = lib({ modules: { dice: meta("old") } });
    const local = lib({ modules: { dice: meta("mine") } });
    const server = lib({ modules: { dice: meta("theirs") } });
    const result = merge(base, local, server);
    expect(result.library.modules.dice?.note).toBe("mine\n\ntheirs");
    expect(result.clashes).toEqual([
      { kind: "module", id: "dice", name: "dice", reason: "joined-text" },
    ]);
  });

  test("joined notes never exceed the note limit", () => {
    const meta = (note: string) => ({ folderId: null, tags: [], note });
    const long = "x".repeat(MAX_NOTE);
    const result = merge(
      lib({ modules: { dice: meta("") } }),
      lib({ modules: { dice: meta(long) } }),
      lib({ modules: { dice: meta("y") } }),
    );
    expect(result.library.modules.dice?.note.length).toBe(MAX_NOTE);
  });

  test("tag lists and preset modules merge as sets", () => {
    const base = lib({
      modules: { dice: { folderId: null, tags: ["a", "b"], note: "" } },
      presets: [preset("p1", { modules: ["x", "y"] })],
      tags: [tag("a"), tag("b"), tag("c"), tag("d")],
    });
    const local = {
      ...base,
      modules: { dice: { folderId: null, tags: ["a", "c"], note: "" } },
      presets: [preset("p1", { modules: ["x", "y", "z"], revision: 2 })],
    };
    const server = {
      ...base,
      modules: { dice: { folderId: null, tags: ["b", "d"], note: "" } },
      presets: [preset("p1", { modules: ["y", "w"], revision: 2 })],
    };
    const result = merge(base, local, server);
    expect(result.library.modules.dice?.tags).toEqual(["d", "c"]);
    expect(result.library.presets[0]?.modules).toEqual(["y", "w", "z"]);
    expect(result.clashes).toEqual([]);
  });

  test("a changed item gets a revision newer than both copies", () => {
    const base = lib({ tags: [tag("t1", { revision: 1 })] });
    const local = lib({ tags: [tag("t1", { revision: 4, name: "l" })] });
    const server = lib({
      tags: [tag("t1", { revision: 6, color: "#000000" })],
    });
    expect(merge(base, local, server).library.tags[0]?.revision).toBe(7);
  });

  test("the library revision moves past both copies, only when this device changes", () => {
    const base = lib({ revision: 3 });
    const server = lib({ revision: 8, tags: [tag("t1")] });
    expect(merge(base, base, server).library.revision).toBe(9);
    expect(merge(base, base, base).library.revision).toBe(3);
  });
});

describe("library merge: first sync on a device", () => {
  test("an empty device takes the server's library", () => {
    const server = lib({ tags: [tag("t1")], folders: [folder("f1")] });
    const result = merge(null, lib(), server);
    expect(result.library.tags).toEqual(server.tags);
    expect(result.library.folders).toEqual(server.folders);
    expect(result.changedServer).toBe(false);
  });

  test("two filled libraries are combined, nothing lost", () => {
    const local = lib({ tags: [tag("t1"), tag("t2", { name: "mine" })] });
    const server = lib({ tags: [tag("t2", { name: "theirs" }), tag("t3")] });
    const result = merge(null, local, server);
    expect(result.library.tags.map((t) => [t.id, t.name])).toEqual([
      ["t2", "mine"],
      ["t3", "t3"],
      ["t1", "t1"],
    ]);
    expect(result.clashes).toEqual([
      { kind: "tag", id: "t2", name: "mine", reason: "kept-this-device" },
    ]);
  });

  test("keeps this device's server id", () => {
    const server = { ...lib(), serverId: "http://elsewhere:2" };
    expect(merge(null, lib(), server).library.serverId).toBe(SERVER);
  });
});

describe("library merge: references stay valid", () => {
  test("a module in a folder deleted elsewhere falls back to no folder", () => {
    const base = lib({ folders: [folder("f1")] });
    const local = lib({
      folders: [folder("f1")],
      modules: { dice: { folderId: "f1", tags: ["gone"], note: "" } },
    });
    const server = lib();
    const result = merge(base, local, server);
    expect(result.library.folders).toEqual([]);
    expect(result.library.modules.dice).toEqual({
      folderId: null,
      tags: [],
      note: "",
    });
  });

  test("folders moved under each other on two devices end without a loop", () => {
    const base = lib({ folders: [folder("a"), folder("b", { order: 1 })] });
    const local = lib({
      folders: [folder("a", { parentId: "b", revision: 2 }), folder("b")],
    });
    const server = lib({
      folders: [folder("a"), folder("b", { parentId: "a", revision: 2 })],
    });
    const result = merge(base, local, server);
    const parents = Object.fromEntries(
      result.library.folders.map((f) => [f.id, f.parentId]),
    );
    expect(parents.a === "b" && parents.b === "a").toBe(false);
    expect(Object.values(parents)).toContain(null);
  });

  test("folders never end deeper than two levels", () => {
    const base = lib({ folders: [folder("a"), folder("b"), folder("c")] });
    const local = lib({
      folders: [folder("a", { parentId: "b" }), folder("b"), folder("c")],
    });
    const server = lib({
      folders: [folder("a"), folder("b", { parentId: "c" }), folder("c")],
    });
    const result = merge(base, local, server);
    const byId = new Map(result.library.folders.map((f) => [f.id, f]));
    const depth = (id: string | null): number =>
      id === null ? 0 : 1 + depth(byId.get(id)?.parentId ?? null);
    for (const f of result.library.folders)
      expect(depth(f.id)).toBeLessThanOrEqual(2);
  });

  test("folder order is renumbered after a merge", () => {
    const base = lib();
    const local = lib({ folders: [folder("a", { order: 0 })] });
    const server = lib({ folders: [folder("b", { order: 0 })] });
    const result = merge(base, local, server);
    expect(result.library.folders.map((f) => f.order)).toEqual([0, 1]);
  });
});

describe("sorted modules", () => {
  const withSorted = (sorted: string[] | null) => ({ library: lib(), sorted });

  test("are the union of both sides", () => {
    const result = mergeLibraries({
      base: withSorted(["a"]),
      local: withSorted(["a", "b"]),
      server: withSorted(["a", "c"]),
    });
    expect(result.sorted).toEqual(["a", "c", "b"]);
    expect(result.changedLocal).toBe(true);
    expect(result.changedServer).toBe(true);
  });

  test("an unseeded device takes the server's set", () => {
    const result = mergeLibraries({
      base: null,
      local: withSorted(null),
      server: withSorted(["a"]),
    });
    expect(result.sorted).toEqual(["a"]);
    expect(result.changedServer).toBe(false);
  });

  test("stay unseeded when neither side has seeded them", () => {
    const result = mergeLibraries({
      base: null,
      local: withSorted(null),
      server: withSorted(null),
    });
    expect(result.sorted).toBeNull();
    expect(result.changedLocal).toBe(false);
  });
});

/** Device syncs against the file: returns the device's and the file's new state. */
function sync(device: { base: Library | null; local: Library }, file: Library) {
  const r = merge(device.base, device.local, file);
  const next = r.changedServer ? r.library : file;
  return {
    device: { base: next, local: r.library },
    file: next,
    pushed: r.changedServer,
  };
}

describe("library merge: devices converge (review)", () => {
  test("two devices with different items stop re-saving after one round", () => {
    let a = { base: null as Library | null, local: lib({ tags: [tag("a")] }) };
    let b = { base: null as Library | null, local: lib({ tags: [tag("b")] }) };
    let file = lib();
    const pushes: boolean[] = [];
    for (let round = 0; round < 3; round++) {
      const ra = sync(a, file);
      a = ra.device;
      file = ra.file;
      const rb = sync(b, file);
      b = rb.device;
      file = rb.file;
      pushes.push(ra.pushed, rb.pushed);
    }
    expect(pushes).toEqual([true, true, false, false, false, false]);
    expect(a.local.tags.map((t) => t.id)).toEqual(["a", "b"]);
    expect(b.local.tags.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("a joined note does not grow on later syncs", () => {
    const meta = (note: string) => ({
      modules: { dice: { folderId: null, tags: [], note } },
    });
    const base = lib(meta("X"));
    let a = { base: base as Library | null, local: lib(meta("A")) };
    let b = { base: base as Library | null, local: lib(meta("B")) };
    let file = base;
    for (let round = 0; round < 3; round++) {
      const ra = sync(a, file);
      a = ra.device;
      file = ra.file;
      const rb = sync(b, file);
      b = rb.device;
      file = rb.file;
    }
    expect(file.modules.dice?.note).toBe("B\n\nA");
    expect(a.local.modules.dice?.note).toBe("B\n\nA");
    expect(b.local.modules.dice?.note).toBe("B\n\nA");
  });

  test("a reorder made on the server is kept", () => {
    const base = lib({
      folders: [folder("a", { order: 0 }), folder("b", { order: 1 })],
    });
    const server = lib({
      folders: [
        folder("b", { order: 0, revision: 2 }),
        folder("a", { order: 1, revision: 2 }),
      ],
    });
    const result = merge(base, base, server);
    expect(result.library.folders.map((f) => f.id)).toEqual(["b", "a"]);
    expect(result.changedServer).toBe(false);
  });

  test("a reorder made on this device is kept and pushed", () => {
    const base = lib({
      folders: [folder("a", { order: 0 }), folder("b", { order: 1 })],
    });
    const local = lib({
      folders: [
        folder("b", { order: 0, revision: 2 }),
        folder("a", { order: 1, revision: 2 }),
      ],
    });
    const result = merge(base, local, base);
    expect(result.library.folders.map((f) => f.id)).toEqual(["b", "a"]);
    expect(result.changedServer).toBe(true);
    expect(result.clashes).toEqual([]);
  });

  test("a folder renumbered elsewhere is still deleted here", () => {
    const base = lib({
      folders: [folder("f1", { order: 0 }), folder("f2", { order: 1 })],
    });
    const local = lib({ folders: [folder("f1", { order: 0 })] });
    const server = lib({ folders: [folder("f2", { order: 0, revision: 2 })] });
    const result = merge(base, local, server);
    expect(result.library.folders).toEqual([]);
    expect(result.clashes).toEqual([]);
  });

  test("merges a large library quickly", () => {
    const many = (n: number, p: string) =>
      Array.from({ length: n }, (_, i) => tag(`${p}${String(i)}`));
    const local = lib({ tags: many(5000, "l") });
    const server = lib({ tags: many(5000, "s") });
    const started = performance.now();
    expect(merge(null, local, server).library.tags).toHaveLength(10000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("library merge: repairs (review)", () => {
  test("two tags named alike on two devices stay apart by name", () => {
    const local = lib({ tags: [tag("t1", { name: "Combat" })] });
    const server = lib({ tags: [tag("t2", { name: "combat" })] });
    const result = merge(null, local, server);
    expect(result.library.tags.map((t) => t.name)).toEqual([
      "combat",
      "Combat 2",
    ]);
  });

  test("repeated ids and repeated list entries are dropped", () => {
    const broken = lib({
      tags: [tag("t1"), tag("t1", { name: "again" })],
      modules: { dice: { folderId: null, tags: ["t1", "t1"], note: "" } },
      presets: [preset("p1", { modules: ["x", "x"] })],
    });
    const result = merge(null, broken, lib());
    expect(result.library.tags.map((t) => t.name)).toEqual(["t1"]);
    expect(result.library.modules.dice?.tags).toEqual(["t1"]);
    expect(result.library.presets[0]?.modules).toEqual(["x"]);
  });
});
