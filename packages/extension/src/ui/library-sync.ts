// Library sync's page half (docs/LIBRARY-SYNC-PLAN.md): reads the server's
// file through the page world, has the background merge it, writes back
// what the background asks for, and reads it again to catch another
// device's write in between. One sync at a time; changes are batched.
import type { Clash } from "@stagehand/shared/library/merge";
import { logError } from "@stagehand/shared/log";
import type { LibrarySyncReply } from "../background/library-sync.ts";
import type { Send } from "./actions.ts";
import type { PageBridge } from "./page.ts";

export type SyncFailure = "read" | "write" | "newer" | "refused";

export type SyncStatus =
  | { readonly kind: "syncing" }
  | { readonly kind: "synced" }
  | {
      readonly kind: "failed";
      readonly reason: SyncFailure;
      readonly error?: string;
    };

export interface SyncNotice {
  readonly clashes: readonly Clash[];
  readonly repaired: boolean;
}

export interface LibrarySyncDeps {
  readonly page: Pick<PageBridge, "libraryFile">;
  readonly send: Send;
  readonly onStatus: (status: SyncStatus) => void;
  /** The merge changed this device's library: load it again. */
  readonly onChangedLocal: () => Promise<unknown>;
  readonly onNotice: (notice: SyncNotice) => void;
}

export interface LibrarySync {
  sync(): Promise<void>;
  /** The library changed here: sync soon, once the edits pause. */
  changed(): void;
  /** Sync a waiting change now (the page is being left). */
  flush(): void;
}

/** Edits within this long go up together. */
export const SYNC_DELAY_MS = 2000;
/** Write and read back at most this often in one sync. */
const MAX_ROUNDS = 3;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** Ends a sync with the status to show. */
class SyncStop extends Error {
  readonly status: SyncStatus;
  constructor(status: SyncStatus) {
    super(status.kind);
    this.status = status;
  }
}

const failed = (reason: SyncFailure, error?: string): SyncStop =>
  new SyncStop({ kind: "failed", reason, ...(error ? { error } : {}) });

/** One read, merge and maybe write: true when something was written. */
async function round(deps: LibrarySyncDeps): Promise<boolean> {
  const read = await deps.page.libraryFile({ op: "read" });
  if (read.error !== undefined) throw failed("read", read.error);
  const reply = await deps
    .send<LibrarySyncReply>({ kind: "library-sync", text: read.text ?? null })
    .catch((e: unknown) => {
      throw failed("refused", message(e));
    });
  if (!reply.ok) throw failed(reply.error === "newer" ? "newer" : "read");
  if (reply.changedLocal) await deps.onChangedLocal();
  if (reply.clashes.length > 0 || reply.repaired)
    deps.onNotice({ clashes: reply.clashes, repaired: reply.repaired });
  if (reply.push === null) return false;
  const written = await deps.page.libraryFile({
    op: "write",
    text: reply.push,
  });
  if (written.error !== undefined) throw failed("write", written.error);
  await deps.send({ kind: "library-synced", text: reply.push });
  return true;
}

/** One sync: true when every round wrote, so another device kept writing. */
async function runSync(deps: LibrarySyncDeps): Promise<boolean> {
  deps.onStatus({ kind: "syncing" });
  try {
    let rounds = 0;
    while (rounds < MAX_ROUNDS && (await round(deps))) rounds++;
    deps.onStatus({ kind: "synced" });
    return rounds === MAX_ROUNDS;
  } catch (e: unknown) {
    deps.onStatus(
      e instanceof SyncStop ? e.status : failed("refused", message(e)).status,
    );
    return false;
  }
}

export function createLibrarySync(deps: LibrarySyncDeps): LibrarySync {
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const sync = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    const takeAgain = (): boolean => {
      const asked = again;
      again = false;
      return asked;
    };
    running = (async () => {
      try {
        let busy = false;
        do busy = await runSync(deps);
        while (takeAgain());
        // Still writing after every round: look again later, not now.
        if (busy) schedule();
      } catch (e: unknown) {
        logError("library sync", e);
      } finally {
        running = null;
      }
    })();
    return running;
  };
  const fire = (): void => {
    timer = null;
    void sync();
  };
  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, SYNC_DELAY_MS);
  }
  return {
    sync,
    changed: schedule,
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      fire();
    },
  };
}
