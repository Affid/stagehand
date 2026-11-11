// The companion module as Setup knows it: its id, where Foundry installs it
// from, and the oldest version this Stagehand works with.
import { isNewerVersion } from "./version.ts";

export const COMPANION_ID = "stagehand";

/**
 * The companion's manifest on the manifests branch: the address in its own
 * module.json, so Foundry updates it from the same place it was installed.
 */
export const COMPANION_MANIFEST =
  "https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json";

/**
 * Our page's own task for an install of the companion, start to end. Not
 * the manifest address: Foundry's progress uses that as its id and ends
 * before its package list is read again.
 */
export const COMPANION_INSTALL_TASK = "stagehand.install-companion";

/** Raise when Setup starts to need something an older companion lacks. */
export const MIN_COMPANION_VERSION = "0.1.0";

export type CompanionState = "ok" | "missing" | "outdated";

interface Installed {
  readonly id: string;
  readonly version: string;
}

/** The companion among the server's installed modules. */
export function companionState(modules: readonly Installed[]): CompanionState {
  const companion = modules.find((m) => m.id === COMPANION_ID);
  if (!companion) return "missing";
  return isNewerVersion(MIN_COMPANION_VERSION, companion.version || "0")
    ? "outdated"
    : "ok";
}
