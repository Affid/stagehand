// Keeps a merged or downloaded library valid the way the library's own
// operations keep it (ops.ts): one item per id, tag names unique (ignoring
// case), folders two levels deep at most and without loops, no module in a
// missing folder or with a missing tag, no repeated ids in a list.
import {
  type Folder,
  type Library,
  MAX_NAME,
  type ModuleMeta,
  type Tag,
} from "./schema.ts";

/** The first item of each id; a hand-edited file may repeat one. */
const uniqueIds = <T extends { readonly id: string }>(list: readonly T[]) => {
  const seen = new Set<string>();
  return list.filter((e) => !seen.has(e.id) && Boolean(seen.add(e.id)));
};

const unique = (list: readonly string[]): string[] => [...new Set(list)];

/**
 * A folder may sit only under a top-level folder (MAX_FOLDER_DEPTH 2 in
 * ops.ts), which also rules out loops. Folders are handled in order and a
 * parent is only ever cleared, so a checked folder stays valid.
 */
function repairFolders(folders: readonly Folder[]): Folder[] {
  const parents = new Map(folders.map((f) => [f.id, f.parentId]));
  const valid = (f: Folder): boolean => {
    if (f.parentId === null) return true;
    if (f.parentId === f.id || !parents.has(f.parentId)) return false;
    return parents.get(f.parentId) === null;
  };
  const repaired = folders.map((f) => {
    if (valid(f)) return f;
    parents.set(f.id, null);
    return { ...f, parentId: null };
  });
  return repaired.map((f, order) => (f.order === order ? f : { ...f, order }));
}

/** "Combat", "Combat 2", ...: two devices may each have made one. */
function uniqueTagNames(tags: readonly Tag[]): Tag[] {
  const taken = new Set<string>();
  return tags.map((tag) => {
    let name = tag.name;
    for (let n = 2; taken.has(name.toLowerCase()); n++) {
      const suffix = ` ${String(n)}`;
      name = `${tag.name.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    }
    taken.add(name.toLowerCase());
    return name === tag.name ? tag : { ...tag, name };
  });
}

function repairMeta(
  meta: ModuleMeta,
  folders: ReadonlySet<string>,
  tags: ReadonlySet<string>,
): ModuleMeta {
  const folderId =
    meta.folderId !== null && folders.has(meta.folderId) ? meta.folderId : null;
  const kept = unique(meta.tags.filter((t) => tags.has(t)));
  return folderId === meta.folderId && kept.length === meta.tags.length
    ? meta
    : { ...meta, folderId, tags: kept };
}

function repairViews(views: Library["views"], tags: ReadonlySet<string>) {
  return uniqueIds(views).map((v) => {
    const kept = unique(v.filter.tags.filter((t) => tags.has(t)));
    return kept.length === v.filter.tags.length
      ? v
      : { ...v, filter: { ...v.filter, tags: kept } };
  });
}

export function repairReferences(library: Library): Library {
  const folders = repairFolders(uniqueIds(library.folders));
  const tags = uniqueTagNames(uniqueIds(library.tags));
  const folderIds = new Set(folders.map((f) => f.id));
  const tagIds = new Set(tags.map((t) => t.id));
  const modules = Object.fromEntries(
    Object.entries(library.modules).map(([id, meta]) => [
      id,
      repairMeta(meta, folderIds, tagIds),
    ]),
  );
  const presets = uniqueIds(library.presets).map((p) =>
    new Set(p.modules).size === p.modules.length
      ? p
      : { ...p, modules: unique(p.modules) },
  );
  const views = repairViews(library.views, tagIds);
  return { ...library, folders, tags, presets, modules, views };
}
