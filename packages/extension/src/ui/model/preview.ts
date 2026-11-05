// The diff preview before queuing (P-4), computed with the same resolver the
// companion runs in-world, against the world's last snapshot and core (V-7).
import {
  type ApplyMode,
  type Plan,
  resolvePlan,
} from "@module-library/shared/resolver";
import { parseCoreVersion } from "@module-library/shared/version";
import type { SetupState } from "../../messages.ts";

export const COMPANION_ID = "module-library";

export interface PreviewRequest {
  readonly worldId: string;
  readonly presetIds: readonly string[];
  readonly mode: ApplyMode;
  readonly removeDependents: boolean;
}

export type PreviewWarning = "no-snapshot" | "unknown-world";

export interface Preview {
  readonly plan: Plan | undefined;
  readonly warnings: readonly PreviewWarning[];
}

export function previewApply(state: SetupState, req: PreviewRequest): Preview {
  const world = state.setup?.worlds.find((w) => w.id === req.worldId);
  if (!state.setup || !world)
    return { plan: undefined, warnings: ["unknown-world"] };
  const snapshot = state.snapshots[req.worldId];
  const modules = state.library.presets
    .filter((p) => req.presetIds.includes(p.id))
    .flatMap((p) => p.modules);
  const plan = resolvePlan({
    commands: [{ mode: req.mode, modules }],
    current: snapshot ? snapshot.active.map((m) => m.id) : [COMPANION_ID],
    installed: state.setup.modules,
    core: parseCoreVersion(world.coreVersion || state.setup.core.version),
    system: { id: world.system, version: world.systemVersion },
    companionId: COMPANION_ID,
    removeDependents: req.removeDependents,
  });
  return { plan, warnings: snapshot ? [] : ["no-snapshot"] };
}
