import { describe, expect, test } from "vitest";
import { makeEnvelope } from "@module-library/shared/protocol";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";
import { handleRelay } from "../../src/background/relay.ts";
import { createState } from "../../src/background/state.ts";

const S = "http://localhost:30000";
const NOW = "2026-11-06T12:00:00.000Z";

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
  const deps = { state, now: () => NOW };
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
  takenAt: "2026-11-05T00:00:00.000Z",
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
    const ack = await send("COMMAND_ACK", {
      id: "c1",
      worldId: "w",
      status: "applying",
      target: ["a", "companion"],
    });
    expect(ack.payload).toEqual({ accepted: true });
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

describe("relay: review fixes", () => {
  test("acks report whether they were accepted; cancelled commands are not", async () => {
    const { state, send } = await setup();
    await state.updateCommands(S, (list) =>
      list.map((c) => ({ ...c, status: "cancelled" as const })),
    );
    const reply = await send("COMMAND_ACK", {
      id: "c1",
      worldId: "w",
      status: "applying",
      target: [],
    });
    expect(reply).toMatchObject({ type: "OK", payload: { accepted: false } });
  });

  test("an ack for another world's command is refused", async () => {
    const { state, send } = await setup();
    const reply = await send("COMMAND_ACK", {
      id: "c1",
      worldId: "other",
      status: "declined",
    });
    expect(reply.payload).toEqual({ accepted: false });
    expect((await state.commands(S))[0]?.status).toBe("pending");
  });

  test("a command whose preset was deleted fails instead of applying nothing", async () => {
    const { state, send } = await setup();
    await state.applyLibraryOp(S, {
      op: "preset.delete",
      id: "p1",
      baseRevision: 1,
    });
    const pulled = await send("COMMANDS_PULL", { worldId: "w" });
    expect(pulled.payload).toEqual({ world: [], global: [] });
    expect((await state.commands(S))[0]).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/preset/i),
    });
  });

  test("a launch held on Setup gets no changes once; they stay queued for the next", async () => {
    const { state, send } = await setup();
    await state.setLaunchHold(S, "w", true, NOW);
    const held = await send("COMMANDS_PULL", { worldId: "w" });
    expect(held.payload).toEqual({ world: [], global: [] });
    expect((await state.commands(S))[0]?.status).toBe("pending");
    const next = await send("COMMANDS_PULL", { worldId: "w" });
    expect((next.payload as { world: unknown[] }).world).toHaveLength(1);
  });

  test("a launch reviewed on Setup carries the reviewed result once", async () => {
    const { state, send } = await setup();
    await state.setLaunchHold(S, "w", false, NOW, ["stagehand", "a"]);
    const first = await send("COMMANDS_PULL", { worldId: "w" });
    expect(first.payload).toMatchObject({ reviewed: ["stagehand", "a"] });
    expect((first.payload as { world: unknown[] }).world).toHaveLength(1);
    const next = await send("COMMANDS_PULL", { worldId: "w" });
    expect(next.payload).not.toHaveProperty("reviewed");
  });

  test("a hold for another world doesn't hold this one", async () => {
    const { state, send } = await setup();
    await state.setLaunchHold(S, "other", true, NOW);
    const pulled = await send("COMMANDS_PULL", { worldId: "w" });
    expect((pulled.payload as { world: unknown[] }).world).toHaveLength(1);
    expect((await state.launchHolds(S)).map((h) => h.worldId)).toEqual([
      "other",
    ]);
  });

  test("a hold older than ten minutes no longer holds, and is dropped", async () => {
    const { state, send } = await setup();
    await state.setLaunchHold(S, "w", true, "2026-11-06T11:49:00.000Z");
    const pulled = await send("COMMANDS_PULL", { worldId: "w" });
    expect((pulled.payload as { world: unknown[] }).world).toHaveLength(1);
    expect(await state.launchHolds(S)).toEqual([]);
  });

  test("oversized snapshots are refused", async () => {
    const { send } = await setup();
    const huge = snapshot(
      Array.from({ length: 5000 }, (_, i) => `m${String(i)}`),
    );
    expect((await send("SNAPSHOT_PUSH", huge)).type).toBe("ERROR");
  });

  test("inherited object keys are not handlers", async () => {
    const { send } = await setup();
    expect((await send("constructor", {})).type).toBe("ERROR");
    expect((await send("toString", {})).type).toBe("ERROR");
  });
});
