import { describe, expect, test } from "vitest";
import {
  emptyLibrary,
  type Library,
} from "@module-library/shared/library/schema";
import type { Command } from "@module-library/shared/world";
import type {
  QueueEntry,
  StagehandFlags,
} from "@module-library/shared/world-flags";
import {
  cancel,
  MAX_CLOSED_PER_WORLD,
  markInWorld,
  pendingFor,
  queue,
  syncFromWorld,
  toQueue,
} from "../../src/background/commands.ts";

const NOW = "2026-11-09T12:00:00.000Z";

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

describe("pendingFor and toQueue (P-6)", () => {
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
    const expanded = toQueue(
      [command({ payload: { mode: "add", presetIds: ["p1", "gone"] } })],
      library,
      NOW,
    );
    expect(expanded).toEqual([
      {
        id: "c1",
        mode: "add",
        presets: [{ id: "p1", name: "QoL" }],
        modules: ["a", "b"],
        queuedAt: "2026-11-05T00:00:00.000Z",
      },
    ]);
  });

  test("a change from another device keeps its preset names", () => {
    const [e] = toQueue(
      [
        command({
          createdAt: "not a time",
          payload: {
            mode: "add",
            presetIds: [],
            modules: ["a"],
            presets: [{ id: "far", name: "Far preset" }],
          },
        }),
      ],
      library,
      NOW,
    );
    expect(e?.presets).toEqual([{ id: "far", name: "Far preset" }]);
    expect(e?.queuedAt).toBe(NOW);
  });

  test("modules picked one by one join the presets' modules", () => {
    const expanded = toQueue(
      [
        command({
          payload: { mode: "remove", presetIds: ["p1"], modules: ["b", "c"] },
        }),
        command({
          id: "c2",
          payload: { mode: "add", presetIds: [], modules: ["d"] },
        }),
      ],
      library,
      NOW,
    );
    expect(expanded.map((c) => c.modules)).toEqual([["a", "b", "c"], ["d"]]);
    expect(expanded[1]?.presets).toEqual([]);
  });

  test("queue keeps picked modules on the command", () => {
    const [c] = queue([], {
      id: "c9",
      worldId: "w1",
      mode: "add",
      presetIds: [],
      modules: ["x"],
      createdAt: "now",
      baseSnapshotAt: null,
    });
    expect(c?.payload).toEqual({ mode: "add", presetIds: [], modules: ["x"] });
  });
});

describe("syncFromWorld (the world's queue and report)", () => {
  const entry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
    id: "far1",
    mode: "add",
    presets: [{ id: "px", name: "Far" }],
    modules: ["m1", "m2"],
    queuedAt: "2026-11-09T10:00:00.000Z",
    ...over,
  });
  const flags = (over: Partial<StagehandFlags> = {}): StagehandFlags => ({
    newer: false,
    queue: [],
    ...over,
  });
  const report = (
    results: NonNullable<StagehandFlags["report"]>["results"],
  ) => ({
    at: "2026-11-09T20:00:00.000Z",
    companion: "0.2.0",
    core: "14.370",
    system: { id: "dnd5e", version: "6.0.6" },
    active: [],
    versions: true,
    partial: false,
    launchId: null,
    results,
  });

  const W = { inWorld: true, inWorldAt: "2026-11-09T12:00:00.000Z" };

  test("results from the report close our changes written into the world", () => {
    const list = [
      command({ id: "c1", ...W }),
      command({ id: "c2", ...W }),
      command({ id: "c3", status: "applying", ...W }),
      command({ id: "c4", ...W }),
    ];
    const synced = syncFromWorld(
      list,
      "w1",
      flags({
        queue: [entry({ id: "c4" })],
        report: report([
          { id: "c1", status: "applied" },
          { id: "c2", status: "failed", error: "nope" },
          { id: "c3", status: "declined" },
          { id: "c4", status: "applying", targetKey: "k" },
        ]),
      }),
      NOW,
    );
    expect(synced.map((c) => [c.id, c.status, c.error, c.targetKey])).toEqual([
      ["c1", "applied", undefined, undefined],
      ["c2", "failed", "nope", undefined],
      ["c3", "declined", undefined, undefined],
      ["c4", "applying", undefined, "k"],
    ]);
  });

  test("a result for a change never written into the world is ignored (security review)", () => {
    const list = [command({ id: "c1" })];
    const synced = syncFromWorld(
      list,
      "w1",
      flags({ report: report([{ id: "c1", status: "applied" }]) }),
      NOW,
    );
    expect(synced).toEqual(list);
  });

  test("gone from the queue by a later write: removed on another device", () => {
    const synced = syncFromWorld(
      [command({ id: "c1", ...W })],
      "w1",
      flags({ written: "2026-11-09T13:00:00.000Z" }),
      NOW,
    );
    expect(synced[0]?.status).toBe("cancelled");
  });

  test("gone by our own write's time: the companion took it, its result wasn't kept", () => {
    const [c] = syncFromWorld(
      [command({ id: "c1", ...W })],
      "w1",
      flags({ written: W.inWorldAt }),
      NOW,
    );
    expect(c?.status).toBe("failed");
    expect(c?.error).toMatch(/no longer says/);
  });

  test("read from before our write, or with no times to compare: left as it is", () => {
    const list = [
      command({ id: "c1", ...W }),
      command({ id: "c2", inWorld: true }),
    ];
    expect(
      syncFromWorld(
        list,
        "w1",
        flags({ written: "2026-11-09T11:00:00.000Z" }),
        NOW,
      ),
    ).toEqual(list);
    expect(syncFromWorld(list, "w1", flags(), NOW)).toEqual(list);
  });

  test("changes queued on another device join as picked modules, dated when imported", () => {
    const synced = syncFromWorld(
      [],
      "w1",
      flags({
        queue: [
          entry({
            queuedAt: "2000-01-01T00:00:00.000Z",
            presets: [{ id: "px", name: "Far\u202e\u0007" }],
          }),
        ],
      }),
      NOW,
    );
    expect(synced).toEqual([
      {
        id: "far1",
        scope: "world",
        worldId: "w1",
        type: "preset.apply",
        payload: {
          mode: "add",
          presetIds: [],
          modules: ["m1", "m2"],
          presets: [{ id: "px", name: "Far" }],
        },
        createdAt: NOW,
        baseSnapshotAt: null,
        status: "pending",
        inWorld: true,
      },
    ]);
  });

  test("other worlds, closed changes and known ids are left alone", () => {
    const list = [
      command({ id: "c1", worldId: "w2", ...W }),
      command({ id: "c2", status: "applied", ...W }),
      command({ id: "far1", ...W }),
    ];
    const synced = syncFromWorld(list, "w1", flags({ queue: [entry()] }), NOW);
    expect(synced).toEqual(list);
  });

  test("an unreadable queue or a newer format changes nothing it can't vouch for", () => {
    const list = [command({ id: "c1", ...W })];
    const later = { written: "2026-11-09T13:00:00.000Z" };
    expect(
      syncFromWorld(list, "w1", flags({ unreadable: true, ...later }), NOW),
    ).toEqual(list);
    expect(
      syncFromWorld(list, "w1", flags({ newer: true, queue: [entry()] }), NOW),
    ).toEqual(list);
  });

  test("a world's closed history stays bounded, oldest going first", () => {
    const closed = Array.from({ length: MAX_CLOSED_PER_WORLD + 5 }, (_, i) =>
      command({ id: `old${String(i)}`, status: "applied" }),
    );
    const open = command({ id: "open" });
    const synced = syncFromWorld([...closed, open], "w1", flags(), NOW);
    expect(synced).toHaveLength(MAX_CLOSED_PER_WORLD + 1);
    expect(synced[0]?.id).toBe("old5");
    expect(synced.at(-1)?.id).toBe("open");
  });
});

describe("markInWorld", () => {
  test("marks only this world's pending changes named", () => {
    const list = [
      command({ id: "c1" }),
      command({ id: "c2" }),
      command({ id: "c3", status: "applied" }),
      command({ id: "c1b", worldId: "w2" }),
    ];
    const marked = markInWorld(list, "w1", ["c1", "c3", "c1b"], NOW);
    expect(marked.map((c) => c.inWorld === true)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(marked[0]?.inWorldAt).toBe(NOW);
    expect(markInWorld(list, "w1", ["c1"])[0]).not.toHaveProperty("inWorldAt");
  });
});
