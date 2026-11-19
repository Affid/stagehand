// Derived data for the modules view, recomputed only when inputs change.
import { filterModules } from "@stagehand/shared/organise/filter";
import type { PackageInfo } from "@stagehand/shared/package";
import { useMemo } from "preact/hooks";
import {
  type GroupSources,
  useGroupSources,
} from "@stagehand/ui/world/useGroupSources.ts";
import type { UiState } from "../store.ts";
import { scopeModules } from "@stagehand/ui/model/modules.ts";

export interface ModulesModel extends GroupSources {
  readonly visible: readonly PackageInfo[];
  readonly filtered: boolean;
}

export function useModulesModel(state: UiState): ModulesModel {
  const { data, scope, filter } = state;
  const base = useGroupSources(data, true);
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
