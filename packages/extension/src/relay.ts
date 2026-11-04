// Answers the companion module's messages, relayed by the game page bridge.
import {
  type Envelope,
  makeEnvelope,
  negotiateProtocol,
  PROTOCOL_VERSIONS,
} from "@module-library/shared/protocol";
import {
  acknowledge,
  type CommandAck,
  pendingFor,
  reconcile,
} from "./commands.ts";
import type { ServerId } from "./servers.ts";
import {
  getCommands,
  putCommands,
  putSnapshot,
  type WorldSnapshot,
} from "./store.ts";

const reply = (msg: Envelope, type: string, payload: unknown): Envelope =>
  makeEnvelope("bridge", type, payload, msg.requestId);

function hello(server: ServerId, msg: Envelope): Envelope {
  const theirs = (msg.payload as { protocol?: unknown }).protocol;
  const versions = Array.isArray(theirs)
    ? theirs.filter((v): v is number => typeof v === "number")
    : [];
  const protocol = negotiateProtocol(PROTOCOL_VERSIONS, versions);
  return protocol === undefined
    ? reply(msg, "HELLO_REJECT", { protocol: PROTOCOL_VERSIONS })
    : reply(msg, "HELLO_ACK", { protocol, serverId: server, features: [] });
}

async function snapshot(server: ServerId, msg: Envelope): Promise<Envelope> {
  const snap = msg.payload as WorldSnapshot;
  await putSnapshot(server, snap);
  const commands = await getCommands(server);
  await putCommands(
    server,
    reconcile(commands, {
      worldId: snap.worldId,
      active: snap.active.map((m) => m.id),
    }),
  );
  return reply(msg, "OK", {});
}

async function pull(server: ServerId, msg: Envelope): Promise<Envelope> {
  const { worldId } = msg.payload as { worldId: string };
  const world = pendingFor(await getCommands(server), worldId);
  return reply(msg, "COMMANDS", { world, global: [] });
}

async function ack(server: ServerId, msg: Envelope): Promise<Envelope> {
  const commands = await getCommands(server);
  await putCommands(server, acknowledge(commands, msg.payload as CommandAck));
  return reply(msg, "OK", {});
}

export async function handleRelay(
  server: ServerId,
  msg: Envelope,
): Promise<Envelope> {
  switch (msg.type) {
    case "HELLO":
      return hello(server, msg);
    case "SNAPSHOT_PUSH":
      return snapshot(server, msg);
    case "COMMANDS_PULL":
      return pull(server, msg);
    case "COMMAND_ACK":
      return ack(server, msg);
    default:
      return reply(msg, "ERROR", { error: `Unknown type ${msg.type}` });
  }
}
