// The app's view of a running world (Android plan, phase 3, package 6):
// Foundry's status, the join page's world, closing the world.
import { describe, expect, test, vi } from "vitest";
import {
  closeWorld,
  fetchStatus,
  joinGame,
  joinUsers,
  joinWorld,
  parseStatus,
  uptimeParts,
} from "../../src/app/running/server.ts";

const STATUS = {
  active: true,
  version: "14.370",
  world: "strahd",
  system: "dnd5e",
  systemVersion: "6.0.6",
  users: 2,
  uptime: 6_000_000,
};

describe("parseStatus", () => {
  test("takes Foundry's status as 14.370 sends it", () => {
    expect(parseStatus(STATUS)).toEqual(STATUS);
    expect(parseStatus({ active: false })).toEqual({ active: false });
  });

  test("refuses anything else", () => {
    expect(parseStatus(null)).toBeUndefined();
    expect(parseStatus({ active: "yes" })).toBeUndefined();
    expect(parseStatus({ ...STATUS, users: -1 })).toBeUndefined();
  });
});

describe("joinWorld", () => {
  const game = {
    view: "join",
    world: { id: "strahd", title: "Curse of Strahd", background: "a.webp" },
  };

  test("the world from the join page's data", () => {
    expect(joinWorld(game)).toEqual({
      id: "strahd",
      title: "Curse of Strahd",
      background: "a.webp",
    });
  });

  test("nothing before Foundry has it, or on another page", () => {
    expect(joinWorld(undefined)).toBeUndefined();
    expect(joinWorld({ ...game, view: "game" })).toBeUndefined();
    expect(joinWorld({ view: "join", world: { id: "x" } })).toBeUndefined();
    expect(
      joinWorld({ view: "join", world: { ...game.world, background: 3 } }),
    ).toMatchObject({ background: undefined });
  });
});

test("uptimeParts: Foundry's uptime is milliseconds since the world started", () => {
  expect(uptimeParts(6_000_000)).toEqual({ h: 1, min: 40 });
  expect(uptimeParts(59_000)).toEqual({ h: 0, min: 0 });
  // Owner: 30 hours shown after a world ran 2 to 3 minutes.
  expect(uptimeParts(180_000)).toEqual({ h: 0, min: 3 });
});

const route = (p: string) => `/${p}`;

describe("fetchStatus", () => {
  test("asks the server's own status, uncached", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(STATUS))),
    );
    expect(await fetchStatus({ fetch, route })).toEqual(STATUS);
    expect(fetch).toHaveBeenCalledWith("/api/status", {
      cache: "no-store",
      credentials: "same-origin",
      signal: expect.any(AbortSignal) as unknown,
    });
  });

  test("a failed or odd answer is no status", async () => {
    const bad = vi.fn(() =>
      Promise.resolve(new Response("x", { status: 500 })),
    );
    expect(await fetchStatus({ fetch: bad, route })).toBeUndefined();
    const down = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await fetchStatus({ fetch: down, route })).toBeUndefined();
  });
});

describe("closeWorld", () => {
  const answer = (url: string, status = 200) => {
    const res = new Response("", { status });
    Object.defineProperty(res, "url", { value: url });
    return vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(res),
    );
  };

  test("Foundry lands on Setup: the world is closing", async () => {
    const fetch = answer("http://localhost:30000/setup");
    expect(await closeWorld({ fetch, route }, "pw")).toBe("closing");
    expect(fetch).toHaveBeenCalledWith("/setup", {
      method: "POST",
      credentials: "same-origin",
      signal: expect.any(AbortSignal) as unknown,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "worldShutdown", adminPassword: "pw" }),
    });
  });

  test("back on the join page: Foundry wants the password", async () => {
    const fetch = answer("http://localhost:30000/join");
    expect(await closeWorld({ fetch, route })).toBe("password");
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({
      action: "worldShutdown",
    });
  });

  test("Foundry 13 refuses /setup while a world runs: its join page closes it", async () => {
    const replies = [
      new Response("{}", { status: 403 }),
      new Response(JSON.stringify({ status: "success" })),
    ];
    const fetch = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(replies.shift() ?? new Response("", { status: 500 })),
    );
    expect(await closeWorld({ fetch, route }, "pw")).toBe("closing");
    expect(fetch.mock.calls[1]?.[0]).toBe("/join");
    expect(JSON.parse(fetch.mock.calls[1]?.[1]?.body as string)).toEqual({
      action: "shutdown",
      adminPassword: "pw",
    });
  });

  test("on 13, a message instead of success: the password; an error: failed", async () => {
    const twice = (second: Response) => {
      const replies = [new Response("{}", { status: 403 }), second];
      return vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(replies.shift() ?? new Response("", { status: 500 })),
      );
    };
    expect(
      await closeWorld({ fetch: twice(new Response("Wrong key")), route }),
    ).toBe("password");
    expect(
      await closeWorld({
        fetch: twice(new Response("", { status: 500 })),
        route,
      }),
    ).toBe("failed");
  });

  test("anything else failed", async () => {
    expect(
      await closeWorld({ fetch: answer("http://x/setup", 500), route }),
    ).toBe("failed");
    expect(
      await closeWorld({ fetch: answer("http://x/elsewhere"), route }),
    ).toBe("failed");
    const down = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await closeWorld({ fetch: down, route })).toBe("failed");
  });
});

describe("joinUsers", () => {
  test("the join page's users, Gamemasters first", () => {
    const users = new Map([
      ["p1", { id: "p1", name: "Player1", role: 1 }],
      ["a1", { id: "a1", name: "Assistant", role: 3 }],
      ["g1", { id: "g1", name: "Gamemaster", role: 4 }],
    ]);
    expect(joinUsers({ users })).toEqual([
      { id: "g1", name: "Gamemaster", gm: true, full: true },
      { id: "a1", name: "Assistant", gm: true, full: false },
      { id: "p1", name: "Player1", gm: false, full: false },
    ]);
  });

  test("nothing readable, no users", () => {
    expect(joinUsers(undefined)).toEqual([]);
    expect(joinUsers({ users: new Map([["x", { id: 3 }]]) })).toEqual([]);
  });
});

describe("joinGame", () => {
  const reply = (status: number, body: unknown) =>
    vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(body), { status })),
    );

  test("Foundry lets the user in: where it sends them", async () => {
    const fetch = reply(200, { message: "ok", redirect: "/game" });
    expect(await joinGame({ fetch, route }, "g1", "pw")).toEqual({
      kind: "joined",
      redirect: "/game",
    });
    expect(fetch).toHaveBeenCalledWith("/join", {
      method: "POST",
      credentials: "same-origin",
      signal: expect.any(AbortSignal) as unknown,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "g1",
        userid: "g1",
        password: "pw",
        action: "join",
      }),
    });
  });

  test("a wrong password, as 14.370 says it: plain text, not JSON (phase 7)", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response("JOIN.ErrorInvalidPassword", { status: 401 }),
      ),
    );
    expect(await joinGame({ fetch, route }, "g1", "x")).toEqual({
      kind: "password",
    });
  });

  test("Foundry refuses for another reason: its own message, not a password question", async () => {
    const text = vi.fn(() =>
      Promise.resolve(new Response("You are banned", { status: 401 })),
    );
    expect(await joinGame({ fetch: text, route }, "g1", "")).toEqual({
      kind: "refused",
      message: "You are banned",
    });
    const json = reply(403, { error: "Not now" });
    expect(await joinGame({ fetch: json, route }, "g1", "")).toEqual({
      kind: "refused",
      message: "Not now",
    });
  });

  test("a redirect elsewhere, or no answer, failed", async () => {
    expect(
      await joinGame(
        { fetch: reply(200, { redirect: "https://evil.example/" }), route },
        "g1",
        "",
      ),
    ).toEqual({ kind: "failed" });
    for (const sneaky of [
      "/\\evil.example",
      "/\tevil.example",
      "//evil.example",
      "/ok\\x",
    ])
      expect(
        await joinGame(
          { fetch: reply(200, { redirect: sneaky }), route },
          "g1",
          "",
        ),
      ).toEqual({ kind: "failed" });
    const broken = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await joinGame({ fetch: broken, route }, "g1", "")).toEqual({
      kind: "failed",
    });
  });
});
