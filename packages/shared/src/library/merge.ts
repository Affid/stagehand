// Library sync: merges this device's library with the server's copy, against
// the server copy this device saw last (docs/LIBRARY-SYNC-PLAN.md, "Merge").
// Nothing is lost silently: a clash keeps this device's value or both texts,
// an edit beats a delete, and each clash is reported for a notice. Lists
// follow the server's order, so two devices converge instead of re-saving.
import { repairReferences } from "./integrity.ts";
import {
  type ClashReason,
  type FieldKinds,
  mergeItem,
  sameContent,
  sameJson,
} from "./merge-fields.ts";
import type { Folder, Library, ModuleMeta } from "./schema.ts";

export type { ClashReason } from "./merge-fields.ts";

/** What one side holds: the library and the modules counted as sorted. */
export interface SyncSide {
  readonly library: Library;
  /** Null until a first admin Setup visit seeds it. */
  readonly sorted: readonly string[] | null;
}

export interface MergeInput {
  /** The server copy this device saw last; null on a first sync. */
  readonly base: SyncSide | null;
  readonly local: SyncSide;
  readonly server: SyncSide;
}

export type ClashKind = "folder" | "tag" | "preset" | "view" | "module";

export interface Clash {
  readonly kind: ClashKind;
  readonly id: string;
  readonly name: string;
  readonly reason: ClashReason;
}

export interface MergeResult {
  readonly library: Library;
  readonly sorted: string[] | null;
  readonly clashes: readonly Clash[];
  /** This device must store the result. */
  readonly changedLocal: boolean;
  /** The server must get the result. */
  readonly changedServer: boolean;
}

interface Item {
  readonly id: string;
  readonly name?: string;
}

interface Lists<T> {
  readonly base: readonly T[] | undefined;
  readonly local: readonly T[];
  readonly server: readonly T[];
}

interface Merged<T> {
  readonly items: T[];
  readonly clashes: Clash[];
}

/** Items by id; a repeated id keeps its first item, as the repair does. */
const byId = <T extends { readonly id: string }>(
  list: readonly T[] | undefined,
): ReadonlyMap<string, T> => {
  const map = new Map<string, T>();
  for (const e of list ?? []) if (!map.has(e.id)) map.set(e.id, e);
  return map;
};

function mergeList<T extends Item>(
  kind: ClashKind,
  lists: Lists<T>,
  kinds?: FieldKinds<T>,
): Merged<T> {
  const base = byId(lists.base);
  const local = byId(lists.local);
  const server = byId(lists.server);
  const ids = new Set([...server.keys(), ...local.keys()]);
  const outcomes = [...ids].map((id) =>
    mergeItem(base.get(id), local.get(id), server.get(id), kinds),
  );
  const items = outcomes.flatMap((o) => (o.value ? [o.value] : []));
  const clashes = outcomes.flatMap((o) =>
    o.value && o.clash
      ? [
          {
            kind,
            id: o.value.id,
            name: o.value.name ?? o.value.id,
            reason: o.clash,
          },
        ]
      : [],
  );
  return { items, clashes };
}

type Modules = Library["modules"];
type MetaItem = ModuleMeta & Item;

const metaItems = (modules: Modules): MetaItem[] =>
  Object.entries(modules).map(([id, m]) => ({ ...m, id }));

function mergeModules(
  base: Modules | undefined,
  local: Modules,
  server: Modules,
) {
  const merged = mergeList<MetaItem>(
    "module",
    {
      base: base && metaItems(base),
      local: metaItems(local),
      server: metaItems(server),
    },
    { tags: "set", note: "text" },
  );
  const modules: Modules = Object.fromEntries(
    merged.items.map(({ id, ...meta }) => [id, meta]),
  );
  return { modules, clashes: merged.clashes };
}

/** Folders in their merged order; equal orders by id, the same on every device. */
function mergeFolders(lists: Lists<Folder>): Merged<Folder> {
  const merged = mergeList("folder", lists, {
    order: "quiet",
    collapsed: "quiet",
  });
  const items = [...merged.items].sort(
    (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return { items, clashes: merged.clashes };
}

interface Revisioned {
  readonly id: string;
  readonly revision: number;
}

/**
 * An item unchanged here keeps this device's revision; a changed one gets a
 * revision newer than both copies, so an editor's stale save is a conflict.
 */
function withRevisions<T extends Revisioned>(
  merged: readonly T[],
  local: readonly T[],
  server: readonly T[],
): T[] {
  const mine = byId(local);
  const theirs = byId(server);
  return merged.map((item) => {
    const before = mine.get(item.id);
    // New here: no editor on this device can hold a stale copy.
    if (!before) return item;
    if (sameContent(item, before))
      return { ...item, revision: before.revision };
    const other = theirs.get(item.id)?.revision ?? 0;
    return { ...item, revision: Math.max(before.revision, other) + 1 };
  });
}

/** Two libraries hold the same things, whatever their bookkeeping. */
function sameLibrary(a: Library, b: Library): boolean {
  const strip = (l: Library) => ({
    folders: l.folders.map(({ revision: _r, ...f }) => f),
    tags: l.tags.map(({ revision: _r, ...t }) => t),
    presets: l.presets.map(({ revision: _r, ...p }) => p),
    views: l.views,
    modules: l.modules,
  });
  return sameJson(strip(a), strip(b));
}

function mergeContent({ base, local, server }: MergeInput) {
  const b = base?.library;
  const l = local.library;
  const s = server.library;
  const pick = <K extends "folders" | "tags" | "presets" | "views">(
    key: K,
  ) => ({
    base: b?.[key],
    local: l[key],
    server: s[key],
  });
  const folders = mergeFolders(pick("folders"));
  const tags = mergeList("tag", pick("tags"));
  const presets = mergeList("preset", pick("presets"), {
    modules: "set",
    description: "text",
  });
  const views = mergeList("view", pick("views"));
  const modules = mergeModules(b?.modules, l.modules, s.modules);
  const library: Library = {
    ...l,
    folders: folders.items,
    tags: tags.items,
    presets: presets.items,
    views: views.items,
    modules: modules.modules,
  };
  const all = [folders, tags, presets, views, modules];
  return { library, clashes: all.flatMap((m) => m.clashes) };
}

function mergeSorted(
  local: readonly string[] | null,
  server: readonly string[] | null,
): string[] | null {
  if (local === null && server === null) return null;
  return [...new Set([...(server ?? []), ...(local ?? [])])];
}

function sameSet(a: readonly string[] | null, b: readonly string[] | null) {
  if (a === null || b === null) return a === b;
  const sb = new Set(b);
  return new Set(a).size === sb.size && a.every((e) => sb.has(e));
}

export function mergeLibraries(input: MergeInput): MergeResult {
  const { local, server } = input;
  const merged = mergeContent(input);
  const repaired = repairReferences(merged.library);
  const l = local.library;
  const s = server.library;
  const content: Library = {
    ...repaired,
    folders: withRevisions(repaired.folders, l.folders, s.folders),
    tags: withRevisions(repaired.tags, l.tags, s.tags),
    presets: withRevisions(repaired.presets, l.presets, s.presets),
  };
  const libraryChanged = !sameLibrary(content, l);
  const revision = libraryChanged
    ? Math.max(l.revision, s.revision) + 1
    : l.revision;
  const library: Library = { ...content, revision };
  const sorted = mergeSorted(local.sorted, server.sorted);
  return {
    library,
    sorted,
    clashes: merged.clashes,
    changedLocal: libraryChanged || !sameSet(sorted, local.sorted),
    changedServer: !sameLibrary(library, s) || !sameSet(sorted, server.sorted),
  };
}
