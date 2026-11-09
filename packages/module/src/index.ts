// Companion module entry: one session per join, for the first full
// Gamemaster in the world (C-1, PR-4), through the world's own flags
// (docs/COMPANION-WORLD-PROTOCOL.md). Assistant GMs and players: nothing.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { foundryGlobals } from "./foundry.ts";
import { isFirstGamemaster } from "./gamemaster.ts";
import { createWorldIo } from "./world-io.ts";
import { runWorldSession } from "./world-session.ts";

async function start(): Promise<void> {
  const { game, CONST, ui, foundry, Hooks } = foundryGlobals();
  if (!isFirstGamemaster(game, CONST.USER_ROLES.GAMEMASTER)) return;
  await runWorldSession({
    game,
    dialog: foundry.applications.api.DialogV2,
    io: createWorldIo({
      fetch: (input, init) => fetch(input, init),
      route: (path) => foundry.utils.getRoute(path),
      world: game.world,
      hooks: Hooks,
    }),
    reload: () => {
      foundry.utils.debouncedReload();
    },
    warn: (message) => {
      ui.notifications.warn(message);
    },
    info: (message) => {
      ui.notifications.info(message);
    },
  });
}

const { Hooks } = foundryGlobals();
Hooks.once("ready", () => {
  start().catch((error: unknown) => {
    logError("companion", error);
  });
});
