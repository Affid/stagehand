import { describe, expect, test } from "vitest";
import { makeEnvelope } from "@module-library/shared/protocol";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import { handleRelay } from "../../src/background/relay.ts";
import { createState } from "../../src/background/state.ts";

const S = "http://localhost:30000";

async function setup() {
  const state = createState(serialized(memoryKeyValue()));
  await state.applyLibraryOp(S, {
    op: "preset.create",
    preset: {
      id: "p1",
      name: "QoL",
      description: "",
      modules: ["a"],
      source: "user",
    },
  });
  await state.updateCommands(S, () => [
    {
      id: "c1",
      scope: "world",
      worldId: "w",
      type: "preset.apply",
      payload: { mode: "add", presetIds: ["p1"] },
      createdAt: "t",
      baseSnapshotAt: null,
      status: "pending",
    },
  ]);
  const deps = { state, now: () => "now" };
  const send = (type: string, payload: unknown) =>
    handleRelay(deps, S, makeEnvelope("module", type, payload, "r1"));
  return { state, send };
}

const snapshot = (active: string[]) => ({
  worldId: "w",
  title: "W",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1" })),
  companionVersion: "0.1.0",
  takenAt: "t",
});

describe("relay", () => {
  test("HELLO negotiates the protocol and records the handshake", async () => {
    const { state, send } = await setup();
    const reply = await send("HELLO", {
      moduleVersion: "0.1.0",
      protocol: [1, 2],
      worldId: "w",
      coreVersion: "14.369",
    });
    expect(reply).toMatchObject({
      type: "HELLO_ACK",
      requestId: "r1",
      from: "bridge",
      payload: { protocol: 1, serverId: S },
    });
    expect((await state.hellos(S)).w).toMatchObject({ protocol: 1 });
  });

  test("HELLO without a common protocol is rejected (companion outdated)", async () => {
    const { state, send } = await setup();
    const reply = await send("HELLO", {
      moduleVersion: "9",
      protocol: [9],
      worldId: "w",
      coreVersion: "14",
    });
    expect(reply.type).toBe("HELLO_REJECT");
    expect((await state.hellos(S)).w?.protocol).toBeNull();
  });

  test("full apply round trip: pull, ack applying, snapshot marks applied", async () => {
    const { state, send } = await setup();
    const pulled = await send("COMMANDS_PULL", { worldId: "w" });
    expect(pulled.payload).toEqual({
      world: [
        {
          id: "c1",
          mode: "add",
          presets: [{ id: "p1", name: "QoL" }],
          modules: ["a"],
        },
      ],
      global: [],
    });
    await send("COMMAND_ACK", {
      id: "c1",
      status: "applying",
      target: ["a", "companion"],
    });
    await send("SNAPSHOT_PUSH", snapshot(["companion", "a"]));
    expect((await state.commands(S))[0]?.status).toBe("applied");
    expect((await state.snapshots(S)).w?.active).toHaveLength(2);
  });

  test("invalid payloads get an ERROR reply and change nothing", async () => {
    const { state, send } = await setup();
    expect((await send("SNAPSHOT_PUSH", { worldId: 5 })).type).toBe("ERROR");
    expect(
      (await send("COMMAND_ACK", { id: "c1", status: "applied" })).type,
    ).toBe("ERROR");
    expect((await send("NOPE", {})).type).toBe("ERROR");
    expect((await state.commands(S))[0]?.status).toBe("pending");
  });
});
