import { describe, expect, test } from "vitest";
import { emptyLibrary } from "@module-library/shared/library/schema";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import { createState } from "../../src/background/state.ts";

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
      takenAt: "t",
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
