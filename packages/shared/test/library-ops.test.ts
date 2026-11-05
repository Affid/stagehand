import { describe, expect, test } from "vitest";
import { applyOp, type OpResult } from "../src/library/ops.ts";
import { emptyLibrary, type Library } from "../src/library/schema.ts";

const lib0 = emptyLibrary("http://localhost:30000");

function ok(result: OpResult): Library {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result.library;
}

const withFolder = ok(
  applyOp(lib0, {
    op: "folder.create",
    folder: { id: "f1", name: "Lighting", color: "#aa00ee", parentId: null },
  }),
);

describe("folders", () => {
  test("create adds a folder at the end with revision 1 and bumps the library", () => {
    expect(withFolder.folders).toEqual([
      {
        id: "f1",
        name: "Lighting",
        color: "#aa00ee",
        parentId: null,
        order: 0,
        collapsed: false,
        revision: 1,
      },
    ]);
    expect(withFolder.revision).toBe(lib0.revision + 1);
    expect(lib0.folders).toEqual([]);
  });

  test("update with the current revision applies and bumps the revision", () => {
    const next = ok(
      applyOp(withFolder, {
        op: "folder.update",
        id: "f1",
        baseRevision: 1,
        changes: { name: "Lights", collapsed: true },
      }),
    );
    expect(next.folders[0]).toMatchObject({
      name: "Lights",
      collapsed: true,
      revision: 2,
    });
  });

  test("update based on an old revision is rejected with the current folder (D-2)", () => {
    const result = applyOp(withFolder, {
      op: "folder.update",
      id: "f1",
      baseRevision: 0,
      changes: { name: "Stale" },
    });
    expect(result).toEqual({
      ok: false,
      conflict: { entity: "folder", id: "f1", current: withFolder.folders[0] },
    });
  });

  test("move reorders folders", () => {
    const two = ok(
      applyOp(withFolder, {
        op: "folder.create",
        folder: { id: "f2", name: "Combat", color: "#33aa77", parentId: null },
      }),
    );
    const moved = ok(
      applyOp(two, { op: "folder.move", id: "f2", baseRevision: 1, order: 0 }),
    );
    expect(moved.folders.map((f) => [f.id, f.order])).toEqual([
      ["f2", 0],
      ["f1", 1],
    ]);
  });

  test("nesting is limited to depth 2 (S-2)", () => {
    const child = ok(
      applyOp(withFolder, {
        op: "folder.create",
        folder: { id: "c", name: "Child", color: "#000000", parentId: "f1" },
      }),
    );
    const result = applyOp(child, {
      op: "folder.create",
      folder: { id: "g", name: "Grandchild", color: "#000000", parentId: "c" },
    });
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/depth/),
    });
  });

  test("delete moves its modules out of the folder", () => {
    const filed = ok(
      applyOp(withFolder, {
        op: "module.setFolder",
        moduleIds: ["a"],
        folderId: "f1",
      }),
    );
    const deleted = ok(
      applyOp(filed, { op: "folder.delete", id: "f1", baseRevision: 1 }),
    );
    expect(deleted.folders).toEqual([]);
    expect(deleted.modules.a?.folderId).toBeNull();
  });

  test("assigning to an unknown folder is an error", () => {
    expect(
      applyOp(lib0, {
        op: "module.setFolder",
        moduleIds: ["a"],
        folderId: "nope",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/folder/) });
  });
});

describe("tags and notes", () => {
  const tagged = ok(
    applyOp(lib0, {
      op: "tag.create",
      tag: { id: "t1", name: "combat", color: "#33aa77" },
    }),
  );

  test("tags are added and removed per module, never duplicated", () => {
    const once = ok(
      applyOp(tagged, {
        op: "module.setTags",
        moduleIds: ["a", "b"],
        add: ["t1"],
        remove: [],
      }),
    );
    const twice = ok(
      applyOp(once, {
        op: "module.setTags",
        moduleIds: ["a"],
        add: ["t1"],
        remove: [],
      }),
    );
    expect(twice.modules.a?.tags).toEqual(["t1"]);
    const removed = ok(
      applyOp(twice, {
        op: "module.setTags",
        moduleIds: ["a"],
        add: [],
        remove: ["t1"],
      }),
    );
    expect(removed.modules.a?.tags).toEqual([]);
    expect(removed.modules.b?.tags).toEqual(["t1"]);
  });

  test("deleting a tag removes it from every module", () => {
    const once = ok(
      applyOp(tagged, {
        op: "module.setTags",
        moduleIds: ["a"],
        add: ["t1"],
        remove: [],
      }),
    );
    const deleted = ok(
      applyOp(once, { op: "tag.delete", id: "t1", baseRevision: 1 }),
    );
    expect(deleted.tags).toEqual([]);
    expect(deleted.modules.a?.tags).toEqual([]);
  });

  test("tag names are unique, ignoring case", () => {
    expect(
      applyOp(tagged, {
        op: "tag.create",
        tag: { id: "t2", name: "Combat", color: "#000000" },
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/exists/) });
  });

  test("notes are stored per module and trimmed", () => {
    const noted = ok(
      applyOp(lib0, {
        op: "module.setNote",
        moduleId: "a",
        note: "  for Strahd ",
      }),
    );
    expect(noted.modules.a).toEqual({
      folderId: null,
      tags: [],
      note: "for Strahd",
    });
  });
});

describe("presets", () => {
  const withPreset = ok(
    applyOp(lib0, {
      op: "preset.create",
      preset: {
        id: "p1",
        name: "Core QoL",
        description: "",
        modules: ["a", "b", "a"],
        source: "user",
      },
    }),
  );

  test("create removes duplicate module ids", () => {
    expect(withPreset.presets[0]).toMatchObject({
      modules: ["a", "b"],
      revision: 1,
    });
  });

  test("update with a stale revision is a conflict", () => {
    expect(
      applyOp(withPreset, {
        op: "preset.update",
        id: "p1",
        baseRevision: 7,
        changes: { name: "x" },
      }),
    ).toMatchObject({ ok: false, conflict: { entity: "preset", id: "p1" } });
  });

  test("update and delete with the current revision work", () => {
    const updated = ok(
      applyOp(withPreset, {
        op: "preset.update",
        id: "p1",
        baseRevision: 1,
        changes: { modules: ["c"] },
      }),
    );
    expect(updated.presets[0]).toMatchObject({ modules: ["c"], revision: 2 });
    const deleted = ok(
      applyOp(updated, { op: "preset.delete", id: "p1", baseRevision: 2 }),
    );
    expect(deleted.presets).toEqual([]);
  });

  test("operating on an unknown id is an error, not a crash", () => {
    expect(
      applyOp(lib0, { op: "preset.delete", id: "nope", baseRevision: 1 }),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not found/),
    });
  });
});

describe("review fixes", () => {
  test("tag.create rejects a reused id", () => {
    const one = ok(
      applyOp(lib0, {
        op: "tag.create",
        tag: { id: "t1", name: "a", color: "#000000" },
      }),
    );
    expect(
      applyOp(one, {
        op: "tag.create",
        tag: { id: "t1", name: "b", color: "#000000" },
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/exists/) });
  });

  test("a stale tag rename is a revision conflict, even to a taken name", () => {
    const two = ok(
      applyOp(
        ok(
          applyOp(lib0, {
            op: "tag.create",
            tag: { id: "t1", name: "a", color: "#000000" },
          }),
        ),
        { op: "tag.create", tag: { id: "t2", name: "b", color: "#000000" } },
      ),
    );
    expect(
      applyOp(two, {
        op: "tag.update",
        id: "t1",
        baseRevision: 0,
        changes: { name: "b" },
      }),
    ).toMatchObject({ ok: false, conflict: { entity: "tag", id: "t1" } });
  });
});
