import { afterEach, describe, expect, test, vi } from "vitest";
import type { LibrarySyncReply } from "../../src/background/library-sync.ts";
import type { ExtensionMessage } from "../../src/messages.ts";
import type { LibraryFileReply } from "../../src/page-library-file.ts";
import {
  createLibrarySync,
  type LibrarySyncDeps,
  type SyncStatus,
} from "../../src/ui/library-sync.ts";
import type { LibraryFileAsk } from "../../src/ui/page.ts";

afterEach(() => {
  vi.useRealTimers();
});

const quiet: LibrarySyncReply = {
  ok: true,
  changedLocal: false,
  push: null,
  clashes: [],
  repaired: false,
};

/** A fake page (the server's file) and background (merge answers in turn). */
function setup(
  replies: LibrarySyncReply[],
  file: LibraryFileReply = { missing: true },
) {
  let stored: LibraryFileReply = file;
  const writes: string[] = [];
  const sent: ExtensionMessage[] = [];
  const statuses: SyncStatus[] = [];
  const libraryFile = vi.fn((ask: LibraryFileAsk) => {
    if (ask.op === "read") return Promise.resolve(stored);
    writes.push(ask.text);
    stored = { text: ask.text };
    return Promise.resolve<LibraryFileReply>({});
  });
  const deps: LibrarySyncDeps = {
    page: { libraryFile },
    send: <T>(m: ExtensionMessage) => {
      sent.push(m);
      if (m.kind === "library-sync")
        return Promise.resolve((replies.shift() ?? quiet) as T);
      return Promise.resolve(undefined as T);
    },
    onStatus: (s) => statuses.push(s),
    onChangedLocal: vi.fn(() => Promise.resolve()),
    onNotice: vi.fn(),
  };
  return { deps, writes, sent, statuses, libraryFile };
}

describe("library sync on the page", () => {
  test("reads the file, merges it, writes the result, then checks it back", async () => {
    const f = setup([{ ...quiet, push: "FILE" }, quiet]);
    await createLibrarySync(f.deps).sync();
    expect(f.sent.map((m) => m.kind)).toEqual([
      "library-sync",
      "library-synced",
      "library-sync",
    ]);
    expect(f.sent[0]).toEqual({ kind: "library-sync", text: null });
    expect(f.writes).toEqual(["FILE"]);
    expect(f.sent[2]).toEqual({ kind: "library-sync", text: "FILE" });
    expect(f.statuses).toEqual([{ kind: "syncing" }, { kind: "synced" }]);
  });

  test("nothing to write: one read, one merge", async () => {
    const f = setup([quiet], { text: "SERVER" });
    await createLibrarySync(f.deps).sync();
    expect(f.sent).toEqual([{ kind: "library-sync", text: "SERVER" }]);
    expect(f.writes).toEqual([]);
  });

  test("reloads this device's library when the merge changed it", async () => {
    const f = setup([{ ...quiet, changedLocal: true }]);
    await createLibrarySync(f.deps).sync();
    expect(f.deps.onChangedLocal).toHaveBeenCalledTimes(1);
  });

  test("passes clashes and a repaired file on as notices", async () => {
    const clash = {
      kind: "tag",
      id: "t1",
      name: "Combat",
      reason: "kept-this-device",
    } as const;
    const f = setup([{ ...quiet, clashes: [clash], repaired: true }]);
    await createLibrarySync(f.deps).sync();
    expect(f.deps.onNotice).toHaveBeenCalledWith({
      clashes: [clash],
      repaired: true,
    });
  });

  test("a failed read stops with the reason", async () => {
    const f = setup([], { error: "Foundry answered HTTP 500." });
    await createLibrarySync(f.deps).sync();
    expect(f.statuses.at(-1)).toEqual({
      kind: "failed",
      reason: "read",
      error: "Foundry answered HTTP 500.",
    });
    expect(f.sent).toEqual([]);
  });

  test("a refused write stops with the reason and records nothing", async () => {
    const f = setup([{ ...quiet, push: "FILE" }]);
    f.libraryFile.mockImplementation((ask: LibraryFileAsk) =>
      Promise.resolve<LibraryFileReply>(
        ask.op === "read" ? { missing: true } : { error: "No permission." },
      ),
    );
    await createLibrarySync(f.deps).sync();
    expect(f.statuses.at(-1)).toEqual({
      kind: "failed",
      reason: "write",
      error: "No permission.",
    });
    expect(f.sent.map((m) => m.kind)).toEqual(["library-sync"]);
  });

  test("a file from a newer Stagehand is left alone", async () => {
    const f = setup([{ ok: false, error: "newer" }]);
    await createLibrarySync(f.deps).sync();
    expect(f.statuses.at(-1)).toEqual({ kind: "failed", reason: "newer" });
    expect(f.writes).toEqual([]);
  });

  test("a background that refuses is a failure, not a crash", async () => {
    const f = setup([]);
    const deps = {
      ...f.deps,
      send: () => Promise.reject(new Error("not admin-verified")),
    };
    await createLibrarySync(deps).sync();
    expect(f.statuses.at(-1)).toEqual({
      kind: "failed",
      reason: "refused",
      error: "not admin-verified",
    });
  });

  test("stops after a few rounds when another device keeps writing, and looks again later", async () => {
    vi.useFakeTimers();
    const pushes = Array.from({ length: 10 }, (_, i) => ({
      ...quiet,
      push: `F${String(i)}`,
    }));
    const f = setup(pushes);
    await createLibrarySync(f.deps).sync();
    expect(f.writes).toEqual(["F0", "F1", "F2"]);
    expect(f.statuses.at(-1)).toEqual({ kind: "synced" });
    await vi.advanceTimersByTimeAsync(2100);
    expect(f.writes).toEqual(["F0", "F1", "F2", "F3", "F4", "F5"]);
  });

  test("a status that throws does not stop later syncs", async () => {
    const f = setup([]);
    let calls = 0;
    const sync = createLibrarySync({
      ...f.deps,
      onStatus: () => {
        calls++;
        if (calls === 1) throw new Error("render failed");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sync.sync();
    await sync.sync();
    expect(f.sent.filter((m) => m.kind === "library-sync")).toHaveLength(1);
  });

  test("a sync asked for while one runs runs once more afterwards", async () => {
    const f = setup([]);
    const sync = createLibrarySync(f.deps);
    await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(f.sent.filter((m) => m.kind === "library-sync")).toHaveLength(2);
  });

  test("changes are synced once, two seconds after the last one", async () => {
    vi.useFakeTimers();
    const f = setup([]);
    const sync = createLibrarySync(f.deps);
    sync.changed();
    await vi.advanceTimersByTimeAsync(1500);
    sync.changed();
    await vi.advanceTimersByTimeAsync(1500);
    expect(f.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(600);
    expect(f.sent).toHaveLength(1);
  });

  test("flush syncs a waiting change at once, and only then", async () => {
    vi.useFakeTimers();
    const f = setup([]);
    const sync = createLibrarySync(f.deps);
    sync.flush();
    await vi.advanceTimersByTimeAsync(10);
    expect(f.sent).toHaveLength(0);
    sync.changed();
    sync.flush();
    await vi.advanceTimersByTimeAsync(10);
    expect(f.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(f.sent).toHaveLength(1);
  });
});
