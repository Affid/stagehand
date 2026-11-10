// Library sync's background half (docs/LIBRARY-SYNC-PLAN.md): the page reads
// the server's file and hands the text here; this merges it with the
// library and says what to write back. The merge is three-way only when the
// file descends from the copy this browser last saw; otherwise (a replaced
// file, a stale read, two devices saving at once) it is a union, so nothing
// is deleted by mistake. Once the page has written the file,
// `librarySynced` makes it the new base.
import {
  type Clash,
  type MergeResult,
  mergeLibraries,
  type SyncSide,
} from "@stagehand/shared/library/merge";
import {
  descendsFrom,
  nextSyncFile,
  parseSyncFile,
  serializeSyncFile,
  type SyncFile,
  type SyncFileError,
} from "@stagehand/shared/library/sync-file";
import type { Library } from "@stagehand/shared/library/schema";
import { withResult } from "./kv.ts";
import type { ServerId } from "./servers.ts";
import type { ServerState } from "./state.ts";

export type LibrarySyncReply =
  | {
      readonly ok: true;
      /** This device's library or sorted modules changed: reload them. */
      readonly changedLocal: boolean;
      /** The file to write to the server, or null when it is up to date. */
      readonly push: string | null;
      readonly clashes: readonly Clash[];
      /** The server's file was unreadable and is being replaced. */
      readonly repaired: boolean;
    }
  | { readonly ok: false; readonly error: SyncFileError };

type Outcome = Pick<
  MergeResult,
  "library" | "sorted" | "clashes" | "changedLocal" | "changedServer"
>;

/** No usable file on the server: this device's library goes up as it is. */
const ownCopy = (library: Library, sorted: string[] | null): Outcome => ({
  library,
  sorted,
  clashes: [],
  changedLocal: false,
  changedServer: true,
});

/** The base, if the server's file was saved from it. */
async function baseFor(
  state: ServerState,
  server: ServerId,
  remote: SyncFile | null,
): Promise<SyncSide | null> {
  if (!remote) return null;
  const stored = await state.syncBase(server);
  return stored && descendsFrom(remote, stored.id) ? stored.side : null;
}

export async function syncLibrary(
  state: ServerState,
  server: ServerId,
  text: string | null,
  now: string,
  newId: () => string,
): Promise<LibrarySyncReply> {
  const read = text === null ? null : parseSyncFile(text, server);
  if (read && !read.ok && read.error === "newer")
    return { ok: false, error: "newer" };
  const remote = read?.ok ? read.file : null;
  const base = await baseFor(state, server, remote);
  const outcome = await state.mergeIntoLibrary<Outcome>(
    server,
    (local, sorted) => {
      if (!remote) return withResult(local, ownCopy(local, sorted));
      const r = mergeLibraries({
        base,
        local: { library: local, sorted },
        server: remote.side,
      });
      return withResult(r.changedLocal ? r.library : local, r);
    },
  );
  if (outcome.changedLocal && outcome.sorted)
    await state.putSorted(server, outcome.sorted);
  if (remote && !outcome.changedServer)
    await state.putSyncBase(server, { side: remote.side, id: remote.id });
  const { library, sorted } = outcome;
  const push = outcome.changedServer
    ? serializeSyncFile(nextSyncFile({ library, sorted }, newId(), remote), now)
    : null;
  return {
    ok: true,
    changedLocal: outcome.changedLocal,
    push,
    clashes: outcome.clashes,
    repaired: read !== null && !read.ok,
  };
}

/** The page wrote `text` to the server: it is now the server's copy. */
export async function librarySynced(
  state: ServerState,
  server: ServerId,
  text: string,
): Promise<void> {
  const read = parseSyncFile(text, server);
  if (read.ok)
    await state.putSyncBase(server, { side: read.file.side, id: read.file.id });
}
