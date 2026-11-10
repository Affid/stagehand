import { describe, expect, test } from "vitest";
import type { SyncSide } from "../src/library/merge.ts";
import { emptyLibrary, type Library } from "../src/library/schema.ts";
import {
  descendsFrom,
  MAX_HISTORY,
  MAX_SYNC_FILE_CHARS,
  nextSyncFile,
  parseSyncFile,
  SYNC_FILE_PATH,
  serializeSyncFile,
} from "../src/library/sync-file.ts";

const save = (side: SyncSide) => nextSyncFile(side, "f1", null);

const library: Library = {
  ...emptyLibrary("http://a:1"),
  revision: 4,
  tags: [{ id: "t1", name: "combat", color: "#33aa77", revision: 2 }],
  modules: { dice: { folderId: null, tags: ["t1"], note: "loud" } },
};

describe("library sync file", () => {
  test("lives in the server's Data folder under our own name", () => {
    expect(SYNC_FILE_PATH).toBe("stagehand/library.json");
  });

  test("round-trips, rebound to the reading device's server id", () => {
    const text = serializeSyncFile(
      save({ library, sorted: ["dice"] }),
      "2026-11-10T12:00:00Z",
    );
    expect(JSON.parse(text)).toMatchObject({
      format: "stagehand-library",
      version: 1,
      savedAt: "2026-11-10T12:00:00Z",
    });
    expect(parseSyncFile(text, "http://b:2")).toEqual({
      ok: true,
      file: {
        id: "f1",
        history: [],
        side: {
          library: { ...library, serverId: "http://b:2" },
          sorted: ["dice"],
        },
      },
    });
  });

  test("keeps unseeded sorted modules as null", () => {
    const text = serializeSyncFile(save({ library, sorted: null }), "t");
    expect(parseSyncFile(text, "s")).toMatchObject({
      ok: true,
      file: { side: { sorted: null } },
    });
  });

  test("rejects text that is not JSON or not our file", () => {
    expect(parseSyncFile("<html>", "s")).toEqual({
      ok: false,
      error: "not-json",
    });
    expect(parseSyncFile("{}", "s")).toEqual({ ok: false, error: "invalid" });
    const exported = JSON.stringify({ format: "stagehand", library });
    expect(parseSyncFile(exported, "s")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  test("rejects a file from a newer Stagehand", () => {
    const text = JSON.stringify({
      ...JSON.parse(serializeSyncFile(save({ library, sorted: null }), "t")),
      version: 2,
    });
    expect(parseSyncFile(text, "s")).toEqual({ ok: false, error: "newer" });
  });

  test("rejects a damaged library", () => {
    const text = JSON.stringify({
      ...JSON.parse(serializeSyncFile(save({ library, sorted: null }), "t")),
      library: { ...library, tags: [{ id: "t1" }] },
    });
    expect(parseSyncFile(text, "s")).toEqual({ ok: false, error: "invalid" });
  });

  test("refuses an oversized file before parsing it", () => {
    const text = `{"pad":"${"x".repeat(MAX_SYNC_FILE_CHARS)}"}`;
    expect(parseSyncFile(text, "s")).toEqual({ ok: false, error: "too-big" });
  });

  test("drops missing tags from saved views", () => {
    const filter = { text: "", tags: ["t1", "gone"], tagOp: "or" as const };
    const withView = {
      ...library,
      views: [{ id: "v1", name: "Combat", filter: { ...filter, authors: [] } }],
    };
    const text = serializeSyncFile(
      save({ library: withView, sorted: null }),
      "t",
    );
    const result = parseSyncFile(text, "s");
    expect(result.ok && result.file.side.library.views[0]?.filter.tags).toEqual(
      ["t1"],
    );
  });

  test("repairs references a hand-edited file leaves dangling", () => {
    const broken = {
      ...library,
      modules: { dice: { folderId: "nope", tags: ["t1", "gone"], note: "" } },
    };
    const text = serializeSyncFile(
      save({ library: broken, sorted: null }),
      "t",
    );
    const result = parseSyncFile(text, "s");
    expect(result.ok && result.file.side.library.modules.dice).toEqual({
      folderId: null,
      tags: ["t1"],
      note: "",
    });
  });
});

describe("library sync file limits (review)", () => {
  test("refuses a file with absurd counts", () => {
    const tags = Array.from({ length: 5001 }, (_, i) => ({
      id: `t${String(i)}`,
      name: `t${String(i)}`,
      color: "#33aa77",
      revision: 1,
    }));
    const text = serializeSyncFile(
      save({ library: { ...library, tags, modules: {} }, sorted: null }),
      "t",
    );
    expect(parseSyncFile(text, "s")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("library sync file ancestry (review)", () => {
  const side = { library, sorted: null };

  test("each save remembers the saves it came from, up to a limit", () => {
    const first = nextSyncFile(side, "a", null);
    const second = nextSyncFile(side, "b", first);
    expect(second.history).toEqual(["a"]);
    expect(descendsFrom(second, "a")).toBe(true);
    expect(descendsFrom(second, "b")).toBe(true);
    expect(descendsFrom(first, "b")).toBe(false);
    let last = first;
    for (let i = 0; i < MAX_HISTORY + 5; i++)
      last = nextSyncFile(side, `s${String(i)}`, last);
    expect(last.history).toHaveLength(MAX_HISTORY);
    expect(descendsFrom(last, "a")).toBe(false);
  });

  test("a file without its id and history is not ours", () => {
    const text = JSON.parse(serializeSyncFile(save(side), "t")) as Record<
      string,
      unknown
    >;
    const rest = Object.fromEntries(
      Object.entries(text).filter(([k]) => k !== "id"),
    );
    expect(parseSyncFile(JSON.stringify(rest), "s")).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
