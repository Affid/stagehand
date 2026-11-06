import { describe, expect, test } from "vitest";
import { parseBackupsRequest } from "../../src/page-backups.ts";
import {
  parseServerBackupsReply,
  parseServerBackupsRequest,
} from "../../src/page-server-backups.ts";

describe("package backups name their package type", () => {
  test("world by default; module and system too; nothing else", () => {
    const base = { requestId: "r1", worldId: "p", op: "list" };
    expect(parseBackupsRequest(base)?.type).toBe("world");
    expect(parseBackupsRequest({ ...base, type: "module" })?.type).toBe(
      "module",
    );
    expect(parseBackupsRequest({ ...base, type: "system" })?.type).toBe(
      "system",
    );
    expect(parseBackupsRequest({ ...base, type: "snapshot" })).toBeUndefined();
  });
});

describe("server backups requests", () => {
  test("list, take, restore one snapshot, delete some", () => {
    const base = { requestId: "r1" };
    expect(parseServerBackupsRequest({ ...base, op: "list" })).toEqual({
      requestId: "r1",
      op: "list",
      ids: [],
    });
    expect(
      parseServerBackupsRequest({ ...base, op: "createSnapshot" })?.op,
    ).toBe("createSnapshot");
    expect(
      parseServerBackupsRequest({ ...base, op: "restoreSnapshot", ids: ["s1"] })
        ?.ids,
    ).toEqual(["s1"]);
    expect(
      parseServerBackupsRequest({
        ...base,
        op: "deleteSnapshots",
        ids: ["s1", "s2"],
      })?.ids,
    ).toEqual(["s1", "s2"]);
    for (const bad of [
      { ...base, op: "wipe" },
      { ...base, op: "restoreSnapshot", ids: [] },
      { ...base, op: "restoreSnapshot", ids: ["a", "b"] },
      { ...base, op: "deleteSnapshots", ids: [] },
      { ...base, op: "list", ids: ["x"] },
      { requestId: "", op: "list" },
    ])
      expect(parseServerBackupsRequest(bad)).toBeUndefined();
  });
});

describe("server backups replies", () => {
  const listing = {
    snapshots: [
      {
        id: "s1",
        createdAt: 5,
        size: 10,
        generation: 14,
        build: 370,
        count: 3,
        note: "Before update",
      },
    ],
    packages: [
      {
        type: "world",
        id: "w",
        title: "W",
        installed: true,
        backups: [{ id: "b", createdAt: 1, size: 2, snapshot: false }],
      },
    ],
  };

  test("a listing of snapshots and packages, checked", () => {
    expect(parseServerBackupsReply({ requestId: "r1", listing })).toEqual({
      requestId: "r1",
      listing,
    });
    expect(parseServerBackupsReply({ requestId: "r1", error: "no" })).toEqual({
      requestId: "r1",
      error: "no",
    });
  });

  test("refuses malformed entries", () => {
    const bad = (over: object) => ({
      requestId: "r1",
      listing: { ...listing, ...over },
    });
    for (const p of [
      bad({
        snapshots: [
          {
            id: "s",
            createdAt: 1,
            size: 1,
            generation: "14",
            build: 1,
            count: 1,
          },
        ],
      }),
      bad({
        packages: [
          {
            type: "snapshot",
            id: "x",
            title: "X",
            installed: true,
            backups: [],
          },
        ],
      }),
      bad({
        packages: [
          { type: "world", id: "x", title: "X", installed: "yes", backups: [] },
        ],
      }),
      bad({ packages: "all" }),
      { listing },
    ])
      expect(parseServerBackupsReply(p)).toBeUndefined();
  });
});
