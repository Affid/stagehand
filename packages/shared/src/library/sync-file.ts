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

const SyncFileSchema = Head.extend({
  savedAt: z.string().max(100),
  library: LibrarySchema.refine(withinLimits),
  sorted: z.array(IdSchema).max(MAX_SYNC_MODULES).nullable(),
});

export type SyncFileError = "too-big" | "not-json" | "invalid" | "newer";

export type SyncFileRead =
  | { readonly ok: true; readonly side: SyncSide }
  | { readonly ok: false; readonly error: SyncFileError };

export function serializeSyncFile(side: SyncSide, savedAt: string): string {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    savedAt,
    library: side.library,
    sorted: side.sorted,
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
  const library = repairReferences({ ...file.data.library, serverId });
  return { ok: true, side: { library, sorted: file.data.sorted } };
}
