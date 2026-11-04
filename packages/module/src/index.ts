// Companion module: runs for the full Gamemaster only (C-1, PR-4).
import { logError } from "@module-library/shared/log";
import { PROTOCOL_VERSIONS } from "@module-library/shared/protocol";
import { applyCommands, type WorldCommand } from "./apply-flow.ts";
import { type Channel, createChannel } from "./channel.ts";
import { type FoundryGame, foundryGlobals, MODULE_ID } from "./foundry.ts";

const HELLO_TIMEOUT_MS = 1000;
const HELLO_ATTEMPTS = 5;

function snapshot(game: FoundryGame) {
  const active = [...game.modules.values()].filter((m) => m.active);
  return {
    worldId: game.world.id,
    title: game.world.title,
    system: { id: game.system.id, version: game.system.version },
    coreVersion: `${game.release.generation}.${game.release.build}`,
    active: active.map((m) => ({ id: m.id, version: m.version ?? "" })),
    companionVersion: game.modules.get(MODULE_ID)?.version ?? "",
    takenAt: new Date().toISOString(),
  };
}

/** Says HELLO until the bridge answers; none means no extension (idle). */
async function handshake(
  channel: Channel,
  game: FoundryGame,
): Promise<boolean> {
  const hello = {
    moduleVersion: game.modules.get(MODULE_ID)?.version ?? "",
    protocol: PROTOCOL_VERSIONS,
    worldId: game.world.id,
    coreVersion: `${game.release.generation}.${game.release.build}`,
  };
  for (let attempt = 0; attempt < HELLO_ATTEMPTS; attempt++) {
    try {
      const reply = await channel.request("HELLO", hello, HELLO_TIMEOUT_MS);
      return reply.type === "HELLO_ACK";
    } catch {
      // No bridge yet: it may still be starting. Try again.
    }
  }
  return false;
}

async function start(): Promise<void> {
  const { game, CONST } = foundryGlobals();
  if (game.user?.role !== CONST.USER_ROLES.GAMEMASTER) return;
  const channel = createChannel(window);
  if (!(await handshake(channel, game))) return;
  await channel.request("SNAPSHOT_PUSH", snapshot(game));
  const reply = await channel.request("COMMANDS_PULL", {
    worldId: game.world.id,
  });
  const { world } = reply.payload as { world: readonly WorldCommand[] };
  if (world.length > 0) await applyCommands(channel, world);
}

foundryGlobals().Hooks.once("ready", () => {
  start().catch((error: unknown) => {
    logError("companion", error);
  });
});
