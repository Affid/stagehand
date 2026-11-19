// The modules view's data inside a running world (@stagehand/ui's
// ModulesData): this world only, its modules as Foundry has them now as the
// snapshot, and the changes not saved yet as local commands, which Setup's
// model reads as it reads a world's queue.
import type { Library } from "@stagehand/shared/library/schema";
import { toPackageInfo } from "@stagehand/shared/package-read";
import type { Command, WorldInfo } from "@stagehand/shared/world";
import type { ModulesData, ModulesSetup } from "@stagehand/ui/model/data.ts";
import type { FoundryGame } from "../foundry.ts";
import {
  activeModules,
  companionVersion,
  coreVersionOf,
} from "../world-state.ts";

/** ModulesData for one running world, which it names. */
export interface WorldData extends ModulesData {
  readonly setup: ModulesSetup;
  readonly world: WorldInfo;
}

export function worldData(
  game: FoundryGame,
  library: Library,
  changes: readonly Command[],
  now: string,
): WorldData {
  const core = coreVersionOf(game);
  const world: WorldInfo = {
    id: game.world.id,
    title: game.world.title,
    system: game.system.id,
    systemVersion: game.system.version,
    coreVersion: core,
  };
  return {
    world,
    library,
    setup: {
      core: {
        version: core,
        generation: game.release.generation,
        build: game.release.build,
      },
      lang: game.i18n.lang,
      modules: [...game.modules.values()].map(toPackageInfo),
      worlds: [world],
    },
    snapshots: {
      [world.id]: {
        worldId: world.id,
        title: world.title,
        system: { id: world.system, version: world.systemVersion },
        coreVersion: core,
        active: activeModules(game),
        companionVersion: companionVersion(game),
        takenAt: now,
      },
    },
    commands: changes,
  };
}
