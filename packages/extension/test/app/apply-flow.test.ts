// @vitest-environment happy-dom
// Our running page after a launch with changes (Android plan, phase 7): it
// joins as the world's Gamemaster by Foundry's own request, asks for the
// password only when Foundry wants one, and hands over to native.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type ApplyFlowDeps,
  applyAtStart,
  joinAndHandOver,
} from "../../src/app/running/apply-flow.ts";
import {
  currentLaunchNote,
  updateLaunchNote,
  writeLaunchNote,
} from "../../src/app/launch-note.ts";
import type { JoinResult } from "../../src/app/running/server.ts";

afterEach(() => {
  sessionStorage.clear();
});

const WORLD = { id: "w", title: "Strahd" };
const game = {
  users: new Map([
    ["a", { id: "a", name: "Assistant", role: 3 }],
    ["g", { id: "g", name: "Gamemaster", role: 4 }],
  ]),
};

function deps(over: Partial<ApplyFlowDeps> = {}): ApplyFlowDeps {
  return {
    store: sessionStorage,
    world: WORLD,
    game: () => game,
    join: vi.fn(() =>
      Promise.resolve<JoinResult>({ kind: "joined", redirect: "/game" }),
    ),
    start: vi.fn(() => Promise.resolve()),
    go: vi.fn(),
    ...over,
  };
}

describe("applyAtStart: what the page shows as it opens", () => {
  test("no note or no changes: nothing to apply", () => {
    expect(applyAtStart(deps())).toBeUndefined();
    writeLaunchNote(sessionStorage, "w", 0);
    expect(applyAtStart(deps())).toBeUndefined();
  });

  test("changes waiting: apply them; a result: say it; handed over without one: it didn't finish", () => {
    writeLaunchNote(sessionStorage, "w", 2);
    expect(applyAtStart(deps())).toEqual({ kind: "start", n: 2 });
    updateLaunchNote(sessionStorage, { applyingAt: Date.now() });
    expect(applyAtStart(deps())).toMatchObject({ kind: "failed", n: 2 });
    updateLaunchNote(sessionStorage, { result: { ok: true } });
    expect(applyAtStart(deps())).toEqual({ kind: "applied", n: 2 });
    updateLaunchNote(sessionStorage, { result: { ok: false, reason: "No" } });
    expect(applyAtStart(deps())).toEqual({
      kind: "failed",
      n: 2,
      reason: "No",
    });
  });
});

describe("joinAndHandOver", () => {
  test("joins as the full Gamemaster with no password, then hands over to native", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const d = deps();
    expect(await joinAndHandOver(d, 2, "")).toEqual({ kind: "applying", n: 2 });
    expect(d.join).toHaveBeenCalledWith("g", "");
    expect(d.start).toHaveBeenCalledWith("Strahd", 2);
    expect(d.go).toHaveBeenCalledWith("/game");
    expect(currentLaunchNote(sessionStorage)?.applyingAt).toBeTypeOf("number");
  });

  test("Foundry wants a password: the page asks for it, naming the user", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const d = deps({
      join: vi.fn(() =>
        Promise.resolve<JoinResult>({ kind: "refused", message: "Wrong" }),
      ),
    });
    expect(await joinAndHandOver(d, 2, "")).toEqual({
      kind: "password",
      n: 2,
      user: "Gamemaster",
      wrong: false,
    });
    expect(await joinAndHandOver(d, 2, "typed")).toEqual({
      kind: "password",
      n: 2,
      user: "Gamemaster",
      wrong: true,
    });
    expect(d.go).not.toHaveBeenCalled();
  });

  test("no full Gamemaster, or no answer: why, and the result kept for later visits", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const none = deps({ game: () => ({ users: new Map() }) });
    expect(await joinAndHandOver(none, 2, "")).toMatchObject({
      kind: "failed",
    });
    expect(currentLaunchNote(sessionStorage)?.result?.ok).toBe(false);
    sessionStorage.clear();
    writeLaunchNote(sessionStorage, "w", 2);
    const silent = deps({
      join: vi.fn(() => Promise.resolve<JoinResult>({ kind: "failed" })),
    });
    expect(await joinAndHandOver(silent, 2, "")).toMatchObject({
      kind: "failed",
    });
  });

  test("native can't apply out of sight: said, and the page stays", async () => {
    writeLaunchNote(sessionStorage, "w", 2);
    const d = deps({
      start: vi.fn(() => Promise.reject(new Error("refused"))),
    });
    expect(await joinAndHandOver(d, 2, "")).toMatchObject({ kind: "failed" });
    expect(d.go).not.toHaveBeenCalled();
  });
});
