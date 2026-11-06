import { describe, expect, test } from "vitest";
import {
  parseBackupsReply,
  parseBackupsRequest,
} from "../../src/page-backups.ts";

describe("backups requests", () => {
  test("list, take, restore one, delete several", () => {
    const base = { requestId: "r1", worldId: "w" };
    expect(parseBackupsRequest({ ...base, op: "list" })).toEqual({
      ...base,
      op: "list",
      ids: [],
    });
    expect(parseBackupsRequest({ ...base, op: "create" })?.op).toBe("create");
    expect(
      parseBackupsRequest({ ...base, op: "restore", ids: ["b1"] })?.ids,
    ).toEqual(["b1"]);
    expect(
      parseBackupsRequest({ ...base, op: "delete", ids: ["b1", "b2"] })?.ids,
    ).toEqual(["b1", "b2"]);
  });

  test("refuses unknown operations and bad ids", () => {
    const base = { requestId: "r1", worldId: "w" };
    for (const bad of [
      { ...base, op: "wipe" },
      { ...base, op: "restore" },
      { ...base, op: "restore", ids: ["a", "b"] },
      { ...base, op: "delete", ids: [] },
      {
        ...base,
        op: "delete",
        ids: Array.from({ length: 51 }, (_, i) => `b${String(i)}`),
      },
      { ...base, op: "list", ids: ["x"] },
      { ...base, op: "delete", ids: [""] },
      { requestId: "", worldId: "w", op: "list" },
      { requestId: "r1", worldId: "", op: "list" },
    ])
      expect(parseBackupsRequest(bad)).toBeUndefined();
  });
});

describe("backups replies", () => {
  test("a list of backups, checked field by field", () => {
    expect(
      parseBackupsReply({
        requestId: "r1",
        backups: [
          {
            id: "b1",
            createdAt: 1,
            size: 1024,
            note: "Before",
            snapshot: false,
          },
          { id: "b2", createdAt: 2, size: 0, snapshot: true },
        ],
      }),
    ).toEqual({
      requestId: "r1",
      backups: [
        { id: "b1", createdAt: 1, size: 1024, note: "Before", snapshot: false },
        { id: "b2", createdAt: 2, size: 0, snapshot: true },
      ],
    });
    expect(parseBackupsReply({ requestId: "r1", error: "nope" })).toEqual({
      requestId: "r1",
      error: "nope",
    });
  });

  test("refuses a malformed list", () => {
    for (const bad of [
      {
        requestId: "r1",
        backups: [{ id: "", createdAt: 1, size: 1, snapshot: false }],
      },
      {
        requestId: "r1",
        backups: [{ id: "b", createdAt: "x", size: 1, snapshot: false }],
      },
      {
        requestId: "r1",
        backups: [{ id: "b", createdAt: 1, size: -1, snapshot: false }],
      },
      {
        requestId: "r1",
        backups: [{ id: "b", createdAt: 1, size: 1, snapshot: "no" }],
      },
      { requestId: "r1", backups: "all" },
      { backups: [] },
    ])
      expect(parseBackupsReply(bad)).toBeUndefined();
  });
});
