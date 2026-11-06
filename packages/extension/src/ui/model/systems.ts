// Installed systems as the Library shows them: a system's data as a
// package (the fields a system lacks take their empty values), and the
// worlds that use it.
import type { PackageInfo } from "@module-library/shared/package";
import type { SystemInfo, WorldInfo } from "@module-library/shared/world";

export function asPackage(s: SystemInfo): PackageInfo {
  const optional = Object.fromEntries(
    Object.entries(s).filter(([, v]) => v !== undefined),
  ) as Partial<PackageInfo>;
  return {
    ...optional,
    id: s.id,
    title: s.title,
    version: s.version,
    authors: s.authors ?? [],
    library: s.library ?? false,
    hasPacks: s.hasPacks ?? false,
    hasCode: s.hasCode ?? false,
    compatibility: s.compatibility ?? {},
    requires: s.requires ?? [],
    recommends: s.recommends ?? [],
    conflicts: s.conflicts ?? [],
    systems: s.systems ?? [],
  };
}

export const worldsUsing = (
  worlds: readonly WorldInfo[],
  systemId: string,
): WorldInfo[] => worlds.filter((w) => w.system === systemId);
