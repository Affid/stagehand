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

  test("snapshots are taken, restored and deleted with Foundry's dialogs", async () => {
    const f = foundry();
    await runServerBackups(f.page, req("createSnapshot"));
    expect(f.game.createSnapshot).toHaveBeenCalledWith({ dialog: true });
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
