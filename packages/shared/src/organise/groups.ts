// Smart groups: automatic, read-only (PRD 7.3).
import type { PackageInfo } from "../package.ts";
import {
  Availability,
  type CoreVersion,
  testAvailability,
} from "../version.ts";

export interface SmartGroup {
  /** "library", "content", "system:<id>", "unverified", "unused". */
  readonly key: string;
  /** i18n key of the label; system groups carry the system id as `param`. */
  readonly label: string;
  readonly param?: string;
  readonly moduleIds: readonly string[];
}

export interface GroupContext {
  readonly core: CoreVersion;
  /** Worlds each module is active in, from snapshots (G-7). */
  readonly activeInWorlds: Readonly<Record<string, number>>;
  readonly hasSnapshots: boolean;
}

const ids = (
  modules: readonly PackageInfo[],
  test: (m: PackageInfo) => boolean,
) => modules.filter(test).map((m) => m.id);

function systemGroups(modules: readonly PackageInfo[]): SmartGroup[] {
  const systems = [
    ...new Set(modules.flatMap((m) => m.systems.map((s) => s.id))),
  ].sort();
  return systems.map((id) => ({
    key: `system:${id}`,
    label: "groups.system",
    param: id,
    moduleIds: ids(modules, (m) => m.systems.some((s) => s.id === id)),
  }));
}

export function smartGroups(
  modules: readonly PackageInfo[],
  ctx: GroupContext,
): SmartGroup[] {
  const verified = (m: PackageInfo): boolean =>
    testAvailability(m.compatibility, ctx.core) === Availability.VERIFIED;
  const groups: SmartGroup[] = [
    {
      key: "library",
      label: "groups.library",
      moduleIds: ids(modules, (m) => m.library),
    },
    {
      key: "content",
      label: "groups.content",
      moduleIds: ids(modules, (m) => m.hasPacks && !m.hasCode),
    },
    ...systemGroups(modules),
    {
      key: "unverified",
      label: "groups.unverified",
      moduleIds: ids(modules, (m) => !verified(m)),
    },
  ];
  if (!ctx.hasSnapshots) return groups;
  return [
    ...groups,
    {
      key: "unused",
      label: "groups.unused",
      moduleIds: ids(modules, (m) => (ctx.activeInWorlds[m.id] ?? 0) === 0),
    },
  ];
}
