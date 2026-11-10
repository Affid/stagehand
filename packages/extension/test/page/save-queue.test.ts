import { describe, expect, test, vi } from "vitest";
import { parseQueueDone, parseSaveQueue } from "../../src/page-queue.ts";
import { saveQueue } from "../../src/page/save-queue.ts";

const DATE = "Mon, 09 Nov 2026 20:00:00 GMT";

function foundry(
  over: {
    post?: () => Promise<unknown>;
    date?: string | null;
    render?: () => Promise<unknown>;
    updateSource?: () => void;
  } = {},
) {
  const world = { id: "w", updateSource: vi.fn(over.updateSource) };
  const post = vi.fn(over.post ?? (() => Promise.resolve({ id: "w" })));
  const render = vi.fn(over.render ?? (() => Promise.resolve()));
  const page = {
    game: {
      worlds: {
        values: () => [].values(),
        get: (id: string) => (id === "w" ? world : undefined),
      },
      post,
    },
    ui: { setupPackages: { render } },
    foundry: { utils: { getRoute: (p: string) => `/vtt/${p}` } },
  };
  const date = over.date === undefined ? DATE : over.date;
  const fetchFn = vi.fn(() =>
    Promise.resolve(
      new Response("{}", { headers: date ? { Date: date } : {} }),
    ),
  );
  const deps = { page, fetch: fetchFn as unknown as typeof fetch };
  return { deps, world, post, render, fetchFn };
}

const entry = {
  id: "c1",
  mode: "add" as const,
  presets: [],
  modules: ["a"],
  queuedAt: "2026-11-09T19:00:00.000Z",
};

describe("saving a world's queue in its flags", () => {
  test("the queue, stamped with the server's time; Setup's copy updated and re-rendered", async () => {
    const f = foundry();
    const req = { requestId: "r1", worldId: "w", queue: [entry] };
    expect(await saveQueue(f.deps, req)).toEqual({
      written: "2026-11-09T20:00:00.000Z",
    });
    const flags = {
      stagehand: { v: 1, queue: [entry], written: "2026-11-09T20:00:00.000Z" },
    };
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      flags,
    });
    expect(f.world.updateSource).toHaveBeenCalledWith({ flags });
    expect(f.render).toHaveBeenCalled();
  });

  test("a launch's intent is stamped with the server's clock", async () => {
    const f = foundry();
    await saveQueue(f.deps, {
      requestId: "r1",
      worldId: "w",
      queue: [entry],
      launch: { kind: "reviewed", id: "l1", target: ["a"] },
    });
    expect(f.fetchFn).toHaveBeenCalledWith("/vtt/api/status", {
      cache: "no-store",
    });
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      flags: {
        stagehand: {
          v: 1,
          queue: [entry],
          written: "2026-11-09T20:00:00.000Z",
          launch: {
            kind: "reviewed",
            id: "l1",
            target: ["a"],
            at: "2026-11-09T20:00:00.000Z",
          },
        },
      },
    });
  });

  test("without the server's clock an intent can't be saved: said, nothing written", async () => {
    const f = foundry({ date: null });
    const r = await saveQueue(f.deps, {
      requestId: "r1",
      worldId: "w",
      launch: { kind: "hold", id: "l1" },
    });
    expect(r.error).toMatch(/time/);
    expect(f.post).not.toHaveBeenCalled();
  });

  test("without the server's clock the queue is still written, unstamped", async () => {
    const f = foundry({ date: null });
    expect(
      await saveQueue(f.deps, { requestId: "r", worldId: "w", queue: [entry] }),
    ).toEqual({});
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      flags: { stagehand: { v: 1, queue: [entry] } },
    });
  });

  test("a null launch takes any intent away", async () => {
    const f = foundry();
    expect(
      await saveQueue(f.deps, { requestId: "r1", worldId: "w", launch: null }),
    ).toEqual({});
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      flags: { stagehand: { v: 1, "-=launch": null } },
    });
  });

  test("an unknown world, a refusal, or too much is an error, never a throw", async () => {
    const f = foundry({ post: () => Promise.reject(new Error("refused")) });
    expect(
      (await saveQueue(f.deps, { requestId: "r", worldId: "x" })).error,
    ).toMatch(/No world/);
    expect(
      await saveQueue(f.deps, { requestId: "r", worldId: "w", queue: [entry] }),
    ).toEqual({ error: "refused" });
    const big = Array.from({ length: 40 }, (_, i) => ({
      ...entry,
      id: `c${String(i)}`,
      modules: Array.from(
        { length: 30 },
        (_, j) => `m-${String(j)}-${"x".repeat(60)}`,
      ),
    }));
    expect(
      (await saveQueue(f.deps, { requestId: "r", worldId: "w", queue: big }))
        .error,
    ).toMatch(/Too many/);
  });

  test("once saved, a failing redraw of Foundry's Setup (an older WebView) is still a save, and logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const render = (): Promise<unknown> =>
      Promise.reject(new TypeError("RegExp.escape is not a function"));
    const req = { requestId: "r", worldId: "w", queue: [entry] };
    expect(await saveQueue(foundry({ render }).deps, req)).toEqual({
      written: "2026-11-09T20:00:00.000Z",
    });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  test("once saved, a failing copy into Setup is still a save, logged, and Setup still redrawn", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const updateSource = (): void => {
      throw new Error("bad copy");
    };
    const f = foundry({ updateSource });
    const req = { requestId: "r", worldId: "w", queue: [entry] };
    expect(await saveQueue(f.deps, req)).toEqual({
      written: "2026-11-09T20:00:00.000Z",
    });
    expect(f.render).toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  test("Setup without Foundry's post says so", async () => {
    const f = foundry();
    const page = { ...f.deps.page, game: { worlds: f.deps.page.game.worlds } };
    expect(
      (
        await saveQueue(
          { ...f.deps, page },
          { requestId: "r", worldId: "w", queue: [] },
        )
      ).error,
    ).toMatch(/can't save/);
  });
});

describe("parseSaveQueue", () => {
  test("accepts a queue and an intent", () => {
    const req = {
      requestId: "r1",
      worldId: "w",
      queue: [entry],
      launch: { kind: "hold", id: "l1" },
    };
    expect(parseSaveQueue(req)).toEqual(req);
  });

  test.each([
    ["a bad request id", { requestId: "<x>", worldId: "w" }],
    ["no world", { requestId: "r1" }],
    ["a bad entry", { requestId: "r1", worldId: "w", queue: [{ id: "" }] }],
    [
      "an intent dated by the UI",
      { requestId: "r1", worldId: "w", launch: { kind: "elsewhere", id: "l" } },
    ],
  ])("refuses %s", (_label, p) => {
    expect(parseSaveQueue(p)).toBeUndefined();
  });
});

describe("parseQueueDone", () => {
  test("a write's time or an error, nothing else", () => {
    expect(
      parseQueueDone({ requestId: "r1", written: "2026-11-09T20:00:00.000Z" }),
    ).toEqual({ requestId: "r1", written: "2026-11-09T20:00:00.000Z" });
    expect(parseQueueDone({ requestId: "r1", error: "no" })).toEqual({
      requestId: "r1",
      error: "no",
    });
    expect(
      parseQueueDone({ requestId: "r1", written: "soon" }),
    ).toBeUndefined();
    expect(parseQueueDone({ requestId: "<", error: "no" })).toBeUndefined();
  });
});
