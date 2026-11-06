// Answers the companion module's messages, relayed by the game page bridge
// (PRD 8.3). Every payload is validated: page scripts can post anything.
import {
  type Envelope,
  makeEnvelope,
  negotiateProtocol,
  PROTOCOL_VERSIONS,
} from "@module-library/shared/protocol";
import { MAX_ACTIVE, SnapshotSchema } from "@module-library/shared/world";
import { z } from "zod";
import {
  acknowledge,
  expandForWorld,
  failOrphans,
  isAcceptable,
  pendingFor,
  reconcile,
} from "./commands.ts";
import type { ServerId } from "./servers.ts";
import { withResult } from "./kv.ts";
import type { ServerState } from "./state.ts";

export interface RelayDeps {
  readonly state: ServerState;
  readonly now: () => string;
}

const HelloSchema = z.object({
  moduleVersion: z.string().max(50),
  protocol: z.array(z.number().int()),
  worldId: z.string().min(1).max(200),
  coreVersion: z.string().max(50),
});

const PullSchema = z.object({ worldId: z.string().min(1).max(200) });

const AckSchema = z.object({
  id: z.string().min(1).max(200),
  worldId: z.string().min(1).max(200),
  status: z.enum(["applying", "failed", "declined"]),
  target: z.array(z.string().max(200)).max(MAX_ACTIVE).optional(),
  error: z.string().max(2000).optional(),
});

const reply = (msg: Envelope, type: string, payload: unknown): Envelope =>
  makeEnvelope("bridge", type, payload, msg.requestId);

async function hello(deps: RelayDeps, server: ServerId, msg: Envelope) {
  const h = HelloSchema.parse(msg.payload);
  const protocol = negotiateProtocol(PROTOCOL_VERSIONS, h.protocol) ?? null;
  await deps.state.putHello(server, {
    worldId: h.worldId,
    moduleVersion: h.moduleVersion,
    protocol,
    at: deps.now(),
  });
  return protocol === null
    ? reply(msg, "HELLO_REJECT", { protocol: PROTOCOL_VERSIONS })
    : reply(msg, "HELLO_ACK", { protocol, serverId: server, features: [] });
}

async function snapshot(deps: RelayDeps, server: ServerId, msg: Envelope) {
  const snap = SnapshotSchema.parse(msg.payload);
  await deps.state.putSnapshot(server, snap);
  const active = snap.active.map((m) => m.id);
  await deps.state.updateCommands(server, (list) =>
    reconcile(list, { worldId: snap.worldId, active }),
  );
  return reply(msg, "OK", {});
}

async function pull(deps: RelayDeps, server: ServerId, msg: Envelope) {
  const { worldId } = PullSchema.parse(msg.payload);
  const library = await deps.state.library(server);
  const list = await deps.state.updateCommands(server, (all) =>
    failOrphans(all, library, worldId),
  );
  // "Launch without changes" on Setup: this launch gets none; they stay queued.
  if (await deps.state.takeLaunchHold(server, worldId))
    return reply(msg, "COMMANDS", { world: [], global: [] });
  const world = expandForWorld(pendingFor(list, worldId), library);
  return reply(msg, "COMMANDS", { world, global: [] });
}

async function ack(deps: RelayDeps, server: ServerId, msg: Envelope) {
  const a = AckSchema.parse(msg.payload);
  // The module goes on only for accepted acks: a command cancelled on
  // Setup while the GM's dialog was open must not be applied.
  const accepted = await deps.state.updateCommands(server, (list) =>
    withResult(acknowledge(list, a), isAcceptable(list, a)),
  );
  return reply(msg, "OK", { accepted });
}

type Handler = (d: RelayDeps, s: ServerId, m: Envelope) => Promise<Envelope>;

// A Map: message types like "constructor" must not find inherited members.
const HANDLERS: ReadonlyMap<string, Handler> = new Map([
  ["HELLO", hello],
  ["SNAPSHOT_PUSH", snapshot],
  ["COMMANDS_PULL", pull],
  ["COMMAND_ACK", ack],
]);

export async function handleRelay(
  deps: RelayDeps,
  server: ServerId,
  msg: Envelope,
): Promise<Envelope> {
  const handler = HANDLERS.get(msg.type);
  if (!handler)
    return reply(msg, "ERROR", { error: `Unknown type ${msg.type}` });
  try {
    return await handler(deps, server, msg);
  } catch (error: unknown) {
    const detail = error instanceof z.ZodError ? "invalid payload" : "failed";
    return reply(msg, "ERROR", { error: `${msg.type} ${detail}` });
  }
}
