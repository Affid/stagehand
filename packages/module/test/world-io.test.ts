import { describe, expect, test, vi } from "vitest";
import { isFirstGamemaster } from "../src/gamemaster.ts";
import { createWorldIo, SAVED_HOOK } from "../src/world-io.ts";
import { fakeGame } from "./fakes.ts";

function setup(answer: () => Promise<Response>) {
  const fetchFn = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    answer(),
  );
  const updateSource = vi.fn();
  const callAll = vi.fn(() => true);
  const world = {
    id: "w1",
    title: "World",
    flags: { stagehand: { v: 1 } },
    updateSource,
  };
  const io = createWorldIo({
    fetch: fetchFn,
    route: (p) => `/base/${p}`,
    world,
    hooks: { callAll },
  });
  return { io, fetchFn, updateSource, callAll };
}

const json = (body: unknown, init: ResponseInit = {}): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), init));

describe("createWorldIo", () => {
  test("reads our flags from the page's world", () => {
    const { io } = setup(() => json({}));
    expect(io.flags()).toEqual({ v: 1 });
  });

  test("saves through Foundry's world edit, then updates the page's copy and tells", async () => {
    const { io, fetchFn, updateSource, callAll } = setup(() =>
      json({ id: "w1" }),
    );
    expect(await io.save({ queue: [] })).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("/base/setup");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      action: "editWorld",
      id: "w1",
      flags: { stagehand: { queue: [] } },
    });
    expect(updateSource).toHaveBeenCalledWith({
      flags: { stagehand: { queue: [] } },
    });
    expect(callAll).toHaveBeenCalledWith(SAVED_HOOK, { v: 1 });
  });

  test.each([
    ["an error status", () => json({}, { status: 403 })],
    ["Foundry's error answer", () => json({ error: "no" })],
    ["a network failure", () => Promise.reject(new Error("offline"))],
  ])("%s is a refused save, the page's copy untouched", async (_l, answer) => {
    const { io, updateSource } = setup(answer);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await io.save({ queue: [] })).toBe(false);
    expect(updateSource).not.toHaveBeenCalled();
  });

  test("a page copy that can't take the save still counts as saved", async () => {
    const { io, updateSource } = setup(() => json({ id: "w1" }));
    updateSource.mockImplementation(() => {
      throw new Error("validation");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await io.save({ queue: [] })).toBe(true);
  });

  test("requests never follow a redirect and give up in time", async () => {
    const { io, fetchFn } = setup(() => json({}));
    await io.save({ queue: [] });
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
    expect(fetchFn.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  test("a save too big for Foundry isn't sent", async () => {
    const { io, fetchFn } = setup(() => json({}));
    expect(await io.save({ pad: "x".repeat(100_000) })).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("the clock: the server's Date and the world's uptime", async () => {
    const { io, fetchFn } = setup(() =>
      json(
        { active: true, uptime: 60_000 },
        { headers: { Date: "Mon, 09 Nov 2026 20:01:00 GMT" } },
      ),
    );
    expect(await io.clock()).toEqual({
      now: Date.parse("2026-11-09T20:01:00Z"),
      worldStart: Date.parse("2026-11-09T20:00:00Z"),
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("/base/api/status");
  });

  test.each([
    ["no Date header", () => json({ uptime: 5 })],
    [
      "no uptime",
      () => json({}, { headers: { Date: "Mon, 09 Nov 2026 20:01:00 GMT" } }),
    ],
    ["a failure", () => Promise.reject(new Error("offline"))],
    [
      "an error status",
      () =>
        json(
          { uptime: 5 },
          { status: 500, headers: { Date: "Mon, 09 Nov 2026 20:01:00 GMT" } },
        ),
    ],
    [
      "a negative uptime",
      () =>
        json(
          { uptime: -5 },
          { headers: { Date: "Mon, 09 Nov 2026 20:01:00 GMT" } },
        ),
    ],
  ])("no clock with %s", async (_l, answer) => {
    const { io } = setup(answer);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await io.clock()).toBeUndefined();
  });
});

describe("isFirstGamemaster", () => {
  const gm = (id: string, active = true) => ({ id, role: 4, active });

  test("the only full Gamemaster runs it", () => {
    const { game } = fakeGame([], 4, [gm("u1")]);
    expect(isFirstGamemaster(game, 4)).toBe(true);
  });

  test("with two in the world, only the lowest id", () => {
    expect(
      isFirstGamemaster(fakeGame([], 4, [gm("u1"), gm("u0")]).game, 4),
    ).toBe(false);
    expect(
      isFirstGamemaster(fakeGame([], 4, [gm("u1"), gm("u2")]).game, 4),
    ).toBe(true);
  });

  test("a Gamemaster who isn't in the world doesn't count", () => {
    const { game } = fakeGame([], 4, [gm("u1"), gm("u0", false)]);
    expect(isFirstGamemaster(game, 4)).toBe(true);
  });

  test("Assistant GMs and players never run it", () => {
    expect(isFirstGamemaster(fakeGame([], 3).game, 4)).toBe(false);
    expect(isFirstGamemaster(fakeGame([], 1).game, 4)).toBe(false);
  });
});
