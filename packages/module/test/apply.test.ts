import type { WorldCommand } from "@module-library/shared/world";
import { describe, expect, test, vi } from "vitest";
import type { Result } from "@module-library/shared/world-flags";
import { activeKey } from "@module-library/shared/world-flags";
import { type ApplyDeps, applyCommands } from "../src/apply.ts";
import { diffHtml, escapeHtml } from "../src/dialog.ts";
import {
  activeModules,
  moduleConfiguration,
  planFor,
} from "../src/world-state.ts";
import { fakeDialog, fakeGame } from "./fakes.ts";

const MODULES = [
  { id: "stagehand", active: true },
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

function setup(
  dialogResult: unknown,
  form: Record<string, boolean> = {},
  saves = true,
  modules: Parameters<typeof fakeGame>[0] = MODULES,
) {
  const { game, set } = fakeGame(modules);
  const records: Result[][] = [];
  const record = vi.fn((results: readonly Result[]) => {
    records.push([...results]);
    return Promise.resolve(saves);
  });
  const { dialog, wait } = fakeDialog(dialogResult, form);
  const reload = vi.fn();
  const warn = vi.fn();
  const info = vi.fn();
  const deps: ApplyDeps = { game, dialog, record, reload, warn, info };
  return { deps, set, records, reload, warn, info, wait };
}

describe("world state", () => {
  test("lists active modules with versions (C-2)", () => {
    const { game } = fakeGame(MODULES);
    expect(activeModules(game)).toEqual([
      { id: "stagehand", version: "1.0.0" },
      { id: "x", version: "1.0.0" },
      { id: "needs-x", version: "1.0.0" },
    ]);
  });

  test("plans from live Module objects, adding requirements (C-4, C-6)", () => {
    const { game } = fakeGame(MODULES);
    const plan = planFor(game, [command()], false);
    expect(plan.dependencyAdditions).toEqual(["lib"]);
  });

  test("the configuration lists every module and always keeps the companion (C-5)", () => {
    const { game } = fakeGame(MODULES);
    expect(moduleConfiguration(game, ["a"])).toEqual({
      stagehand: true,
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
    const { game } = fakeGame([{ id: "stagehand", active: true }]);
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

describe("dialog: preset names from the queue", () => {
  test("a few are listed, then a count", () => {
    const { game } = fakeGame(MODULES);
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `p${String(i)}`,
      name: `Preset ${String(i)}`,
    }));
    const plan = planFor(game, [command({ presets: many })], false);
    const html = diffHtml(game, plan, [command({ presets: many })]);
    expect(html).toContain("Preset 9");
    expect(html).not.toContain("Preset 10");
    expect(html).toContain("+5");
  });
});

describe("applyCommands (8.4, 8.5)", () => {
  test("Apply & reload: records applying with the target's key, writes the configuration, reloads once", async () => {
    const { deps, set, records, reload } = setup("apply");
    expect(await applyCommands(deps, [command()])).toBe("applied");
    expect(records).toEqual([
      [
        {
          id: "c1",
          status: "applying",
          targetKey: activeKey(["stagehand", "x", "needs-x", "a", "lib"]),
        },
      ],
    ]);
    expect(set).toHaveBeenCalledWith(
      "core",
      "moduleConfiguration",
      expect.objectContaining({ a: true, lib: true }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("Not now keeps the command queued: no record, no change", async () => {
    const { deps, set, records } = setup("later");
    expect(await applyCommands(deps, [command()])).toBe("later");
    expect(records).toEqual([]);
    expect(set).not.toHaveBeenCalled();
  });

  test("closing the dialog counts as Not now", async () => {
    const { deps, records } = setup(null);
    expect(await applyCommands(deps, [command()])).toBe("later");
    expect(records).toEqual([]);
  });

  test("Discard declines every command", async () => {
    const { deps, records } = setup("discard");
    expect(await applyCommands(deps, [command(), command({ id: "c2" })])).toBe(
      "discarded",
    );
    expect(records).toEqual([
      [
        { id: "c1", status: "declined" },
        { id: "c2", status: "declined" },
      ],
    ]);
  });

  test("conflicts need explicit consent (8.5 step 6)", async () => {
    const refused = setup("apply");
    const conflict = [command({ modules: ["a", "hates-a"] })];
    expect(await applyCommands(refused.deps, conflict)).toBe("blocked");
    expect(refused.warn).toHaveBeenCalledWith(
      "STAGEHAND.Apply.NeedConflictConsent",
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
      "STAGEHAND.Apply.NeedDependentsChoice",
    );
    const chosen = setup("apply", { removeDependents: true });
    expect(await applyCommands(chosen.deps, remove)).toBe("applied");
    expect(chosen.set).toHaveBeenCalledWith(
      "core",
      "moduleConfiguration",
      expect.objectContaining({
        x: false,
        "needs-x": false,
        stagehand: true,
      }),
    );
  });

  test("no change: records applied at once instead of reloading", async () => {
    const { deps, records, reload } = setup("apply");
    expect(await applyCommands(deps, [command({ modules: ["x"] })])).toBe(
      "unchanged",
    );
    expect(records).toEqual([[{ id: "c1", status: "applied" }]]);
    expect(reload).not.toHaveBeenCalled();
  });

  test("nothing queued: no dialog", async () => {
    const { deps, wait } = setup("apply");
    expect(await applyCommands(deps, [])).toBe("unchanged");
    expect(wait).not.toHaveBeenCalled();
  });
});

describe("applyCommands: review fixes", () => {
  test("nothing changes when the record can't be saved", async () => {
    const { deps, set, reload, warn } = setup("apply", {}, false);
    expect(await applyCommands(deps, [command()])).toBe("unsaved");
    expect(set).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("STAGEHAND.Apply.Unsaved");
  });

  test("an unsaved discard or no-change says so too", async () => {
    const discard = setup("discard", {}, false);
    expect(await applyCommands(discard.deps, [command()])).toBe("unsaved");
    const same = setup("apply", {}, false);
    expect(await applyCommands(same.deps, [command({ modules: ["x"] })])).toBe(
      "unsaved",
    );
  });

  test("a failed settings write is recorded as failed, then rethrown", async () => {
    const { deps, set, records, reload } = setup("apply");
    set.mockRejectedValueOnce(new Error("disk full"));
    await expect(applyCommands(deps, [command()])).rejects.toThrow("disk full");
    expect(records.at(-1)).toEqual([
      { id: "c1", status: "failed", error: "disk full" },
    ]);
    expect(reload).not.toHaveBeenCalled();
  });

  test("the configuration keeps entries of modules that are not installed", () => {
    const { game } = fakeGame(MODULES);
    void game.settings.set("core", "moduleConfiguration", {
      gone: true,
      x: true,
    });
    expect(moduleConfiguration(game, ["a"])).toMatchObject({
      gone: true,
      x: false,
      a: true,
    });
  });
});

describe("applyCommands: one confirmation (reviewed on Setup)", () => {
  const TARGET = ["stagehand", "x", "needs-x", "a", "lib"];

  test("the reviewed result applies without the dialog, with a notice", async () => {
    const { deps, set, reload, info, wait } = setup("later");
    expect(await applyCommands(deps, [command()], TARGET)).toBe("applied");
    expect(wait).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      "core",
      "moduleConfiguration",
      expect.objectContaining({ a: true, lib: true }),
    );
    expect(info).toHaveBeenCalledWith("STAGEHAND.Apply.Reviewed");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("order of the reviewed list does not matter", async () => {
    const { deps, wait } = setup("later");
    expect(await applyCommands(deps, [command()], [...TARGET].reverse())).toBe(
      "applied",
    );
    expect(wait).not.toHaveBeenCalled();
  });

  test("a live result that differs from the review asks again", async () => {
    const { deps, set, wait } = setup("later");
    expect(
      await applyCommands(deps, [command()], ["stagehand", "x", "a"]),
    ).toBe("later");
    expect(wait).toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("a conflict always asks, even when the result matches the review", async () => {
    const { deps, wait } = setup("later");
    const hates = command({ modules: ["hates-a", "a"] });
    const target = [...TARGET, "hates-a"];
    expect(await applyCommands(deps, [hates], target)).toBe("later");
    expect(wait).toHaveBeenCalled();
  });

  test("a module that isn't installed always asks", async () => {
    const { deps, wait } = setup("later");
    const ghost = command({ modules: ["a", "ghost"] });
    expect(await applyCommands(deps, [ghost], TARGET)).toBe("later");
    expect(wait).toHaveBeenCalled();
  });

  test("a module blocked by a missing requirement always asks", async () => {
    const { deps, wait } = setup("later", {}, true, [
      ...MODULES,
      { id: "needs-ghost", requires: ["ghost"] },
    ]);
    const blocked = command({ modules: ["a", "needs-ghost"] });
    expect(await applyCommands(deps, [blocked], TARGET)).toBe("later");
    expect(wait).toHaveBeenCalled();
  });

  test("removing a module others need always asks", async () => {
    const { deps, wait } = setup("later");
    const remove = command({ mode: "remove", modules: ["x"] });
    expect(await applyCommands(deps, [remove], ["stagehand", "needs-x"])).toBe(
      "later",
    );
    expect(wait).toHaveBeenCalled();
  });
});
