// The extension's storage, namespaced per server.
// Spike: plain read-modify-write. The real store serialises writes.
import type { Command } from "./commands.ts";
import type { SetupData } from "./messages.ts";
import type { ServerId } from "./servers.ts";

export interface ServerRecord {
  readonly id: ServerId;
  readonly adminVerifiedAt?: string;
}

export interface WorldSnapshot {
  readonly worldId: string;
  readonly title: string;
  readonly system: { readonly id: string; readonly version: string };
  readonly coreVersion: string;
  readonly active: readonly { readonly id: string; readonly version: string }[];
  readonly companionVersion: string;
  readonly takenAt: string;
}

const SERVERS = "servers";
const setupKey = (s: ServerId): string => `setup:${s}`;
const snapshotsKey = (s: ServerId): string => `snapshots:${s}`;
const commandsKey = (s: ServerId): string => `commands:${s}`;

async function read<T>(key: string, fallback: T): Promise<T> {
  const items = await chrome.storage.local.get(key);
  return (items[key] as T | undefined) ?? fallback;
}

const write = (key: string, value: unknown): Promise<void> =>
  chrome.storage.local.set({ [key]: value });

export const getServers = (): Promise<
  Readonly<Record<ServerId, ServerRecord>>
> => read(SERVERS, {});

export async function putServer(record: ServerRecord): Promise<void> {
  const servers = await getServers();
  await write(SERVERS, { ...servers, [record.id]: record });
}

export const putSetupData = (s: ServerId, data: SetupData): Promise<void> =>
  write(setupKey(s), { ...data, seenAt: new Date().toISOString() });

export const getSnapshots = (
  s: ServerId,
): Promise<Readonly<Record<string, WorldSnapshot>>> =>
  read(snapshotsKey(s), {});

export async function putSnapshot(
  s: ServerId,
  snapshot: WorldSnapshot,
): Promise<void> {
  const all = await getSnapshots(s);
  await write(snapshotsKey(s), { ...all, [snapshot.worldId]: snapshot });
}

export const getCommands = (s: ServerId): Promise<readonly Command[]> =>
  read(commandsKey(s), []);

export const putCommands = (
  s: ServerId,
  commands: readonly Command[],
): Promise<void> => write(commandsKey(s), commands);
