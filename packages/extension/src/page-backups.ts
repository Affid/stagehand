// A world's backups on the new Setup page (build plan, Phase 4): the UI asks
// with BACKUPS (list, take one, restore one, delete some); the page world
// runs it through Foundry's public calls and dialogs and answers
// BACKUPS_DONE with the world's current backups. Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

export const BACKUP_OPS = ["list", "create", "restore", "delete"] as const;
export type BackupOp = (typeof BACKUP_OPS)[number];

export interface BackupsRequest {
  readonly requestId: string;
  readonly worldId: string;
  readonly op: BackupOp;
  /** One id to restore; up to MAX_DELETE to delete; none otherwise. */
  readonly ids: readonly string[];
}

export interface BackupInfo {
  readonly id: string;
  /** Milliseconds since 1970. */
  readonly createdAt: number;
  /** Bytes. */
  readonly size: number;
  readonly note?: string;
  /** Part of a snapshot: Foundry won't delete it alone. */
  readonly snapshot: boolean;
}

export interface BackupsReply {
  readonly requestId: string;
  readonly backups?: readonly BackupInfo[];
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_ID = 300;
const MAX_DELETE = 50;
const MAX_BACKUPS = 1000;
const MAX_NOTE = 1000;
const MAX_ERROR = 2000;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown, max = MAX_ID): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

function ids(op: BackupOp, v: unknown): readonly string[] | undefined {
  const list = v === undefined ? [] : v;
  if (!Array.isArray(list) || !list.every((x) => isId(x))) return undefined;
  const n = list.length;
  if (op === "restore") return n === 1 ? list : undefined;
  if (op === "delete") return n >= 1 && n <= MAX_DELETE ? list : undefined;
  return n === 0 ? list : undefined;
}

export function parseBackupsRequest(p: Loose): BackupsRequest | undefined {
  const { requestId, worldId, op } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (!isId(worldId, 200)) return undefined;
  if (!(BACKUP_OPS as readonly unknown[]).includes(op)) return undefined;
  const list = ids(op as BackupOp, p.ids);
  return list
    ? { requestId, worldId, op: op as BackupOp, ids: list }
    : undefined;
}

function backup(v: unknown): BackupInfo | undefined {
  if (!isObject(v)) return undefined;
  const { id, createdAt, size, note, snapshot } = v;
  if (!isId(id) || !isCount(createdAt) || !isCount(size)) return undefined;
  if (typeof snapshot !== "boolean") return undefined;
  if (
    note !== undefined &&
    !(typeof note === "string" && note.length <= MAX_NOTE)
  )
    return undefined;
  return { id, createdAt, size, snapshot, ...(note ? { note } : {}) };
}

export function parseBackupsReply(p: Loose): BackupsReply | undefined {
  const { requestId, backups, error } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (
    error !== undefined &&
    !(typeof error === "string" && error.length <= MAX_ERROR)
  )
    return undefined;
  if (backups === undefined)
    return error === undefined ? { requestId } : { requestId, error };
  if (!Array.isArray(backups) || backups.length > MAX_BACKUPS) return undefined;
  const list = backups.map(backup);
  if (list.some((b) => b === undefined)) return undefined;
  return {
    requestId,
    backups: list as BackupInfo[],
    ...(error === undefined ? {} : { error }),
  };
}
