// What the Updates tab's parts need to start and stop our checks.
import type { CheckDeps } from "../../../package-check.ts";
import type { InstallDeps } from "../../../package-install.ts";
import { useUi } from "../../../context.ts";

export function useCheckDeps(): CheckDeps {
  const { store, page, actions } = useUi();
  return {
    store,
    page,
    save: (full, checkedAt, results) =>
      actions.saveChecks(full, checkedAt, results),
  };
}

/** What the Updates tab's parts need to install the ticked updates. */
export function useInstallDeps(): InstallDeps {
  const { store, page, actions } = useUi();
  return {
    store,
    page,
    markRefused: (id, version) => actions.markRefused(id, version),
  };
}
