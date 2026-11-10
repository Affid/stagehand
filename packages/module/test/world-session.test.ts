import {
  activeKey,
  FORMAT,
  type QueueEntry,
  type Report,
} from "@stagehand/shared/world-flags";
import { describe, expect, test, vi } from "vitest";
import type { ServerClock, WorldIo } from "../src/world-io.ts";
import { runWorldSession, settle } from "../src/world-session.ts";
import { fakeDialog, fakeGame } from "./fakes.ts";

const MODULES = [
  { id: "stagehand", active: true },
  { id: "a" },
  { id: "x", active: true },
];
const START = Date.parse("2026-11-09T20:00:00.000Z");
const CLOCK: ServerClock = { now: START + 30_000, worldStart: START };

const entry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  id: "c1",
  mode: "add",
  presets: [],
  modules: ["a"],
  queuedAt: "2026-11-09T19:50:00.000Z",
  ...over,
});

type Flags = Record<string, unknown>;

/** Foundry's merge of a save, enough for our flags: "-=" keys delete. */
function merge(into: Flags, change: Flags): Flags {
  const gone = new Set(
    Object.keys(change)
      .filter((k) => k.startsWith("-="))
      .map((k) => k.slice(2)),
  );
  const set = Object.entries(change).filter(([k]) => !k.startsWith("-="));
  const kept = Object.entries(into).filter(([k]) => !gone.has(k));
  return Object.fromEntries([...kept, ...set]);
}

function setup(
  flags: Flags | undefined,
  opts: { dialog?: unknown; saves?: boolean; clock?: ServerClock | null } = {},
) {
  const { game, set } = fakeGame(MODULES);
  let stored: Flags | undefined = flags;
  const saves: Flags[] = [];
  const io: WorldIo = {
    flags: () => stored,
    save: vi.fn((change: object) => {
      saves.push(change as Flags);
      if (opts.saves === false) return Promise.resolve(false);
      stored = merge(stored ?? {}, change as Flags);
      return Promise.resolve(true);
    }),
    clock: () =>
      Promise.resolve(opts.clock === null ? undefined : (opts.clock ?? CLOCK)),
  };
  const reload = vi.fn();
  const warn = vi.fn();
  const info = vi.fn();
  const { dialog, wait } = fakeDialog(opts.dialog ?? "later");
  const deps = { game, dialog, io, reload, warn, info };
  return { deps, set, saves, reload, warn, wait, stored: () => stored };
}

const reportIn = (save: Flags | undefined): Report => save?.report as Report;

describe("settle", () => {
  test("applying ends applied when the world has the target", () => {
    const key = activeKey(["x", "a"]);
    expect(
      settle([{ id: "c1", status: "applying", targetKey: key }], ["a", "x"]),
    ).toEqual([{ id: "c1", status: "applied" }]);
  });

  test("and failed when it doesn't", () => {
    const [r] = settle(
      [{ id: "c1", status: "applying", targetKey: activeKey(["a"]) }],
      ["x"],
    );
    expect(r?.status).toBe("failed");
    expect(r?.error).toMatch(/differ/);
  });

  test("other results stay", () => {
    const declined = { id: "c2", status: "declined" as const };
    expect(settle([declined], [])).toEqual([declined]);
  });
});

describe("runWorldSession: the report", () => {
  test("a world with no flags gets a report of its modules", async () => {
    const { deps, saves } = setup(undefined);
    expect(await runWorldSession(deps)).toBe("idle");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.v).toBe(FORMAT);
    expect(reportIn(saves[0])).toEqual({
      at: new Date(CLOCK.now).toISOString(),
      companion: "1.0.0",
      core: "14.369",
      system: { id: "dnd5e", version: "5.1.0" },
      active: ["stagehand@1.0.0", "x@1.0.0"],
      versions: true,
      partial: false,
      launchId: null,
      results: [],
    });
  });

  test("the same report again is not saved (no write on every join)", async () => {
    const first = setup(undefined);
    await runWorldSession(first.deps);
    const again = setup(first.stored());
    await runWorldSession(again.deps);
    expect(again.saves).toEqual([]);
  });

  test("without the server's clock it still reports, by the page's time", async () => {
    const { deps, saves } = setup(undefined, { clock: null });
    await runWorldSession(deps);
    expect(reportIn(saves[0]).active).toHaveLength(2);
  });

  test("a newer format is left alone, said", async () => {
    const { deps, saves, warn } = setup({ v: FORMAT + 1, queue: [entry()] });
    expect(await runWorldSession(deps)).toBe("newer");
    expect(saves).toEqual([]);
    expect(warn).toHaveBeenCalledWith("STAGEHAND.Outdated");
  });

  test("after the reload, applying results settle and the launch's id stays", async () => {
    const report = {
      at: "2026-11-09T20:00:10.000Z",
      companion: "1.0.0",
      core: "14.369",
      system: { id: "dnd5e", version: "5.1.0" },
      active: [],
      versions: true,
      partial: false,
      launchId: "l1",
      results: [
        {
          id: "c1",
          status: "applying",
          targetKey: activeKey(["stagehand", "x"]),
        },
      ],
    };
    const { deps, saves } = setup({ v: 1, report });
    await runWorldSession(deps);
    expect(reportIn(saves[0])).toMatchObject({
      launchId: "l1",
      results: [{ id: "c1", status: "applied" }],
    });
  });
});

describe("runWorldSession: the queue", () => {
  test("asks the Gamemaster when not reviewed; Not now keeps the queue", async () => {
    const { deps, wait, stored } = setup({ v: 1, queue: [entry()] });
    expect(await runWorldSession(deps)).toBe("later");
    expect(wait).toHaveBeenCalled();
    expect(stored()?.queue).toEqual([entry()]);
  });

  test("Apply: the change leaves the queue as applying, then the world reloads", async () => {
    const { deps, saves, reload, set } = setup(
      { v: 1, queue: [entry(), entry({ id: "c2", modules: ["x"] })] },
      { dialog: "apply" },
    );
    expect(await runWorldSession(deps)).toBe("applied");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.queue).toEqual([]);
    expect(reportIn(saves[0]).results.map((r) => r.status)).toEqual([
      "applying",
      "applying",
    ]);
    expect(set).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("a reviewed launch of this start applies without asking, and is used up", async () => {
    const launch = {
      kind: "reviewed",
      id: "l1",
      at: "2026-11-09T19:59:30.000Z",
      target: ["stagehand", "x", "a"],
    };
    const { deps, wait, saves, stored } = setup({
      v: 1,
      queue: [entry()],
      launch,
    });
    expect(await runWorldSession(deps)).toBe("applied");
    expect(wait).not.toHaveBeenCalled();
    expect(saves[0]?.["-=launch"]).toBeNull();
    expect(reportIn(saves[0]).launchId).toBe("l1");
    expect(stored()?.launch).toBeUndefined();
  });

  test("a leftover reviewed launch (long before this start) asks, and goes", async () => {
    const launch = {
      kind: "reviewed",
      id: "l0",
      at: "2026-11-08T12:00:00.000Z",
      target: ["stagehand", "x", "a"],
    };
    const { deps, wait, stored } = setup({ v: 1, queue: [entry()], launch });
    expect(await runWorldSession(deps)).toBe("later");
    expect(wait).toHaveBeenCalled();
    expect(stored()?.launch).toBeUndefined();
    expect(stored()?.queue).toEqual([entry()]);
  });

  test("a launch held on Setup leaves the queue alone", async () => {
    const launch = { kind: "hold", id: "l2", at: "2026-11-09T19:59:50.000Z" };
    const { deps, wait, stored } = setup({ v: 1, queue: [entry()], launch });
    expect(await runWorldSession(deps)).toBe("idle");
    expect(wait).not.toHaveBeenCalled();
    expect(stored()?.queue).toEqual([entry()]);
    expect(stored()?.launch).toBeUndefined();
    expect(reportIn(stored()).launchId).toBe("l2");
  });

  test("without the server's clock no launch counts: the dialog asks", async () => {
    const launch = {
      kind: "reviewed",
      id: "l1",
      at: "2026-11-09T19:59:30.000Z",
      target: ["stagehand", "x", "a"],
    };
    const { deps, wait } = setup(
      { v: 1, queue: [entry()], launch },
      { clock: null },
    );
    await runWorldSession(deps);
    expect(wait).toHaveBeenCalled();
  });

  test("a save Foundry refuses changes nothing", async () => {
    const { deps, set, reload } = setup(
      { v: 1, queue: [entry()] },
      { dialog: "apply", saves: false },
    );
    expect(await runWorldSession(deps)).toBe("unsaved");
    expect(set).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  test("Discard: declined results, the queue emptied", async () => {
    const { deps, stored } = setup(
      { v: 1, queue: [entry()] },
      { dialog: "discard" },
    );
    expect(await runWorldSession(deps)).toBe("discarded");
    expect(stored()?.queue).toEqual([]);
    expect(reportIn(stored()).results).toEqual([
      { id: "c1", status: "declined" },
    ]);
  });

  test("a launch the last report answered isn't used again (quick restart)", async () => {
    const launch = {
      kind: "reviewed",
      id: "l1",
      at: "2026-11-09T19:59:30.000Z",
      target: ["stagehand", "x", "a"],
    };
    const report = {
      at: "2026-11-09T19:59:40.000Z",
      companion: "1.0.0",
      core: "14.369",
      system: { id: "dnd5e", version: "5.1.0" },
      active: [],
      versions: true,
      partial: false,
      launchId: "l1",
      results: [],
    };
    const { deps, wait } = setup({ v: 1, queue: [entry()], launch, report });
    await runWorldSession(deps);
    expect(wait).toHaveBeenCalled();
  });

  test("an unreadable queue is said, and nothing is applied", async () => {
    const { deps, warn, wait } = setup({ v: 1, queue: [{ id: "" }] });
    expect(await runWorldSession(deps)).toBe("idle");
    expect(warn).toHaveBeenCalledWith("STAGEHAND.BadQueue");
    expect(wait).not.toHaveBeenCalled();
  });

  test("earlier results stay beside new ones, settled", async () => {
    const report = {
      at: "2026-11-09T19:00:00.000Z",
      companion: "1.0.0",
      core: "14.369",
      system: { id: "dnd5e", version: "5.1.0" },
      active: [],
      versions: true,
      partial: false,
      launchId: null,
      results: [{ id: "old", status: "applying", targetKey: "nope" }],
    };
    const { deps, stored } = setup(
      { v: 1, queue: [entry()], report },
      { dialog: "discard" },
    );
    await runWorldSession(deps);
    expect(reportIn(stored()).results.map((r) => [r.id, r.status])).toEqual([
      ["c1", "declined"],
      ["old", "failed"],
    ]);
  });
});
