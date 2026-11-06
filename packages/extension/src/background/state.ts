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
import type {
  Command,
  SetupData,
  Snapshot,
} from "@module-library/shared/world";
import { DEFAULT_PREFS, type Prefs } from "../messages.ts";
import { type SerializedKeyValue, type Updated, withResult } from "./kv.ts";
import type { ServerId } from "./servers.ts";

export interface ServerRecord {
  readonly id: ServerId;
  readonly addedAt: string;
  readonly adminVerifiedAt?: string;
}

/** The last handshake per world: shows "companion outdated" (8.7). */
export interface HelloRecord {
  readonly worldId: string;
  readonly moduleVersion: string;
  readonly protocol: number | null;
  readonly at: string;
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

/** Registered servers and their admin verification (R-1, PR-1). */
function serverStore(kv: SerializedKeyValue) {
  const update = (fn: (s: Servers) => Servers): Promise<Servers> =>
    kv.update<Servers>("servers", {}, fn);
  return {
    servers: () => reader(kv)<Servers>("servers", {}),
    async addServer(id: ServerId, at: string): Promise<void> {
      await update((s) => ({ ...s, [id]: s[id] ?? { id, addedAt: at } }));
    },
    async markAdminVerified(id: ServerId, at: string): Promise<void> {
      await update((s) => {
        const current = s[id];
        return current
          ? { ...s, [id]: { ...current, adminVerifiedAt: at } }
          : s;
      });
    },
    prefs: async (id: ServerId): Promise<Prefs> => ({
      ...DEFAULT_PREFS,
      ...(await reader(kv)<Partial<Prefs>>(key("prefs", id), {})),
    }),
    async setPref(
      id: ServerId,
      name: keyof Prefs,
      value: boolean,
    ): Promise<void> {
      await kv.update<Partial<Prefs>>(key("prefs", id), {}, (p) => ({
        ...p,
        [name]: value,
      }));
    },
    /** Setup said this browser is no longer the admin (security review). */
    async revokeAdmin(id: ServerId): Promise<void> {
      await update((s) => {
        const current = s[id];
        if (!current?.adminVerifiedAt) return s;
        return { ...s, [id]: { id: current.id, addedAt: current.addedAt } };
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

/** What the worlds report: Setup data, snapshots, handshakes. */
function worldStore(kv: SerializedKeyValue) {
  const read = reader(kv);
  return {
    setup: (id: ServerId) => kv.get<StoredSetup>(key("setup", id)),
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
    hellos: (id: ServerId) =>
      read<Record<string, HelloRecord>>(key("hello", id), {}),
    async putHello(id: ServerId, hello: HelloRecord): Promise<void> {
      await kv.update<Record<string, HelloRecord>>(
        key("hello", id),
        {},
        (all) => ({
          ...all,
          [hello.worldId]: hello,
        }),
      );
    },
  };
}

/** Worlds whose next launch skips the queue; more is a bug, not a use. */
const MAX_HOLDS = 200;

/** The command queue (P-5), and launches that skip it once. */
function commandStore(kv: SerializedKeyValue) {
  const holdKey = (id: ServerId): string => key("launchHolds", id);
  return {
    launchHolds: (id: ServerId) => reader(kv)<string[]>(holdKey(id), []),
    async setLaunchHold(
      id: ServerId,
      worldId: string,
      hold: boolean,
    ): Promise<void> {
      await kv.update<string[]>(holdKey(id), [], (list) => {
        const others = list.filter((w) => w !== worldId);
        return hold ? [...others, worldId].slice(-MAX_HOLDS) : others;
      });
    },
    /** True once if the world's launch was held; the hold is used up. */
    takeLaunchHold(id: ServerId, worldId: string): Promise<boolean> {
      return kv.update<string[], boolean>(holdKey(id), [], (list) =>
        withResult(
          list.filter((w) => w !== worldId),
          list.includes(worldId),
        ),
      );
    },
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
  };
}
