// @vitest-environment happy-dom
// Installing the companion module from our page: Foundry's own installer
// with the published manifest, and nothing the UI could aim elsewhere.
import {
  COMPANION_ID,
  COMPANION_INSTALL_TASK,
  COMPANION_MANIFEST,
} from "@stagehand/shared/companion";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { parseUiToPage, type PageToUi } from "../../src/page-protocol.ts";
import { runFoundryAction } from "../../src/page/actions.ts";

const ACTION = { action: "installCompanion" } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function foundry(install?: (o: object) => Promise<unknown>) {
  const game = install ? { installPackage: vi.fn(install) } : {};
  const posted: PageToUi[] = [];
  const run = () =>
    runFoundryAction(document, { game } as never, ACTION, undefined, (m) =>
      posted.push(m),
    );
  /** Runs it to its end, past the wait for Foundry's package list. */
  const finish = async () => {
    const done = run();
    await vi.runAllTimersAsync();
    return done;
  };
  return { game, posted, run, finish };
}

const steps = (posted: readonly PageToUi[]): unknown[] =>
  posted.map((m) => (m.type === "PROGRESS" ? m.payload.step : m.type));

describe("the install request", () => {
  test("is accepted bare, and with nothing else", () => {
    expect(parseUiToPage("FOUNDRY_ACTION", ACTION)).toEqual({
      type: "FOUNDRY_ACTION",
      payload: ACTION,
    });
    // Nothing the UI adds can aim the installer elsewhere.
    for (const extra of [
      { manifest: "https://evil.example/module.json" },
      { id: "other" },
    ])
      expect(
        parseUiToPage("FOUNDRY_ACTION", { ...ACTION, ...extra })?.payload,
      ).toEqual(ACTION);
    expect(
      parseUiToPage("FOUNDRY_ACTION", { ...ACTION, worldId: "w1" }),
    ).toBeUndefined();
  });
});

describe("installing the companion", () => {
  test("runs Foundry's installer with the published manifest", async () => {
    const f = foundry(() => Promise.resolve({}));
    expect(await f.finish()).toBeUndefined();
    expect(f.game.installPackage).toHaveBeenCalledExactlyOnceWith({
      type: "module",
      id: COMPANION_ID,
      manifest: COMPANION_MANIFEST,
    });
  });

  test("tells our page it started and that it ended", async () => {
    const f = foundry(() => Promise.resolve({}));
    await f.finish();
    expect(steps(f.posted)).toEqual(["start", "complete"]);
    expect(f.posted[0]?.payload).toMatchObject({
      action: "installPackage",
      id: COMPANION_INSTALL_TASK,
      packageId: COMPANION_ID,
    });
  });

  test("the task outlasts Foundry's own progress, until its package list is read again", async () => {
    let installed = (): void => undefined;
    const f = foundry(
      () =>
        new Promise<void>((resolve) => {
          installed = resolve;
        }),
    );
    const done = f.run();
    installed();
    await vi.advanceTimersByTimeAsync(500);
    expect(steps(f.posted)).toEqual(["start"]);
    await vi.advanceTimersByTimeAsync(600);
    await done;
    expect(steps(f.posted)).toEqual(["start", "complete"]);
  });

  test("a second request while one runs starts nothing", async () => {
    const f = foundry(() => Promise.resolve({}));
    const first = f.run();
    expect(await f.run()).toBeUndefined();
    await vi.runAllTimersAsync();
    await first;
    expect(f.game.installPackage).toHaveBeenCalledOnce();
    expect(steps(f.posted)).toEqual(["start", "complete"]);
  });

  test("a failure Foundry has already reported ends the task without a second notice", async () => {
    const f = foundry(() => Promise.reject(new Error("no network")));
    expect(await f.run()).toBeUndefined();
    expect(steps(f.posted)).toEqual(["start", "complete"]);
  });

  test("says so when Foundry has no installer", async () => {
    const f = foundry();
    expect(await f.run()).toBe("Foundry's installer is missing");
    expect(f.posted).toEqual([]);
  });
});
