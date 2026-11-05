// View model for the organised module list (S-1, S-3, S-4, S-7, G-*).
import type { Folder, Library } from "@module-library/shared/library/schema";
import type { SmartGroup } from "@module-library/shared/organise/groups";
import type { PackageInfo } from "@module-library/shared/package";

/** What the list shows: everything, one folder (null: unfiled), or a group. */
export type Scope =
  | { readonly kind: "all" }
  | { readonly kind: "folder"; readonly id: string | null }
  | { readonly kind: "group"; readonly key: string };

export interface FolderGroup {
  readonly folder: Folder | null;
  readonly modules: readonly PackageInfo[];
}

const folderOf = (library: Library, id: string): string | null =>
  library.modules[id]?.folderId ?? null;

/** Folders in their order (children after their parent), then unfiled. */
export function orderedFolders(library: Library): Folder[] {
  const byOrder = [...library.folders].sort((a, b) => a.order - b.order);
  const top = byOrder.filter((f) => f.parentId === null);
  return top.flatMap((f) => [f, ...byOrder.filter((c) => c.parentId === f.id)]);
}

export function groupByFolder(
  modules: readonly PackageInfo[],
  library: Library,
): FolderGroup[] {
  const known = new Set(library.folders.map((f) => f.id));
  const groups: FolderGroup[] = orderedFolders(library).map((folder) => ({
    folder,
    modules: modules.filter((m) => folderOf(library, m.id) === folder.id),
  }));
  const unfiled = modules.filter((m) => {
    const f = folderOf(library, m.id);
    return f === null || !known.has(f);
  });
  return [...groups, { folder: null, modules: unfiled }].filter(
    (g) => g.modules.length > 0,
  );
}

export function scopeModules(
  modules: readonly PackageInfo[],
  library: Library,
  scope: Scope,
  groups: readonly SmartGroup[],
): PackageInfo[] {
  if (scope.kind === "all") return [...modules];
  if (scope.kind === "group") {
    const ids = groups.find((g) => g.key === scope.key)?.moduleIds ?? [];
    return modules.filter((m) => ids.includes(m.id));
  }
  return modules.filter((m) => folderOf(library, m.id) === scope.id);
}

export const sortByTitle = (modules: readonly PackageInfo[]): PackageInfo[] =>
  [...modules].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
