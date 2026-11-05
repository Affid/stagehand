import { describe, expect, test } from "vitest";
import {
  emptyLibrary,
  type Library,
} from "@module-library/shared/library/schema";
import type { Command } from "@module-library/shared/world";
import {
  acknowledge,
  activeIdsKey,
  cancel,
  expandForWorld,
  pendingFor,
  queue,
  reconcile,
} from "../../src/background/commands.ts";

const command = (over: Partial<Command> = {}): Command => ({
  id: "c1",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: ["p1"] },
  createdAt: "2026-11-05T00:00:00Z",
  baseSnapshotAt: null,
  status: "pending",
  ...over,
});

describe("queue and cancel (P-5)", () => {
  test("queue appends a pending command", () => {
    const list = queue([], {
      id: "c9",
      worldId: "w1",
      mode: "replace",
      presetIds: ["p1", "p2"],
      createdAt: "now",
      baseSnapshotAt: "then",
    });
    expect(list).toEqual([
      command({
        id: "c9",
        payload: { mode: "replace", presetIds: ["p1", "p2"] },
        createdAt: "now",
        baseSnapshotAt: "then",
      }),
    ]);
  });

  test("cancel only affects a pending command", () => {
    const list = [command(), command({ id: "c2", status: "applying" })];
    const next = cancel(list, "c1");
    expect(next.map((c) => c.status)).toEqual(["cancelled", "applying"]);
    expect(cancel(list, "c2")).toEqual(list);
  });
});

describe("pendingFor and expandForWorld (P-6)", () => {
  const library: Library = {
    ...emptyLibrary("s"),
    presets: [
      {
        id: "p1",
        name: "QoL",
        description: "",
        modules: ["a", "b"],
        source: "user",
        revision: 1,
      },
    ],
  };

  test("returns this world's pending commands in queue order", () => {
    const list = [
      command({ id: "1" }),
      command({ id: "2", worldId: "w2" }),
      command({ id: "3", status: "applied" }),
      command({ id: "4" }),
    ];
    expect(pendingFor(list, "w1").map((c) => c.id)).toEqual(["1", "4"]);
  });

  test("expands presets to module ids from the current library", () => {
    const expanded = expandForWorld(
      [command({ payload: { mode: "add", presetIds: ["p1", "gone"] } })],
      library,
    );
    expect(expanded).toEqual([
      {
        id: "c1",
        mode: "add",
        presets: [{ id: "p1", name: "QoL" }],
        modules: ["a", "b"],
      },
    ]);
  });
});

describe("acknowledge and reconcile (8.4 two-phase)", () => {
  test("applying records the target key without touching others", () => {
    const list = [command(), command({ id: "c2" })];
    const next = acknowledge(list, {
      id: "c1",
      status: "applying",
      target: ["b", "a"],
    });
    expect(next[0]).toMatchObject({
      status: "applying",
      targetKey: activeIdsKey(["a", "b"]),
    });
    expect(next[1]).toBe(list[1]);
    expect(list[0]?.status).toBe("pending");
  });

  test("ignores acks for unknown or already finished commands", () => {
    const list = [command({ status: "cancelled" })];
    expect(acknowledge(list, { id: "c1", status: "declined" })).toEqual(list);
    expect(acknowledge(list, { id: "nope", status: "declined" })).toEqual(list);
  });

  test("an applying command becomes applied when the snapshot reaches its target", () => {
    const list = [
      command({ status: "applying", targetKey: activeIdsKey(["a", "b"]) }),
    ];
    expect(
      reconcile(list, { worldId: "w1", active: ["b", "a"] })[0]?.status,
    ).toBe("applied");
  });

  test("and failed, with a reason, when it does not", () => {
    const list = [command({ status: "applying", targetKey: "a" })];
    expect(reconcile(list, { worldId: "w1", active: ["x"] })[0]).toMatchObject({
      status: "failed",
      error: expect.any(String),
    });
  });

  test("leaves other worlds and states alone", () => {
    const list = [
      command({ status: "applying", worldId: "w2", targetKey: "a" }),
      command({ id: "c2" }),
    ];
    expect(reconcile(list, { worldId: "w1", active: ["a"] })).toEqual(list);
  });
});
