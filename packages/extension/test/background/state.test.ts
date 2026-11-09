import { describe, expect, test } from "vitest";
import { emptyLibrary } from "@module-library/shared/library/schema";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import { createState, MAX_WORLDS } from "../../src/background/state.ts";

const S = "http://localhost:30000";
const fresh = () => createState(serialized(memoryKeyValue()));

describe("server state", () => {
  test("servers are added once and admin verification is recorded", async () => {
    const state = fresh();
    await state.addServer(S, "t1");
    await state.addServer(S, "t2");
    await state.markAdminVerified(S, "t3");
    expect(await state.servers()).toEqual({
      [S]: { id: S, addedAt: "t1", adminVerifiedAt: "t3" },
    });
  });

  test("verifying an unknown server does nothing", async () => {
    const state = fresh();
    await state.markAdminVerified(S, "t");
    expect(await state.servers()).toEqual({});
  });

  test("library ops are applied and persisted; failures leave it unchanged", async () => {
    const state = fresh();
    const ok = await state.applyLibraryOp(S, {
      op: "tag.create",
      tag: { id: "t1", name: "combat", color: "#000000" },
    });
    expect(ok.ok).toBe(true);
    const bad = await state.applyLibraryOp(S, {
      op: "tag.create",
      tag: { id: "t2", name: "COMBAT", color: "#000000" },
    });
    expect(bad.ok).toBe(false);
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual(["t1"]);
  });

  test("import replaces the library with a revision newer than both", async () => {
    const state = fresh();
    await state.applyLibraryOp(S, {
      op: "tag.create",
      tag: { id: "t1", name: "x", color: "#000000" },
    });
    const imported = await state.replaceLibrary(S, {
      ...emptyLibrary("other"),
      revision: 0,
    });
    expect(imported).toMatchObject({ serverId: S, revision: 2, tags: [] });
  });

  test("snapshots and hellos are stored per world", async () => {
    const state = fresh();
    const snap = {
      worldId: "w",
      title: "W",
      system: { id: "dnd5e", version: "5" },
      coreVersion: "14.369",
      active: [],
      companionVersion: "0.1.0",
      takenAt: "2026-11-05T00:00:00.000Z",
    };
    await state.putSnapshot(S, snap);
    await state.putHello(S, {
      worldId: "w",
      moduleVersion: "0.1.0",
      protocol: 1,
      at: "t",
    });
    expect((await state.snapshots(S)).w).toEqual(snap);
    expect((await state.hellos(S)).w?.protocol).toBe(1);
  });
});

describe("state: review fixes", () => {
  test("keeps at most MAX_WORLDS snapshots, dropping the oldest", async () => {
    const state = fresh();
    for (let i = 0; i < MAX_WORLDS + 2; i++)
      await state.putSnapshot(S, {
        worldId: `w${String(i)}`,
        title: "W",
        system: { id: "dnd5e", version: "5" },
        coreVersion: "14.369",
        active: [],
        companionVersion: "0.1.0",
        takenAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      });
    const all = await state.snapshots(S);
    expect(Object.keys(all)).toHaveLength(MAX_WORLDS);
    expect(all.w0).toBeUndefined();
  });

  test("admin verification can be revoked", async () => {
    const state = fresh();
    await state.addServer(S, "t1");
    await state.markAdminVerified(S, "t2");
    await state.revokeAdmin(S);
    expect((await state.servers())[S]?.adminVerifiedAt).toBeUndefined();
  });
});

describe("state: removing a server (settings panel)", () => {
  test("the record goes; another server and the library stay", async () => {
    const state = createState(serialized(memoryKeyValue()));
    await state.addServer(S, "t1");
    await state.addServer("http://other:1", "t1");
    await state.applyLibraryOp(S, {
      op: "tag.create",
      tag: { id: "t1", name: "kept", color: "#000000" },
    });
    const before = await state.library(S);
    await state.removeServer(S);
    expect(Object.keys(await state.servers())).toEqual(["http://other:1"]);
    expect(await state.library(S)).toEqual(before);
  });
});

describe("state: a server's name and new address (app's home, 2026-11-09)", () => {
  const T = "http://192.168.1.20:30000";

  test("a revoked admin keeps the server's name and last opening", async () => {
    const state = fresh();
    await state.addServer(S, "t1");
    await state.renameServer(S, "Home");
    await state.markOpened(S, "t2");
    await state.markAdminVerified(S, "t3");
    await state.revokeAdmin(S);
    expect((await state.servers())[S]).toEqual({
      id: S,
      addedAt: "t1",
      name: "Home",
      openedAt: "t2",
    });
  });

  test("a move copies the queue and seen modules, not admin verification", async () => {
    const state = fresh();
    await state.addServer(S, "t1");
    await state.markAdminVerified(S, "t2");
    await state.seedSorted(S, ["a", "b"]);
    await state.moveServer(S, T);
    expect((await state.servers())[T]).toEqual({ id: T, addedAt: "t1" });
    expect(await state.sortedModules(T)).toEqual(["a", "b"]);
    expect(await state.commands(T)).toEqual([]);
    expect((await state.library(T)).serverId).toBe(T);
  });

  test("a move onto an address a removed server left data at clears it", async () => {
    const state = fresh();
    await state.addServer(T, "t0");
    await state.updateCommands(T, () => [{ id: "old" } as never]);
    await state.seedSorted(T, ["stale"]);
    await state.removeServer(T);
    await state.addServer(S, "t1");
    await state.moveServer(S, T);
    expect(await state.commands(T)).toEqual([]);
    expect(await state.sortedModules(T)).toBeNull();
    expect(await state.setup(T)).toBeUndefined();
    expect(await state.snapshots(T)).toEqual({});
    expect((await state.library(T)).serverId).toBe(T);
  });

  test("moving or renaming an unknown server adds nothing", async () => {
    const state = fresh();
    await state.moveServer(S, T);
    await state.renameServer(S, "x");
    await state.markOpened(S, "t");
    expect(await state.servers()).toEqual({});
  });
});
