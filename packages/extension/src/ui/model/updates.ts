// Updates Foundry would install, as the Library counts and marks them: a
// newer version than the installed one, and never for a locked package.
import type { PackageInfo } from "@module-library/shared/package";
import type { Updates } from "../../page-updates.ts";

interface Installed {
  readonly id: string;
  readonly version: string;
  readonly locked?: boolean | undefined;
}

/** The version to update to, or null. */
export function updateFor(
  updates: Readonly<Record<string, string>>,
  pkg: Installed,
): string | null {
  const next = Object.hasOwn(updates, pkg.id) ? updates[pkg.id] : undefined;
  return next && next !== pkg.version && !pkg.locked ? next : null;
}

export function updateCount(
  updates: Updates,
  modules: readonly PackageInfo[],
  systems: readonly Installed[],
): number {
  return (
    modules.filter((m) => updateFor(updates.module, m)).length +
    systems.filter((s) => updateFor(updates.system, s)).length
  );
}
