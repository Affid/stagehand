import { describe, expect, test, vi } from "vitest";
import { parseBackupsReply } from "../../src/page-backups.ts";
import { runBackups } from "../../src/page/backups.ts";

const raw = [
  {
    id: "b2",
    createdAt: 2000,
    size: 2048,
    note: "Session 2",
    snapshotId: null,
  },
  {
    id: "b1",
    createdAt: "1970-01-01T00:00:01.000Z",
    size: 1024,
    snapshotId: "s1",
  },
];

function foundry() {
  const world = { id: "w", type: "world", title: "W" };
  const game = {
    worlds: {
      values: () => [].values(),
      get: (id: string) => (id === "w" ? world : undefined),
    },
    listBackups: vi.fn(() => Promise.resolve({ world: { w: raw } })),
    createBackup: vi.fn(() => Promise.resolve(true)),
    restoreBackup: vi.fn(() => Promise.resolve()),
    deleteBackups: vi.fn(() => Promise.resolve()),
  };
  return { page: { game }, game, world };
}

const req = (
  op: "list" | "create" | "restore" | "delete",
  ids: string[] = [],
) => ({
  requestId: "r1",
  worldId: "w",
  type: "world" as const,
  op,
  ids,
});

describe("a world's backups through Foundry", () => {
  test("lists them newest first, with sizes, notes and snapshot membership", async () => {
    const f = foundry();
    expect(await runBackups(f.page, req("list"))).toEqual({
      backups: [
        {
          id: "b2",
          createdAt: 2000,
          size: 2048,
          note: "Session 2",
          snapshot: false,
        },
        { id: "b1", createdAt: 1000, size: 1024, snapshot: true },
      ],
    });
  });

  test("takes one with Foundry's own dialog, then lists", async () => {
    const f = foundry();
    await runBackups(f.page, req("create"));
    expect(f.game.createBackup).toHaveBeenCalledWith(f.world, { dialog: true });
    expect(f.game.listBackups).toHaveBeenCalled();
  });

  test("restores one with Foundry's confirm-code dialog", async () => {
    const f = foundry();
    await runBackups(f.page, req("restore", ["b2"]));
    expect(f.game.restoreBackup).toHaveBeenCalledWith(raw[0], { dialog: true });
  });

  test("deletes after listing, so Foundry's own cache knows them", async () => {
    const f = foundry();
    await runBackups(f.page, req("delete", ["b2"]));
    expect(f.game.listBackups.mock.invocationCallOrder[0]).toBeLessThan(
      f.game.deleteBackups.mock.invocationCallOrder[0] ?? 0,
    );
    expect(f.game.deleteBackups).toHaveBeenCalledWith(f.world, ["b2"], {
      dialog: true,
    });
  });

  test("an unknown backup, a missing world or a failure is reported, never thrown", async () => {
    const f = foundry();
    expect((await runBackups(f.page, req("restore", ["nope"]))).error).toMatch(
      /nope/,
    );
    expect(
      (await runBackups(f.page, { ...req("list"), worldId: "x" })).error,
    ).toMatch(/x/);
    f.game.listBackups.mockRejectedValueOnce(new Error("offline"));
    expect((await runBackups(f.page, req("list"))).error).toMatch(/offline/);
  });

  test("odd records are clamped to what the reply allows, so the answer is never dropped", async () => {
    const f = foundry();
    const many = Array.from({ length: 1100 }, (_, i) => ({
      id: `${"x".repeat(400)}${String(i)}`,
      createdAt: Number.NaN,
      size: -5,
      snapshotId: null,
    }));
    f.game.listBackups.mockResolvedValue({ world: { w: many } } as never);
    const r = await runBackups(f.page, req("list"));
    expect(r.backups).toHaveLength(1000);
    expect(
      parseBackupsReply({ requestId: "r1", backups: r.backups }),
    ).toBeTruthy();
  });
});
