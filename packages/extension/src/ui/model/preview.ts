// What a world will look like after its next launch (P-4, P-6): every change
// already queued for it, in order, plus an optional new one, resolved with
// the same resolver the companion runs in-world, against the world's last
// snapshot and its own core version (V-7).
import {
  type ApplyMode,
  type ApplySpec,
  type Plan,
  resolvePlan,
} from "@module-library/shared/resolver";
import { parseCoreVersion } from "@module-library/shared/version";
import { type Command, changeModules } from "@module-library/shared/world";
import type { SetupState } from "../../messages.ts";

export const COMPANION_ID = "module-library";

export interface NewChange {
  readonly presetIds: readonly string[];
  /** Modules picked one by one. */
  readonly modules?: readonly string[] | undefined;
  readonly mode: ApplyMode;
}

export interface PreviewRequest {
  readonly worldId: string;
  /** A change not queued yet; it goes after the queued ones. */
  readonly change?: NewChange | undefined;
  readonly removeDependents: boolean;
}

export type PreviewWarning = "no-snapshot" | "unknown-world";

export interface Preview {
  readonly plan: Plan | undefined;
  readonly warnings: readonly PreviewWarning[];
  /** How many queued changes the plan includes before the new one. */
  readonly queued: number;
  /** Queued changes left out: a preset was deleted, so they will fail. */
  readonly orphaned: number;
}

/** A world's queued changes, oldest first. */
export const pendingFor = (
  state: SetupState,
  worldId: string,
): readonly Command[] =>
  state.commands.filter((c) => c.worldId === worldId && c.status === "pending");

/** The modules of these presets; unknown presets add nothing. */
export const presetModules = (
  state: SetupState,
  presetIds: readonly string[],
): string[] => [
  ...new Set(
    state.library.presets
      .filter((p) => presetIds.includes(p.id))
      .flatMap((p) => p.modules),
  ),
];

/** Like the background's failOrphans: any deleted preset fails the change. */
export const isOrphaned = (state: SetupState, c: Command): boolean =>
  c.payload.presetIds.some(
    (id) => !state.library.presets.some((p) => p.id === id),
  );

const toSpec = (state: SetupState, change: NewChange): ApplySpec => ({
  mode: change.mode,
  modules: changeModules(state.library.presets, {
    presetIds: [...change.presetIds],
    ...(change.modules ? { modules: [...change.modules] } : {}),
  }),
});

export function previewApply(state: SetupState, req: PreviewRequest): Preview {
  const world = state.setup?.worlds.find((w) => w.id === req.worldId);
  const all = pendingFor(state, req.worldId);
  const queued = all.filter((c) => !isOrphaned(state, c));
  const counts = {
    queued: queued.length,
    orphaned: all.length - queued.length,
  };
  if (!state.setup || !world)
    return { plan: undefined, warnings: ["unknown-world"], ...counts };
  const changes = [
    ...queued.map((c) => toSpec(state, c.payload)),
    ...(req.change ? [toSpec(state, req.change)] : []),
  ];
  const snapshot = state.snapshots[req.worldId];
  const warnings: PreviewWarning[] = snapshot ? [] : ["no-snapshot"];
  if (changes.length === 0) return { plan: undefined, warnings, ...counts };
  const plan = resolvePlan({
    commands: changes,
    current: snapshot ? snapshot.active.map((m) => m.id) : [COMPANION_ID],
    installed: state.setup.modules,
    core: parseCoreVersion(world.coreVersion || state.setup.core.version),
    system: { id: world.system, version: world.systemVersion },
    companionId: COMPANION_ID,
    removeDependents: req.removeDependents,
  });
  return { plan, warnings, ...counts };
}

export interface Effect {
  /** Enabled because asked for (dependencies are counted apart). */
  readonly enable: number;
  readonly disable: number;
  readonly dependencies: number;
  /** Things the GM must check: skipped, conflicting or still needed. */
  readonly problems: number;
}

export function effectOf(plan: Plan): Effect {
  const deps = new Set(plan.dependencyAdditions);
  return {
    enable: plan.enable.filter((id) => !deps.has(id)).length,
    disable: plan.disable.length,
    dependencies: plan.dependencyAdditions.length,
    problems:
      plan.missing.length +
      plan.blocked.length +
      plan.incompatible.length +
      plan.conflicts.length +
      plan.dependents.length,
  };
}
