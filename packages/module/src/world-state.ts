// What the module reads from the running world: its active modules (C-2)
// and the resolver input for a set of commands (C-4, C-6), from the live state.
import { toPackageInfo } from "@stagehand/shared/package-read";
import { type Plan, resolvePlan } from "@stagehand/shared/resolver";
import { parseCoreVersion } from "@stagehand/shared/version";
import type { WorldCommand } from "@stagehand/shared/world";
import type { ActiveModule } from "@stagehand/shared/world-flags";
import { type FoundryGame, MODULE_ID } from "./foundry.ts";

export const coreVersionOf = (game: FoundryGame): string =>
  `${String(game.release.generation)}.${String(game.release.build)}`;

export const activeIds = (game: FoundryGame): string[] =>
  [...game.modules.values()].filter((m) => m.active).map((m) => m.id);

/** The active modules with their versions, for the report. */
export const activeModules = (game: FoundryGame): ActiveModule[] =>
  [...game.modules.values()]
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, version: m.version ?? "" }));

export const companionVersion = (game: FoundryGame): string =>
  game.modules.get(MODULE_ID)?.version ?? "";

/** Resolves against the live state, never the stale snapshot (C-4). */
export function planFor(
  game: FoundryGame,
  commands: readonly WorldCommand[],
  removeDependents: boolean,
): Plan {
  return resolvePlan({
    commands: commands.map((c) => ({ mode: c.mode, modules: c.modules })),
    current: activeIds(game),
    installed: [...game.modules.values()].map(toPackageInfo),
    core: parseCoreVersion(coreVersionOf(game)),
    system: { id: game.system.id, version: game.system.version },
    companionId: MODULE_ID,
    removeDependents,
  });
}

/** Core's module configuration for a target: every installed module listed. */
export function moduleConfiguration(
  game: FoundryGame,
  target: readonly string[],
): Record<string, boolean> {
  const on = new Set([...target, MODULE_ID]);
  // Keep core's entries for modules that aren't installed right now.
  const current = game.settings.get("core", "moduleConfiguration");
  const kept =
    typeof current === "object" && current !== null
      ? (current as Record<string, boolean>)
      : {};
  return {
    ...kept,
    ...Object.fromEntries(
      [...game.modules.keys()].map((id) => [id, on.has(id)]),
    ),
  };
}
