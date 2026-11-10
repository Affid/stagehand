// Picks the Setup adapter for a core version (V-2), or safe mode (V-3).
import type { CoreVersion } from "@stagehand/shared/version";
import type { Adapter, SetupConfig } from "./config.ts";

export type AdapterChoice =
  | { readonly status: "supported"; readonly adapter: Adapter }
  | { readonly status: "untested-build"; readonly adapter: Adapter }
  | { readonly status: "safe-mode" };

export function selectAdapter(
  config: SetupConfig,
  core: CoreVersion,
): AdapterChoice {
  const sameGeneration = config.adapters.filter(
    (a) => a.generation === core.generation,
  );
  const exact = sameGeneration.find(
    (a) => a.minBuild <= core.build && core.build <= a.maxBuild,
  );
  if (exact) return { status: "supported", adapter: exact };
  const older = sameGeneration
    .filter((a) => a.maxBuild < core.build)
    .sort((a, b) => b.maxBuild - a.maxBuild)[0];
  if (older) return { status: "untested-build", adapter: older };
  return { status: "safe-mode" };
}

/** Actions that change anything are allowed only with a matching adapter. */
export const allowsChanges = (choice: AdapterChoice): boolean =>
  choice.status !== "safe-mode";
