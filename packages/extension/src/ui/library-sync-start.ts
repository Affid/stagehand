// Starts library sync on an admin's Setup page: once when the page opens,
// again whenever it becomes visible, soon after each library change, and
// at once when the page is hidden with a change waiting. Clashes and a
// replaced file are told through Foundry's notices.
import type { Clash, ClashReason } from "@stagehand/shared/library/merge";
import type { ExtensionMessage } from "../messages.ts";
import type { Send } from "./actions.ts";
import type { Translate } from "./i18n.ts";
import {
  createLibrarySync,
  type LibrarySync,
  type SyncNotice,
} from "./library-sync.ts";
import type { PageBridge } from "./page.ts";
import type { Store } from "./store.ts";

/** Messages after which the library on the server is out of date. */
const CHANGES: ReadonlySet<ExtensionMessage["kind"]> = new Set([
  "library-op",
  "library-import",
  "modules-sorted",
]);

/** Names in a notice; the rest are counted. */
const MAX_NAMES = 5;

const REASON_KEYS: Readonly<Record<ClashReason, string>> = {
  "kept-this-device": "notice.syncKept",
  "joined-text": "notice.syncJoined",
  "kept-edit": "notice.syncKeptEdit",
};

function names(t: Translate, clashes: readonly Clash[]): string {
  const shown = clashes.slice(0, MAX_NAMES).map((c) => c.name);
  const more = clashes.length - shown.length;
  return more > 0
    ? `${shown.join(", ")} ${t("notice.syncMore", { count: String(more) })}`
    : shown.join(", ");
}

/** One notice per kind of clash, and one for a replaced file. */
export function syncNotices(t: Translate, notice: SyncNotice): string[] {
  const reasons = Object.keys(REASON_KEYS) as ClashReason[];
  const texts = reasons.flatMap((reason) => {
    const of = notice.clashes.filter((c) => c.reason === reason);
    return of.length === 0
      ? []
      : [t(REASON_KEYS[reason], { names: names(t, of) })];
  });
  return notice.repaired ? [t("notice.syncRepaired"), ...texts] : texts;
}

/** `send`, telling sync after each change to the library. */
export function sendNotingChanges(
  send: Send,
  sync: () => LibrarySync | undefined,
): Send {
  return async <T>(m: ExtensionMessage): Promise<T> => {
    const answer = await send<T>(m);
    if (CHANGES.has(m.kind)) sync()?.changed();
    return answer;
  };
}

export interface LibrarySyncStart {
  readonly store: Store;
  readonly page: PageBridge;
  readonly send: Send;
  readonly t: Translate;
  readonly doc: Document;
  readonly refresh: () => Promise<unknown>;
}

export function startLibrarySync(deps: LibrarySyncStart): LibrarySync {
  const sync = createLibrarySync({
    page: deps.page,
    send: deps.send,
    onStatus: (librarySync) => {
      deps.store.set({ librarySync });
    },
    onChangedLocal: deps.refresh,
    onNotice: (notice) => {
      for (const text of syncNotices(deps.t, notice))
        deps.page.notify("info", text);
    },
  });
  deps.doc.addEventListener("visibilitychange", () => {
    if (deps.doc.visibilityState === "visible") void sync.sync();
    else sync.flush();
  });
  return sync;
}
