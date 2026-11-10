// Updates Foundry would install, as the Library counts and marks them: a
// newer version than the installed one, and never for a locked package.
import type { PackageInfo } from "@stagehand/shared/package";
import { bareVersion, isNewerVersion } from "@stagehand/shared/version";
import type { Updates } from "../../page-updates.ts";

interface Installed {
  readonly id: string;
  readonly version: string;
  readonly locked?: boolean | undefined;
}

/**
 * The version to update to, or null. Still newer than what is installed:
 * the list is read once per Setup load, and a release may spell its version
 * with a "v" Foundry's list leaves out (Phase 6 live: socketlib).
 */
export function updateFor(
  updates: Readonly<Record<string, string>>,
  pkg: Installed,
): string | null {
  const next = Object.hasOwn(updates, pkg.id) ? updates[pkg.id] : undefined;
  if (!next || pkg.locked) return null;
  return isNewerVersion(bareVersion(next), bareVersion(pkg.version))
    ? next
    : null;
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
