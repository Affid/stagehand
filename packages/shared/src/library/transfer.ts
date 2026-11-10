// Export and import of the whole library (D-1) and of single presets (P-7)
// as versioned JSON. Imported files are untrusted: always validated.
import { z } from "zod";
import {
  type Library,
  LibrarySchema,
  type Preset,
  PresetSchema,
} from "./schema.ts";

const FORMAT = "stagehand";
const FORMAT_VERSION = 1;

const Header = z.object({
  format: z.literal(FORMAT),
  kind: z.enum(["library", "preset"]),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string(),
});

const LibraryFile = Header.extend({
  kind: z.literal("library"),
  library: LibrarySchema,
});

const SharedPreset = PresetSchema.pick({
  name: true,
  description: true,
  modules: true,
});
const PresetFile = Header.extend({
  kind: z.literal("preset"),
  preset: SharedPreset,
});

export type SharedPreset = z.infer<typeof SharedPreset>;

export type ImportResult<T> =
  ({ readonly ok: true } & T) | { readonly ok: false; readonly error: string };

const header = (kind: "library" | "preset", exportedAt: string) => ({
  format: FORMAT,
  kind,
  formatVersion: FORMAT_VERSION,
  exportedAt,
});

/**
 * Makes every imported folder, tag and preset newer than any copy an open
 * editor may hold, so a stale save after an import is a conflict (D-2).
 */
export function rebaseRevisions(current: Library, imported: Library): Library {
  const bump = <T extends { id: string; revision: number }>(
    mine: readonly T[],
    theirs: readonly T[],
  ): T[] =>
    theirs.map((e) => ({
      ...e,
      revision:
        Math.max(e.revision, mine.find((m) => m.id === e.id)?.revision ?? 0) +
        1,
    }));
  return {
    ...imported,
    folders: bump(current.folders, imported.folders),
    tags: bump(current.tags, imported.tags),
    presets: bump(current.presets, imported.presets),
  };
}

export const exportLibrary = (library: Library, exportedAt: string): string =>
  JSON.stringify({ ...header("library", exportedAt), library }, null, 2);

export const exportPreset = (preset: Preset, exportedAt: string): string =>
  JSON.stringify(
    {
      ...header("preset", exportedAt),
      preset: {
        name: preset.name,
        description: preset.description,
        modules: preset.modules,
      },
    },
    null,
    2,
  );

function parseFile<S extends z.ZodType>(
  text: string,
  schema: S,
): ImportResult<{ data: z.infer<S> }> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  const head = Header.safeParse(json);
  if (!head.success)
    return { ok: false, error: "The file is not a Stagehand export." };
  if (head.data.formatVersion > FORMAT_VERSION)
    return {
      ok: false,
      error: "The file comes from a newer version of Stagehand.",
    };
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return { ok: false, error: `The file is damaged: ${parsed.error.message}` };
  return { ok: true, data: parsed.data };
}

export function parseLibraryImport(
  text: string,
  serverId: string,
): ImportResult<{ library: Library }> {
  const result = parseFile(text, LibraryFile);
  if (!result.ok) return result;
  return { ok: true, library: { ...result.data.library, serverId } };
}

export function parsePresetImport(
  text: string,
): ImportResult<{ preset: SharedPreset }> {
  const result = parseFile(text, PresetFile);
  if (!result.ok) return result;
  return { ok: true, preset: result.data.preset };
}
