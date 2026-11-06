// The server Backups page (build plan, Phase 5): the UI asks with
// SERVER_BACKUPS (list everything, or take, restore or delete snapshots);
// the page world runs it through Foundry's public calls and dialogs and
// answers SERVER_BACKUPS_DONE with the server's backups. Checked both ways.
import {
  backup,
  type BackupInfo,
  PACKAGE_TYPES,
  type PackageType,
} from "./page-backups.ts";

type Loose = Readonly<Record<string, unknown>>;

export const SERVER_OPS = [
  "list",
  "createSnapshot",
  "restoreSnapshot",
  "deleteSnapshots",
] as const;
export type ServerBackupOp = (typeof SERVER_OPS)[number];

export interface ServerBackupsRequest {
  readonly requestId: string;
  readonly op: ServerBackupOp;
  /** One snapshot to restore; some to delete; none otherwise. */
  readonly ids: readonly string[];
  /** Also ask Foundry for the free disk space (adapter flag diskFree). */
  readonly disk?: boolean;
}

export interface SnapshotInfo {
  readonly id: string;
  readonly createdAt: number;
  readonly size: number;
  readonly note?: string;
  /** The Foundry version it was taken on. */
  readonly generation: number;
  readonly build: number;
  /** How many package backups it holds. */
  readonly count: number;
}

export interface PackageBackups {
  readonly type: PackageType;
  readonly id: string;
  readonly title: string;
  /** False: restoring reinstalls it. */
  readonly installed: boolean;
  readonly backups: readonly BackupInfo[];
}

export interface ServerListing {
  readonly snapshots: readonly SnapshotInfo[];
  readonly packages: readonly PackageBackups[];
  /** Bytes free where Foundry keeps backups, when asked and known. */
  readonly free?: number;
}

export interface ServerBackupsReply {
  readonly requestId: string;
  readonly listing?: ServerListing;
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_ID = 300;
const MAX_TITLE = 300;
const MAX_DELETE = 50;
const MAX_SNAPSHOTS = 500;
const MAX_PACKAGES = 5000;
const MAX_BACKUPS = 1000;
const MAX_NOTE = 1000;
const MAX_ERROR = 2000;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const isRequestId = (v: unknown): v is string =>
  typeof v === "string" && REQUEST_ID.test(v);

function opIds(op: ServerBackupOp, v: unknown): readonly string[] | undefined {
  const list = v ?? [];
  if (!Array.isArray(list) || !list.every((x) => isText(x, MAX_ID)))
    return undefined;
  const n = list.length;
  if (op === "restoreSnapshot") return n === 1 ? list : undefined;
  if (op === "deleteSnapshots")
    return n >= 1 && n <= MAX_DELETE ? list : undefined;
  return n === 0 ? list : undefined;
}

export function parseServerBackupsRequest(
  p: Loose,
): ServerBackupsRequest | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  if (!(SERVER_OPS as readonly unknown[]).includes(p.op)) return undefined;
  const op = p.op as ServerBackupOp;
  const ids = opIds(op, p.ids);
  if (!ids) return undefined;
  return p.disk === true && op === "list"
    ? { requestId: p.requestId, op, ids, disk: true }
    : { requestId: p.requestId, op, ids };
}

function snapshot(v: unknown): SnapshotInfo | undefined {
  if (!isObject(v)) return undefined;
  const { id, createdAt, size, note, generation, build, count } = v;
  if (!isText(id, MAX_ID) || !isCount(createdAt) || !isCount(size))
    return undefined;
  if (!isCount(generation) || !isCount(build) || !isCount(count))
    return undefined;
  if (
    note !== undefined &&
    !(typeof note === "string" && note.length <= MAX_NOTE)
  )
    return undefined;
  return {
    id,
    createdAt,
    size,
    generation,
    build,
    count,
    ...(note ? { note } : {}),
  };
}

function pkg(v: unknown): PackageBackups | undefined {
  if (!isObject(v)) return undefined;
  const { type, id, title, installed, backups } = v;
  if (!(PACKAGE_TYPES as readonly unknown[]).includes(type)) return undefined;
  if (!isText(id, MAX_ID) || !isText(title, MAX_TITLE)) return undefined;
  if (typeof installed !== "boolean" || !Array.isArray(backups))
    return undefined;
  if (backups.length > MAX_BACKUPS) return undefined;
  const list = backups.map(backup);
  if (list.some((b) => b === undefined)) return undefined;
  return {
    type: type as PackageType,
    id,
    title,
    installed,
    backups: list as BackupInfo[],
  };
}

function listing(v: unknown): ServerListing | undefined {
  if (!isObject(v)) return undefined;
  const { snapshots, packages, free } = v;
  if (free !== undefined && !isCount(free)) return undefined;
  if (!Array.isArray(snapshots) || snapshots.length > MAX_SNAPSHOTS)
    return undefined;
  if (!Array.isArray(packages) || packages.length > MAX_PACKAGES)
    return undefined;
  const s = snapshots.map(snapshot);
  const p = packages.map(pkg);
  if (s.some((x) => x === undefined) || p.some((x) => x === undefined))
    return undefined;
  return {
    snapshots: s as SnapshotInfo[],
    packages: p as PackageBackups[],
    ...(free === undefined ? {} : { free }),
  };
}

export function parseServerBackupsReply(
  p: Loose,
): ServerBackupsReply | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  const { error } = p;
  if (
    error !== undefined &&
    !(typeof error === "string" && error.length <= MAX_ERROR)
  )
    return undefined;
  const e = error === undefined ? {} : { error };
  if (p.listing === undefined) return { requestId: p.requestId, ...e };
  const l = listing(p.listing);
  return l ? { requestId: p.requestId, listing: l, ...e } : undefined;
}
