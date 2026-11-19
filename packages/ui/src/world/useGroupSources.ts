// What grouping needs besides the library, worked out once per change of
// the server's modules or the worlds' snapshots: the modules by title, the
// core version, smart groups and authors.
import {
  type AuthorEntry,
  listAuthors,
} from "@stagehand/shared/organise/authors";
import {
  type SmartGroup,
  smartGroups,
} from "@stagehand/shared/organise/groups";
import { usageCounts } from "@stagehand/shared/organise/usage";
import type { PackageInfo } from "@stagehand/shared/package";
import { type CoreVersion, parseCoreVersion } from "@stagehand/shared/version";
import { useMemo } from "preact/hooks";
import type { ModulesData } from "../model/data.ts";
import { sortByTitle } from "../model/modules.ts";

export interface GroupSources {
  readonly all: readonly PackageInfo[];
  readonly core: CoreVersion;
  readonly usage: Readonly<Record<string, number>>;
  readonly groups: readonly SmartGroup[];
  readonly authors: readonly AuthorEntry[];
}

/**
 * `everyWorld`: the snapshots are every world's (Setup), so "Unused in
 * known worlds" means something; a running world knows only itself.
 */
export function useGroupSources(
  data: ModulesData,
  everyWorld: boolean,
): GroupSources {
  const { setup, snapshots } = data;
  return useMemo(() => {
    const all = sortByTitle(setup?.modules ?? []);
    const core = parseCoreVersion(setup?.core.version ?? "0");
    const known = Object.values(snapshots);
    const usage = usageCounts(known);
    const groups = smartGroups(all, {
      core,
      activeInWorlds: usage,
      hasSnapshots: everyWorld && known.length > 0,
    });
    return { all, core, usage, groups, authors: listAuthors(all) };
  }, [setup, snapshots, everyWorld]);
}
