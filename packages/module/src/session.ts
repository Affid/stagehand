// One launch: handshake, snapshot, pull, apply (PRD 8.4). Runs only for the
// full Gamemaster (C-1, PR-4); stays idle without the extension.
import { PROTOCOL_VERSIONS } from "@module-library/shared/protocol";
import { WorldCommandSchema } from "@module-library/shared/world";
import { z } from "zod";
import { type ApplyDeps, applyCommands, type Outcome } from "./apply.ts";
import { ChannelTimeout } from "./channel.ts";
import { MODULE_ID } from "./foundry.ts";
import { coreVersionOf, takeSnapshot } from "./world-state.ts";

/**
 * How long each HELLO waits: longer each try. In the Android app the
 * game page and our background share one renderer, so while the game
 * loads the first answer can take over a second (seen on the emulator).
 */
export const HELLO_TIMEOUTS_MS = [1000, 2000, 3000, 4000, 5000] as const;
export const HELLO_ATTEMPTS = HELLO_TIMEOUTS_MS.length;

export type Handshake = "ok" | "rejected" | "none";

export interface SessionResult {
  readonly handshake: Handshake;
  readonly outcome?: Outcome;
}

const CommandsSchema = z.object({
  world: z.array(WorldCommandSchema),
  /** The modules on after the launch, as reviewed on Setup. */
  reviewed: z.array(z.string().max(200)).max(5000).optional(),
});

/**
 * Says HELLO until the bridge answers; no answer means no extension. Other
 * errors are thrown (and logged by the caller).
 */
export async function handshake(deps: ApplyDeps): Promise<Handshake> {
  const { game } = deps;
  const hello = {
    moduleVersion: game.modules.get(MODULE_ID)?.version ?? "",
    protocol: PROTOCOL_VERSIONS,
    worldId: game.world.id,
    coreVersion: coreVersionOf(game),
  };
  for (const timeoutMs of HELLO_TIMEOUTS_MS) {
    try {
      const reply = await deps.channel.request("HELLO", hello, timeoutMs);
      return reply.type === "HELLO_ACK" ? "ok" : "rejected";
    } catch (error: unknown) {
      // No answer: the bridge may still be starting, so try again. Anything
      // else is a fault, not a missing extension (a thrown error once hid
      // that the handshake never ran on plain http: Android spike review).
      if (!(error instanceof ChannelTimeout)) throw error;
    }
  }
  return "none";
}

export async function runSession(deps: ApplyDeps): Promise<SessionResult> {
  const result = await handshake(deps);
  if (result !== "ok") return { handshake: result };
  await deps.channel.request(
    "SNAPSHOT_PUSH",
    takeSnapshot(deps.game, deps.now()),
  );
  const reply = await deps.channel.request("COMMANDS_PULL", {
    worldId: deps.game.world.id,
  });
  const parsed = CommandsSchema.safeParse(reply.payload);
  if (!parsed.success) return { handshake: "ok" };
  return {
    handshake: "ok",
    outcome: await applyCommands(deps, parsed.data.world, parsed.data.reviewed),
  };
}
