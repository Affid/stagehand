// Per-server state in extension storage, namespaced by server id (PRD 6).
// The library is the source of truth here; all writes are serialised.
import {
  applyOp,
  type LibraryOp,
  type OpResult,
} from "@module-library/shared/library/ops";
import {
  emptyLibrary,
  type Library,
} from "@module-library/shared/library/schema";
import { rebaseRevisions } from "@module-library/shared/library/transfer";
import {
  type Command,
  MAX_PACKAGES,
  type SetupData,
  type Snapshot,
} from "@module-library/shared/world";
import { type SerializedKeyValue, type Updated, withResult } from "./kv.ts";
import type { ServerId } from "./servers.ts";

export interface ServerRecord {
  readonly id: ServerId;
  readonly addedAt: string;
  readonly adminVerifiedAt?: string;
  /** The owner's name for it on the app's home; its address otherwise. */
  readonly name?: string;
  /** When its Setup last reported to this browser. */
  readonly openedAt?: string;
}

export interface StoredSetup extends SetupData {
  readonly seenAt: string;
}

type Servers = Readonly<Record<ServerId, ServerRecord>>;

/** Snapshots kept per server; a page can't fill storage with fake worlds. */
export const MAX_WORLDS = 200;

function keepNewest(all: Record<string, Snapshot>): Record<string, Snapshot> {
  const entries = Object.entries(all);
  if (entries.length <= MAX_WORLDS) return all;
  const newest = entries
    .sort(([, a], [, b]) => b.takenAt.localeCompare(a.takenAt))
    .slice(0, MAX_WORLDS);
  return Object.fromEntries(newest);
}

const key = (kind: string, server: ServerId): string => `${kind}:${server}`;

const reader =
  (kv: SerializedKeyValue) =>
  async <T>(k: string, fallback: T): Promise<T> =>
    (await kv.get<T>(k)) ?? fallback;

/**
 * A server's data that goes along to its new address,
 * and what the new address holds when the server had none: data a removed
 * server left there never comes back to life (security review).
 */
const MOVED_KINDS: Readonly<Record<string, (to: ServerId) => unknown>> = {
  library: (to) => emptyLibrary(to),
  commands: () => [],
  "news-seen": () => null,
  setup: () => null,
  snapshots: () => ({}),
  sorted: () => null,
};

async function copyKey(
  kv: SerializedKeyValue,
  kind: string,
  from: ServerId,
  to: ServerId,
): Promise<void> {
  const value = await kv.get<unknown>(key(kind, from));
  const empty = MOVED_KINDS[kind]?.(to) ?? null;
  const copied =
    value === undefined || value === null
      ? empty
      : kind === "library"
        ? { ...(value as Library), serverId: to }
        : value;
  await kv.update<unknown>(key(kind, to), null, () => copied);
}

type ServerEdit = (r: ServerRecord) => ServerRecord;

/** A record without one optional field. */
const without = (
  r: ServerRecord,
  field: "adminVerifiedAt" | "name",
): ServerRecord =>
  Object.fromEntries(
    Object.entries(r).filter(([k]) => k !== field),
  ) as unknown as ServerRecord;

const serversUpdate =
  (kv: SerializedKeyValue) =>
  (fn: (s: Servers) => Servers): Promise<Servers> =>
    kv.update<Servers>("servers", {}, fn);

/** Changes a saved server's record; an unknown server stays unknown. */
const serverEdit =
  (kv: SerializedKeyValue) =>
  async (id: ServerId, edit: ServerEdit): Promise<void> => {
    await serversUpdate(kv)((s) => {
      const current = s[id];
      return current ? { ...s, [id]: edit(current) } : s;
    });
  };

/** Registered servers and their admin verification (R-1, PR-1). */
function serverStore(kv: SerializedKeyValue) {
  const update = serversUpdate(kv);
  const edit = serverEdit(kv);
  return {
    servers: () => reader(kv)<Servers>("servers", {}),
    async addServer(id: ServerId, at: string): Promise<void> {
      await update((s) => ({ ...s, [id]: s[id] ?? { id, addedAt: at } }));
    },
    markAdminVerified: (id: ServerId, at: string): Promise<void> =>
      edit(id, (r) => ({ ...r, adminVerifiedAt: at })),
    /** Taken off this browser; its library stays, for when it comes back. */
    async removeServer(id: ServerId): Promise<void> {
      await update((s) =>
        Object.fromEntries(Object.entries(s).filter(([k]) => k !== id)),
      );
    },
    /** Setup said this browser is no longer the admin (security review). */
    revokeAdmin: (id: ServerId): Promise<void> =>
      edit(id, (r) => (r.adminVerifiedAt ? without(r, "adminVerifiedAt") : r)),
    ...serverEdits(kv),
  };
}

/** What the app's home changes: a server's name and address (phase 6). */
function serverEdits(kv: SerializedKeyValue) {
  const edit = serverEdit(kv);
  return {
    /** An empty name goes back to showing the address. */
    renameServer: (id: ServerId, name: string): Promise<void> =>
      edit(id, (r) => (name ? { ...r, name } : without(r, "name"))),
    markOpened: (id: ServerId, at: string): Promise<void> =>
      edit(id, (r) => ({ ...r, openedAt: at })),
    /**
     * The server at a new address: its record (name and dates kept, admin
     * verification not: the new address proves it again) and its data.
     */
    async moveServer(from: ServerId, to: ServerId): Promise<void> {
      for (const kind of Object.keys(MOVED_KINDS))
        await copyKey(kv, kind, from, to);
      await serversUpdate(kv)((s) => {
        const current = s[from];
        if (!current) return s;
        return {
          ...s,
          [to]: { ...without(current, "adminVerifiedAt"), id: to },
        };
      });
    },
  };
}

/** The library: the source of truth for folders, tags, notes, presets. */
function libraryStore(kv: SerializedKeyValue) {
  return {
    library: (id: ServerId) => reader(kv)(key("library", id), emptyLibrary(id)),
    applyLibraryOp(id: ServerId, op: LibraryOp): Promise<OpResult> {
      return kv.update<Library, OpResult>(
        key("library", id),
        emptyLibrary(id),
        (lib) => {
          const result = applyOp(lib, op);
          return withResult(result.ok ? result.library : lib, result);
        },
      );
    },
    /** Import (D-1): replaces the library, newer than any open editor's copy. */
    replaceLibrary(id: ServerId, next: Library): Promise<Library> {
      return kv.update<Library>(
        key("library", id),
        emptyLibrary(id),
        (lib) => ({
          ...rebaseRevisions(lib, next),
          serverId: id,
          revision: Math.max(lib.revision, next.revision) + 1,
        }),
      );
    },
  };
}

/** What the worlds report: Setup data and the companions' snapshots. */
function worldStore(kv: SerializedKeyValue) {
  const read = reader(kv);
  return {
    /** None: never seen, or cleared by a move (null). */
    setup: async (id: ServerId): Promise<StoredSetup | undefined> =>
      (await kv.get<StoredSetup | null>(key("setup", id))) ?? undefined,
    async putSetup(id: ServerId, data: SetupData, at: string): Promise<void> {
      await kv.update<StoredSetup | null>(key("setup", id), null, () => ({
        ...data,
        seenAt: at,
      }));
    },
    snapshots: (id: ServerId) =>
      read<Record<string, Snapshot>>(key("snapshots", id), {}),
    async putSnapshot(id: ServerId, snap: Snapshot): Promise<void> {
      await kv.update<Record<string, Snapshot>>(
        key("snapshots", id),
        {},
        (all) => keepNewest({ ...all, [snap.worldId]: snap }),
      );
    },
  };
}

/** Modules already sorted; the first Setup visit counts all as sorted. */
function intakeStore(kv: SerializedKeyValue) {
  const k = (id: ServerId): string => key("sorted", id);
  return {
    sortedModules: (id: ServerId) => kv.get<string[]>(k(id)),
    async seedSorted(id: ServerId, ids: readonly string[]): Promise<void> {
      await kv.update<string[] | null>(
        k(id),
        null,
        (cur) => cur ?? ids.slice(0, MAX_PACKAGES),
      );
    },
    async markSorted(id: ServerId, ids: readonly string[]): Promise<void> {
      await kv.update<string[]>(k(id), [], (cur) =>
        [...new Set([...cur, ...ids])].slice(-MAX_PACKAGES),
      );
    },
  };
}

/** News articles remembered as seen; Foundry lists a handful at a time. */
export const MAX_NEWS_SEEN = 200;

/** News read state: the first Setup visit with news counts all as seen. */
function newsStore(kv: SerializedKeyValue) {
  const k = (id: ServerId): string => key("news-seen", id);
  return {
    newsSeen: (id: ServerId) => kv.get<string[]>(k(id)),
    async seedNews(id: ServerId, urls: readonly string[]): Promise<void> {
      if (urls.length === 0) return;
      await kv.update<string[] | null>(k(id), null, (cur) => cur ?? [...urls]);
    },
    async markNewsSeen(id: ServerId, urls: readonly string[]): Promise<void> {
      await kv.update<string[]>(k(id), [], (cur) =>
        [...new Set([...cur, ...urls])].slice(-MAX_NEWS_SEEN),
      );
    },
  };
}

/** The command queue (P-5): this browser's view and history of changes. */
function commandStore(kv: SerializedKeyValue) {
  return {
    commands: (id: ServerId) => reader(kv)<Command[]>(key("commands", id), []),
    updateCommands<R = Command[]>(
      id: ServerId,
      fn: (list: Command[]) => Updated<Command[], R>,
    ): Promise<R> {
      return kv.update<Command[], R>(key("commands", id), [], fn);
    },
  };
}

export type ServerState = ReturnType<typeof createState>;

export function createState(kv: SerializedKeyValue) {
  return {
    ...serverStore(kv),
    ...libraryStore(kv),
    ...worldStore(kv),
    ...commandStore(kv),
    ...intakeStore(kv),
    ...newsStore(kv),
  };
}
