import { describe, expect, test } from "vitest";
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import {
  nextSyncFile,
  parseSyncFile,
  serializeSyncFile,
} from "@stagehand/shared/library/sync-file";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import { createState } from "../../src/background/state.ts";
import {
  librarySynced,
  syncLibrary,
} from "../../src/background/library-sync.ts";

const S = "http://localhost:30000";
const NOW = "2026-11-10T12:00:00.000Z";
const fresh = () => createState(serialized(memoryKeyValue()));

const tag = (id: string, name = id) => ({
  id,
  name,
  color: "#33aa77",
  revision: 1,
});

let ids = 0;
const newId = () => `save-${String(++ids)}`;

/** A file another device saved, in a line of its own. */
const file = (library: Partial<Library>, sorted: string[] | null = null) =>
  serializeSyncFile(
    nextSyncFile(
      { library: { ...emptyLibrary("elsewhere"), ...library }, sorted },
      newId(),
      null,
    ),
    "t",
  );

/** A file another device saved after `text`, with `library` changed. */
function after(text: string, library: Partial<Library>): string {
  const previous = parseSyncFile(text, S);
  if (!previous.ok) throw new Error("not a file");
  const side = {
    ...previous.file.side,
    library: { ...previous.file.side.library, ...library },
  };
  return serializeSyncFile(nextSyncFile(side, newId(), previous.file), "t");
}

const tagsIn = (text: string | null) => {
  const read = text === null ? null : parseSyncFile(text, S);
  return read?.ok ? read.file.side.library.tags.map((t) => t.id) : null;
};

/** Syncs and confirms the write, as the page does; the pushed text. */
async function pushed(state: ReturnType<typeof fresh>, text: string | null) {
  const reply = await syncLibrary(state, S, text, NOW, newId);
  if (!reply.ok || reply.push === null) throw new Error("no push");
  await librarySynced(state, S, reply.push);
  return reply.push;
}

async function withTag(id: string) {
  const state = fresh();
  await state.applyLibraryOp(S, {
    op: "tag.create",
    tag: { id, name: id, color: "#000000" },
  });
  return state;
}

describe("library sync in the background", () => {
  test("no file on the server: pushes this device's library", async () => {
    const state = await withTag("t1");
    const reply = await syncLibrary(state, S, null, NOW, newId);
    expect(reply).toMatchObject({ ok: true, changedLocal: false, clashes: [] });
    expect(reply.ok && tagsIn(reply.push)).toEqual(["t1"]);
  });

  test("takes the server's library into an empty device", async () => {
    const state = fresh();
    const reply = await syncLibrary(
      state,
      S,
      file({ tags: [tag("t9")] }),
      NOW,
      newId,
    );
    expect(reply).toMatchObject({ ok: true, changedLocal: true, push: null });
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual(["t9"]);
    expect((await state.library(S)).serverId).toBe(S);
  });

  test("merges both and pushes the result", async () => {
    const state = await withTag("t1");
    const reply = await syncLibrary(
      state,
      S,
      file({ tags: [tag("t9")] }),
      NOW,
      newId,
    );
    expect(reply.ok && tagsIn(reply.push)).toEqual(["t9", "t1"]);
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual([
      "t9",
      "t1",
    ]);
  });

  test("once written, the pushed file is the base: the next sync is quiet", async () => {
    const state = await withTag("t1");
    const first = await syncLibrary(state, S, null, NOW, newId);
    if (!first.ok || first.push === null) throw new Error("no push");
    await librarySynced(state, S, first.push);
    const again = await syncLibrary(state, S, first.push, NOW, newId);
    expect(again).toMatchObject({ ok: true, changedLocal: false, push: null });
  });

  test("a server change is taken against the base, not merged as a clash", async () => {
    const state = await withTag("t1");
    const first = await syncLibrary(state, S, null, NOW, newId);
    if (!first.ok || first.push === null) throw new Error("no push");
    await librarySynced(state, S, first.push);
    const renamed = after(first.push, { tags: [tag("t1", "renamed")] });
    const reply = await syncLibrary(state, S, renamed, NOW, newId);
    expect(reply).toMatchObject({ ok: true, clashes: [], push: null });
    expect((await state.library(S)).tags[0]?.name).toBe("renamed");
  });

  test("sorted modules travel both ways", async () => {
    const state = fresh();
    await state.seedSorted(S, ["a"]);
    const reply = await syncLibrary(state, S, file({}, ["b"]), NOW, newId);
    expect(await state.sortedModules(S)).toEqual(["a", "b"]);
    const sent =
      reply.ok && reply.push ? parseSyncFile(reply.push, S) : undefined;
    expect(sent?.ok && sent.file.side.sorted).toEqual(["b", "a"]);
  });

  test("a damaged file is replaced by this device's library, never read", async () => {
    const state = await withTag("t1");
    const reply = await syncLibrary(state, S, "<html>oops</html>", NOW, newId);
    expect(reply).toMatchObject({
      ok: true,
      repaired: true,
      changedLocal: false,
    });
    expect(reply.ok && tagsIn(reply.push)).toEqual(["t1"]);
  });

  test("a file from a newer Stagehand is left alone", async () => {
    const state = await withTag("t1");
    const newer = JSON.stringify({
      ...(JSON.parse(file({})) as object),
      version: 2,
    });
    expect(await syncLibrary(state, S, newer, NOW, newId)).toEqual({
      ok: false,
      error: "newer",
    });
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual(["t1"]);
  });

  test("reports clashes for the page's notice", async () => {
    const state = await withTag("t1");
    const reply = await syncLibrary(
      state,
      S,
      file({ tags: [tag("t1", "theirs")] }),
      NOW,
      newId,
    );
    expect(reply.ok && reply.clashes).toEqual([
      { kind: "tag", id: "t1", name: "t1", reason: "kept-this-device" },
    ]);
  });

  test("an unreadable written text does not become the base", async () => {
    const state = await withTag("t1");
    await librarySynced(state, S, "not json");
    expect(await state.syncBase(S)).toBeNull();
  });

  test("the base moves with the server to a new address", async () => {
    const state = await withTag("t1");
    const first = await syncLibrary(state, S, null, NOW, newId);
    if (!first.ok || first.push === null) throw new Error("no push");
    await librarySynced(state, S, first.push);
    await state.addServer(S, "t");
    await state.moveServer(S, "http://localhost:30001");
    expect(await state.syncBase("http://localhost:30001")).not.toBeNull();
  });
});

describe("library sync: only a file saved from the base is merged three-way (review)", () => {
  test("a replaced file deletes nothing here", async () => {
    const state = await withTag("t1");
    await pushed(state, null);
    // Another device replaced the file with a library without t1.
    const replaced = file({ tags: [tag("t2")] });
    const reply = await syncLibrary(state, S, replaced, NOW, newId);
    expect(reply.ok && tagsIn(reply.push)).toEqual(["t2", "t1"]);
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual([
      "t2",
      "t1",
    ]);
  });

  test("a stale read from another tab deletes nothing", async () => {
    const state = await withTag("t1");
    const f0 = await pushed(state, null);
    await state.applyLibraryOp(S, {
      op: "tag.create",
      tag: { id: "t2", name: "t2", color: "#000000" },
    });
    await pushed(state, f0);
    // A second tab read f0 before the first tab wrote f1.
    const reply = await syncLibrary(state, S, f0, NOW, newId);
    expect((await state.library(S)).tags.map((t) => t.id)).toEqual([
      "t1",
      "t2",
    ]);
    expect(reply.ok && tagsIn(reply.push)).toEqual(["t1", "t2"]);
  });

  test("a deletion saved from the base still comes through", async () => {
    const state = await withTag("t1");
    const f0 = await pushed(state, null);
    const deleted = after(f0, { tags: [] });
    await syncLibrary(state, S, deleted, NOW, newId);
    expect((await state.library(S)).tags).toEqual([]);
  });

  test("modules sorted while a merge runs stay sorted", async () => {
    const state = fresh();
    await state.seedSorted(S, ["a"]);
    const merging = syncLibrary(state, S, file({}, ["b"]), NOW, newId);
    const marking = state.markSorted(S, ["c"]);
    await Promise.all([merging, marking]);
    expect(new Set(await state.sortedModules(S))).toEqual(
      new Set(["a", "b", "c"]),
    );
  });
});
