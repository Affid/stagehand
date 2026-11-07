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
