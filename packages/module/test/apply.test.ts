import type { WorldCommand } from "@module-library/shared/world";
import { describe, expect, test, vi } from "vitest";
import { type ApplyDeps, applyCommands } from "../src/apply.ts";
import { diffHtml, escapeHtml } from "../src/dialog.ts";
import {
  moduleConfiguration,
  planFor,
  takeSnapshot,
} from "../src/world-state.ts";
import { fakeChannel, fakeDialog, fakeGame, ok } from "./fakes.ts";

const MODULES = [
  { id: "module-library", active: true },
  { id: "a", requires: ["lib"] },
  { id: "lib" },
  { id: "x", active: true },
  { id: "needs-x", active: true, requires: ["x"] },
  { id: "hates-a", conflicts: ["a"] },
];

const command = (over: Partial<WorldCommand> = {}): WorldCommand => ({
  id: "c1",
  mode: "add",
  presets: [{ id: "p1", name: "QoL" }],
  modules: ["a"],
  ...over,
});

function setup(dialogResult: unknown, form: Record<string, boolean> = {}) {
  const { game, set } = fakeGame(MODULES);
  const { channel, requests } = fakeChannel(() => ok());
  const { dialog, wait } = fakeDialog(dialogResult, form);
  const reload = vi.fn();
  const warn = vi.fn();
  const deps: ApplyDeps = {
    game,
    dialog,
    channel,
    reload,
    warn,
    now: () => new Date("2026-11-05T00:00:00Z"),
  };
  return { deps, set, requests, reload, warn, wait };
}

const acks = (requests: { type: string; payload: unknown }[]) =>
  requests.filter((r) => r.type === "COMMAND_ACK").map((r) => r.payload);

describe("world state", () => {
  test("the snapshot lists active modules with versions (C-2)", () => {
    const { game } = fakeGame(MODULES);
    expect(takeSnapshot(game, new Date("2026-11-05T00:00:00Z"))).toMatchObject({
      worldId: "w1",
      coreVersion: "14.369",
      active: [
        { id: "module-library", version: "1.0.0" },
        { id: "x", version: "1.0.0" },
        { id: "needs-x", version: "1.0.0" },
      ],
      takenAt: "2026-11-05T00:00:00.000Z",
    });
  });

  test("plans from live Module objects, adding requirements (C-4, C-6)", () => {
    const { game } = fakeGame(MODULES);
    const plan = planFor(game, [command()], false);
    expect(plan.dependencyAdditions).toEqual(["lib"]);
  });

  test("the configuration lists every module and always keeps the companion (C-5)", () => {
    const { game } = fakeGame(MODULES);
    expect(moduleConfiguration(game, ["a"])).toEqual({
      "module-library": true,
      a: true,
      lib: false,
      x: false,
      "needs-x": false,
      "hates-a": false,
    });
  });
});

describe("dialog", () => {
  test("escapes every value in the diff", () => {
    const { game } = fakeGame([{ id: "module-library", active: true }]);
    const plan = planFor(
      game,
      [command({ modules: ['<img src=x onerror="alert(1)">'] })],
      false,
    );
    const html = diffHtml(game, plan, [
      command({ presets: [{ id: "p", name: "<b>x</b>" }] }),
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>x");
    expect(escapeHtml(`<a href="x">'&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;",
    );
  });
});

describe("applyCommands (8.4, 8.5)", () => {
  test("Apply & reload: acknowledges with the target, writes the configuration, reloads once", async () => {
    const { deps, set, requests, reload } = setup("apply");
    expect(await applyCommands(deps, [command()])).toBe("applied");
    expect(acks(requests)).toEqual([
      {
        id: "c1",
        status: "applying",
        target: ["module-library", "x", "needs-x", "a", "lib"],
      },
    ]);
    expect(set).toHaveBeenCalledWith(
      "core",
      "moduleConfiguration",
      expect.objectContaining({ a: true, lib: true }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("Not now keeps the command pending: no ack, no change", async () => {
    const { deps, set, requests } = setup("later");
    expect(await applyCommands(deps, [command()])).toBe("later");
    expect(requests).toEqual([]);
    expect(set).not.toHaveBeenCalled();
  });

  test("closing the dialog counts as Not now", async () => {
    const { deps, requests } = setup(null);
    expect(await applyCommands(deps, [command()])).toBe("later");
    expect(requests).toEqual([]);
  });

  test("Discard declines every command", async () => {
    const { deps, requests } = setup("discard");
    expect(await applyCommands(deps, [command(), command({ id: "c2" })])).toBe(
      "discarded",
    );
    expect(acks(requests)).toEqual([
      { id: "c1", status: "declined" },
      { id: "c2", status: "declined" },
    ]);
  });

  test("conflicts need explicit consent (8.5 step 6)", async () => {
    const refused = setup("apply");
    const conflict = [command({ modules: ["a", "hates-a"] })];
    expect(await applyCommands(refused.deps, conflict)).toBe("blocked");
    expect(refused.warn).toHaveBeenCalledWith(
      "MODULE_LIBRARY.Apply.NeedConflictConsent",
    );
    expect(refused.set).not.toHaveBeenCalled();
    const accepted = setup("apply", { acceptConflicts: true });
    expect(await applyCommands(accepted.deps, conflict)).toBe("applied");
  });

  test("removing a needed module requires choosing to remove its dependents (8.5 step 5)", async () => {
    const remove = [command({ mode: "remove", modules: ["x"] })];
    const refused = setup("apply");
    expect(await applyCommands(refused.deps, remove)).toBe("blocked");
    expect(refused.warn).toHaveBeenCalledWith(
      "MODULE_LIBRARY.Apply.NeedDependentsChoice",
    );
    const chosen = setup("apply", { removeDependents: true });
    expect(await applyCommands(chosen.deps, remove)).toBe("applied");
    expect(chosen.set).toHaveBeenCalledWith(
      "core",
      "moduleConfiguration",
      expect.objectContaining({
        x: false,
        "needs-x": false,
        "module-library": true,
      }),
    );
  });

  test("no change: acknowledges and pushes a snapshot instead of reloading", async () => {
    const { deps, requests, reload } = setup("apply");
    expect(await applyCommands(deps, [command({ modules: ["x"] })])).toBe(
      "unchanged",
    );
    expect(requests.map((r) => r.type)).toEqual([
      "COMMAND_ACK",
      "SNAPSHOT_PUSH",
    ]);
    expect(reload).not.toHaveBeenCalled();
  });

  test("nothing queued: no dialog", async () => {
    const { deps, wait } = setup("apply");
    expect(await applyCommands(deps, [])).toBe("unchanged");
    expect(wait).not.toHaveBeenCalled();
  });
});
