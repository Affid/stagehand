// The library file Setup keeps in the server's Data folder (library sync).
// Anyone with Foundry's upload permission can overwrite it, so a read is
// untrusted: size-capped, validated, references repaired.
import { z } from "zod";
import { repairReferences } from "./integrity.ts";
import type { SyncSide } from "./merge.ts";
import { IdSchema, LibrarySchema } from "./schema.ts";

export const SYNC_FOLDER = "stagehand";
export const SYNC_FILE = "library.json";
export const SYNC_FILE_PATH = `${SYNC_FOLDER}/${SYNC_FILE}`;

/** Far above a library of every listed package with full notes. */
export const MAX_SYNC_FILE_CHARS = 8_000_000;

const FORMAT = "stagehand-library";
const VERSION = 1;

const Head = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().positive(),
});

/** Counts far above a real library (thousands of packages, a few hundred folders). */
export const MAX_SYNC_ITEMS = 5_000;
export const MAX_SYNC_MODULES = 50_000;

const withinLimits = (l: z.infer<typeof LibrarySchema>): boolean =>
  [l.folders, l.tags, l.presets, l.views].every(
    (list) => list.length <= MAX_SYNC_ITEMS,
  ) &&
  Object.keys(l.modules).length <= MAX_SYNC_MODULES &&
  l.presets.every((p) => p.modules.length <= MAX_SYNC_MODULES) &&
  Object.values(l.modules).every((m) => m.tags.length <= MAX_SYNC_ITEMS);

/** Ancestors a file remembers: far more saves than happen between two syncs. */
export const MAX_HISTORY = 50;
const FileId = z.string().min(1).max(64);

const SyncFileSchema = Head.extend({
  id: FileId,
  history: z.array(FileId).max(MAX_HISTORY),
  savedAt: z.string().max(100),
  library: LibrarySchema.refine(withinLimits),
  sorted: z.array(IdSchema).max(MAX_SYNC_MODULES).nullable(),
});

export type SyncFileError = "too-big" | "not-json" | "invalid" | "newer";

/**
 * One save of the file: what it holds, a fresh id, and the ids of the saves
 * it was merged from (oldest first). A device merges three-way only against
 * a copy in that line; any other copy (a replaced file, two devices saving
 * at once) is merged as a union, so nothing is deleted by mistake.
 */
export interface SyncFile {
  readonly side: SyncSide;
  readonly id: string;
  readonly history: readonly string[];
}

export type SyncFileRead =
  | { readonly ok: true; readonly file: SyncFile }
  | { readonly ok: false; readonly error: SyncFileError };

/** The next save after `previous` (none: a new line of saves). */
export const nextSyncFile = (
  side: SyncSide,
  id: string,
  previous: SyncFile | null,
): SyncFile => ({
  side,
  id,
  history: previous
    ? [...previous.history, previous.id].slice(-MAX_HISTORY)
    : [],
});

/** `file` is the save `id`, or was merged from it. */
export const descendsFrom = (file: SyncFile, id: string): boolean =>
  file.id === id || file.history.includes(id);

export function serializeSyncFile(file: SyncFile, savedAt: string): string {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    id: file.id,
    history: file.history,
    savedAt,
    library: file.side.library,
    sorted: file.side.sorted,
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function parseSyncFile(text: string, serverId: string): SyncFileRead {
  if (text.length > MAX_SYNC_FILE_CHARS) return { ok: false, error: "too-big" };
  const json = parseJson(text);
  if (json === undefined) return { ok: false, error: "not-json" };
  const head = Head.safeParse(json);
  if (!head.success) return { ok: false, error: "invalid" };
  if (head.data.version > VERSION) return { ok: false, error: "newer" };
  const file = SyncFileSchema.safeParse(json);
  if (!file.success) return { ok: false, error: "invalid" };
  const { id, history, sorted } = file.data;
  const library = repairReferences({ ...file.data.library, serverId });
  return { ok: true, file: { side: { library, sorted }, id, history } };
}
