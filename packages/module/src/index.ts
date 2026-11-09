// Companion module entry: registers its setting and runs one session per
// launch for the full Gamemaster (C-1, PR-4). Assistant GMs and players: nothing.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { createChannel } from "./channel.ts";
import { foundryGlobals, MODULE_ID } from "./foundry.ts";
import { runSession } from "./session.ts";

const NOTICE_SETTING = "extensionNoticeShown";

function registerSettings(): void {
  const { game } = foundryGlobals();
  game.settings.register(MODULE_ID, NOTICE_SETTING, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
}

async function start(): Promise<void> {
  const { game, CONST, ui, foundry } = foundryGlobals();
  if (game.user?.role !== CONST.USER_ROLES.GAMEMASTER) return;
  const result = await runSession({
    game,
    dialog: foundry.applications.api.DialogV2,
    channel: createChannel(window),
    reload: () => {
      foundry.utils.debouncedReload();
    },
    warn: (message) => {
      ui.notifications.warn(message);
    },
    info: (message) => {
      ui.notifications.info(message);
    },
    now: () => new Date(),
  });
  if (result.handshake === "rejected")
    ui.notifications.warn(game.i18n.localize("STAGEHAND.Outdated"));
  if (
    result.handshake === "none" &&
    game.settings.get(MODULE_ID, NOTICE_SETTING) !== true
  ) {
    // One-time, optional notice (C-1).
    ui.notifications.info(game.i18n.localize("STAGEHAND.NoExtension"));
    await game.settings.set(MODULE_ID, NOTICE_SETTING, true);
  }
}

const { Hooks } = foundryGlobals();
Hooks.once("init", registerSettings);
Hooks.once("ready", () => {
  start().catch((error: unknown) => {
    logError("companion", error);
  });
});
