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
import type {
  Command,
  SetupData,
  Snapshot,
} from "@module-library/shared/world";
import type { SerializedKeyValue } from "./kv.ts";
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

const key = (kind: string, server: ServerId): string => `${kind}:${server}`;

export type ServerState = ReturnType<typeof createState>;

export function createState(kv: SerializedKeyValue) {
  const read = async <T>(k: string, fallback: T): Promise<T> =>
    (await kv.get<T>(k)) ?? fallback;
  return {
    servers: () => read<Servers>("servers", {}),
    async addServer(id: ServerId, at: string): Promise<void> {
      await kv.update<Servers>("servers", {}, (s) => ({
        ...s,
        [id]: s[id] ?? { id, addedAt: at },
      }));
    },
    async markAdminVerified(id: ServerId, at: string): Promise<void> {
      await kv.update<Servers>("servers", {}, (s) => {
        const current = s[id];
        return current
          ? { ...s, [id]: { ...current, adminVerifiedAt: at } }
          : s;
      });
    },
    library: (id: ServerId) => read(key("library", id), emptyLibrary(id)),
    applyLibraryOp(id: ServerId, op: LibraryOp): Promise<OpResult> {
      return kv.update<Library, OpResult>(
        key("library", id),
        emptyLibrary(id),
        (lib) => {
          const result = applyOp(lib, op);
          return { value: result.ok ? result.library : lib, result };
        },
      );
    },
    /** Import (D-1): replaces the library, newer than any open editor's copy. */
    replaceLibrary(id: ServerId, next: Library): Promise<Library> {
      return kv.update<Library>(
        key("library", id),
        emptyLibrary(id),
        (lib) => ({
          ...next,
          serverId: id,
          revision: Math.max(lib.revision, next.revision) + 1,
        }),
      );
    },
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
        (all) => ({
          ...all,
          [snap.worldId]: snap,
        }),
      );
    },
    commands: (id: ServerId) => read<Command[]>(key("commands", id), []),
    updateCommands<R = Command[]>(
      id: ServerId,
      fn: (list: Command[]) => Command[] | { value: Command[]; result: R },
    ): Promise<R> {
      return kv.update<Command[], R>(key("commands", id), [], fn);
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
