// Derived data for the modules view, recomputed only when inputs change.
import {
  type AuthorEntry,
  listAuthors,
} from "@stagehand/shared/organise/authors";
import { filterModules } from "@stagehand/shared/organise/filter";
import {
  type SmartGroup,
  smartGroups,
} from "@stagehand/shared/organise/groups";
import { usageCounts } from "@stagehand/shared/organise/usage";
import type { PackageInfo } from "@stagehand/shared/package";
import { type CoreVersion, parseCoreVersion } from "@stagehand/shared/version";
import { useMemo } from "preact/hooks";
import type { UiState } from "../store.ts";
import { scopeModules, sortByTitle } from "../model/modules.ts";

export interface ModulesModel {
  readonly all: readonly PackageInfo[];
  readonly core: CoreVersion;
  readonly groups: readonly SmartGroup[];
  readonly authors: readonly AuthorEntry[];
  readonly usage: Readonly<Record<string, number>>;
  readonly visible: readonly PackageInfo[];
  readonly filtered: boolean;
}

export function useModulesModel(state: UiState): ModulesModel {
  const { data, scope, filter } = state;
  const setup = data.setup;
  const base = useMemo(() => {
    const all = sortByTitle(setup?.modules ?? []);
    const core = parseCoreVersion(setup?.core.version ?? "0");
    const snapshots = Object.values(data.snapshots);
    const usage = usageCounts(snapshots);
    const groups = smartGroups(all, {
      core,
      activeInWorlds: usage,
      hasSnapshots: snapshots.length > 0,
    });
    return { all, core, usage, groups, authors: listAuthors(all) };
  }, [setup, data.snapshots]);
  const visible = useMemo(
    () =>
      filterModules(
        scopeModules(base.all, data.library, scope, base.groups),
        data.library,
        filter,
      ),
    [base, data.library, scope, filter],
  );
  const filtered =
    scope.kind !== "all" ||
    filter.text !== "" ||
    filter.tags.length > 0 ||
    filter.authors.length > 0;
  return { ...base, visible, filtered };
}
