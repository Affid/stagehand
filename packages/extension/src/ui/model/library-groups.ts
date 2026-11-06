// The new Library's groups (SETUP-REDESIGN.md, Library cards and group
// headers): by folder, tag, author or smart group. Pure; titles sorted.
import type { Library } from "@module-library/shared/library/schema";
import type { AuthorEntry } from "@module-library/shared/organise/authors";
import { authorsOf } from "@module-library/shared/organise/authors";
import type { SmartGroup } from "@module-library/shared/organise/groups";
import type { PackageInfo } from "@module-library/shared/package";
import { groupByFolder, sortByTitle } from "./modules.ts";

export type GroupBy = "folder" | "tag" | "author" | "smart";
export const GROUP_BYS: readonly GroupBy[] = [
  "folder",
  "tag",
  "author",
  "smart",
];

export interface LibGroup {
  readonly key: string;
  /** The user's or package's own name, shown as is. */
  readonly name?: string;
  /** Otherwise an i18n key, with its parameter. */
  readonly label?: string;
  readonly param?: string;
  readonly color?: string;
  readonly modules: readonly PackageInfo[];
}

export interface GroupContext {
  readonly library: Library;
  readonly smart: readonly SmartGroup[];
  readonly authors: readonly AuthorEntry[];
}

const byFolder = (mods: readonly PackageInfo[], c: GroupContext): LibGroup[] =>
  groupByFolder(mods, c.library).map((g) =>
    g.folder
      ? {
          key: g.folder.id,
          name: g.folder.name,
          color: g.folder.color,
          modules: g.modules,
        }
      : { key: "unfiled", label: "sidebar.unfiled", modules: g.modules },
  );

function byTag(mods: readonly PackageInfo[], c: GroupContext): LibGroup[] {
  const tagsOf = (id: string): readonly string[] =>
    c.library.modules[id]?.tags ?? [];
  const known = new Set(c.library.tags.map((t) => t.id));
  return [
    ...c.library.tags.map((t) => ({
      key: `tag:${t.id}`,
      name: t.name,
      color: t.color,
      modules: mods.filter((m) => tagsOf(m.id).includes(t.id)),
    })),
    {
      key: "untagged",
      label: "lib.untagged",
      modules: mods.filter((m) => !tagsOf(m.id).some((t) => known.has(t))),
    },
  ];
}

function byAuthor(mods: readonly PackageInfo[], c: GroupContext): LibGroup[] {
  const ids = new Set(mods.map((m) => m.id));
  const named = [...c.authors]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({
      key: `author:${a.key}`,
      name: a.name,
      modules: mods.filter((m) => a.moduleIds.includes(m.id) && ids.has(m.id)),
    }));
  return [
    ...named,
    {
      key: "no-author",
      label: "lib.noAuthor",
      modules: mods.filter((m) => authorsOf(m).length === 0),
    },
  ];
}

const bySmart = (mods: readonly PackageInfo[], c: GroupContext): LibGroup[] =>
  c.smart.map((g) => ({
    key: `smart:${g.key}`,
    label: g.label,
    ...(g.param ? { param: g.param } : {}),
    modules: mods.filter((m) => g.moduleIds.includes(m.id)),
  }));

const GROUPERS: Record<
  GroupBy,
  (mods: readonly PackageInfo[], c: GroupContext) => LibGroup[]
> = { folder: byFolder, tag: byTag, author: byAuthor, smart: bySmart };

export function groupLibrary(
  modules: readonly PackageInfo[],
  by: GroupBy,
  ctx: GroupContext,
): LibGroup[] {
  return GROUPERS[by](modules, ctx)
    .map((g) => ({ ...g, modules: sortByTitle(g.modules) }))
    .filter((g) => g.modules.length > 0);
}
