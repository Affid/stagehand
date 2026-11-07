import { describe, expect, test, vi } from "vitest";
import { parseServerBackupsReply } from "../../src/page-server-backups.ts";
import { runServerBackups } from "../../src/page/server-backups.ts";

const listing = {
  world: {
    w: [
      {
        id: "world.w.1",
        title: "Strahd",
        createdAt: 3,
        size: 30,
        snapshotId: "snapshot.1",
      },
    ],
    gone: [
      {
        id: "world.gone.1",
        title: "Old world",
        createdAt: 1,
        size: 10,
        snapshotId: null,
      },
    ],
  },
  module: {
    m: [
      {
        id: "module.m.1",
        title: "",
        createdAt: 2,
        size: 20,
        snapshotId: "snapshot.1",
      },
    ],
    // Foundry lists every installed package, with or without backups.
    none: [],
  },
  system: {},
  snapshots: {
    "snapshot.1": {
      id: "snapshot.1",
      createdAt: 4,
      size: 50,
      note: "Before update",
      generation: 14,
      build: 370,
      backups: ["world.w.1", "module.m.1"],
    },
  },
};

function foundry() {
  const has = (ids: string[]) => ({
    values: () => [].values(),
    get: (id: string) =>
      ids.includes(id) ? { id, title: `Title ${id}` } : undefined,
  });
  const game = {
    worlds: has(["w"]),
    modules: has(["m", "none"]),
    systems: has([]),
    listBackups: vi.fn(() => Promise.resolve(listing)),
    createSnapshot: vi.fn(() => Promise.resolve()),
    restoreSnapshot: vi.fn(() => Promise.resolve()),
    deleteSnapshots: vi.fn(() => Promise.resolve()),
  };
  return { page: { game }, game };
}

const req = (
  op: "list" | "createSnapshot" | "restoreSnapshot" | "deleteSnapshots",
  ids: string[] = [],
) => ({
  requestId: "r1",
  op,
  ids,
});

describe("the server's backups through Foundry", () => {
  test("lists snapshots and the packages that have backups, marking uninstalled ones", async () => {
    const f = foundry();
    const r = await runServerBackups(f.page, req("list"));
    expect(r.listing?.snapshots).toEqual([
      {
        id: "snapshot.1",
        createdAt: 4,
        size: 50,
        note: "Before update",
        generation: 14,
        build: 370,
        count: 2,
      },
    ]);
    expect(
      r.listing?.packages.map((p) => [p.type, p.id, p.title, p.installed]),
    ).toEqual([
      ["world", "w", "Strahd", true],
      ["world", "gone", "Old world", false],
      // No title on the record: the installed package's title.
      ["module", "m", "Title m", true],
    ]);
    expect(
      parseServerBackupsReply({ requestId: "r1", listing: r.listing }),
    ).toBeTruthy();
  });

  test("snapshots are taken (after our dialog), restored and deleted with Foundry's dialogs", async () => {
    const f = foundry();
    await runServerBackups(f.page, req("createSnapshot"));
    // Our dialog asked already: Foundry's stays shut (Phase 6).
    expect(f.game.createSnapshot).toHaveBeenCalledWith({
      dialog: false,
      note: "",
    });
    await runServerBackups(f.page, req("restoreSnapshot", ["snapshot.1"]));
    expect(f.game.restoreSnapshot).toHaveBeenCalledWith(
      listing.snapshots["snapshot.1"],
      {
        dialog: true,
      },
    );
    await runServerBackups(f.page, req("deleteSnapshots", ["snapshot.1"]));
    expect(f.game.deleteSnapshots).toHaveBeenCalledWith(["snapshot.1"], {
      dialog: true,
    });
  });

  test("an unknown snapshot or a failure is reported, never thrown", async () => {
    const f = foundry();
    expect(
      (await runServerBackups(f.page, req("restoreSnapshot", ["nope"]))).error,
    ).toMatch(/nope/);
    f.game.listBackups.mockRejectedValueOnce(new Error("offline"));
    expect((await runServerBackups(f.page, req("list"))).error).toMatch(
      /offline/,
    );
    expect((await runServerBackups({}, req("list"))).error).toBeTruthy();
  });

  test("inherited names are not snapshots", async () => {
    const f = foundry();
    const r = await runServerBackups(
      f.page,
      req("restoreSnapshot", ["__proto__"]),
    );
    expect(r.error).toMatch(/__proto__/);
    expect(f.game.restoreSnapshot).not.toHaveBeenCalled();
  });
});

describe("free disk space and package versions (5b)", () => {
  test("asked for, Foundry's restore check gives the free space", async () => {
    const f = foundry();
    const post = vi.fn(() => Promise.resolve({ required: 0, available: 5e10 }));
    const r = await runServerBackups(
      { game: { ...f.game, post } },
      { ...req("list"), disk: true },
    );
    expect(post).toHaveBeenCalledWith({
      action: "checkRestoreSnapshotDiskSpace",
      snapshotData: { originalSize: 0 },
    });
    expect(r.listing?.free).toBe(5e10);
  });

  test("not asked for, or failing, there is none", async () => {
    const f = foundry();
    const post = vi.fn(() => Promise.reject(new Error("no")));
    expect(
      (await runServerBackups({ game: { ...f.game, post } }, req("list")))
        .listing,
    ).not.toHaveProperty("free");
    expect(post).not.toHaveBeenCalled();
    expect(
      (
        await runServerBackups(
          { game: { ...f.game, post } },
          { ...req("list"), disk: true },
        )
      ).listing,
    ).not.toHaveProperty("free");
  });

  test("a package backup keeps the package's version", async () => {
    const f = foundry();
    f.game.listBackups.mockResolvedValue({
      ...listing,
      module: {
        m: [{ id: "module.m.2", createdAt: 5, size: 1, version: "0.10.4" }],
      },
    } as never);
    const r = await runServerBackups(f.page, req("list"));
    const m = r.listing?.packages.find((p) => p.id === "m");
    expect(m?.backups[0]?.version).toBe("0.10.4");
  });
});

describe("package backups in order (code review)", () => {
  test("newest first, whatever order Foundry lists them in", async () => {
    const f = foundry();
    f.game.listBackups.mockResolvedValue({
      ...listing,
      module: {
        m: [
          { id: "module.m.old", createdAt: 1, size: 1 },
          { id: "module.m.new", createdAt: 9, size: 1 },
        ],
      },
    } as never);
    const r = await runServerBackups(f.page, req("list"));
    const m = r.listing?.packages.find((p) => p.id === "m");
    expect(m?.backups.map((b) => b.id)).toEqual([
      "module.m.new",
      "module.m.old",
    ]);
  });
});

describe("our snapshot dialog through Foundry (Phase 6)", () => {
  test("space asks Foundry's own create check; create runs without its dialog, with the note", async () => {
    const f = foundry();
    const post = vi.fn(() =>
      Promise.resolve({ required: 3_400_000_000, available: 48_000_000_000 }),
    );
    const game = { ...f.game, post };
    const page = { game };
    const r = await runServerBackups(page, {
      requestId: "r1",
      op: "space",
      ids: [],
    });
    expect(post).toHaveBeenCalledWith({
      action: "checkCreateSnapshotDiskSpace",
    });
    expect(r.space).toEqual({
      required: 3_400_000_000,
      available: 48_000_000_000,
    });
    await runServerBackups(page, {
      requestId: "r2",
      op: "createSnapshot",
      ids: [],
      note: "Before 14.371",
    });
    expect(f.game.createSnapshot).toHaveBeenCalledWith({
      dialog: false,
      note: "Before 14.371",
    });
  });

  test("a space check Foundry can't answer is left out, not an error", async () => {
    const f = foundry();
    const game = {
      ...f.game,
      post: vi.fn(() => Promise.reject(new Error("no"))),
    };
    const r = await runServerBackups(
      { game },
      { requestId: "r1", op: "space", ids: [] },
    );
    expect(r.space).toBeUndefined();
    expect(r.error).toBeUndefined();
  });
});
