// @vitest-environment happy-dom
// The view's own dialogs (design/in-world-library): the review before
// saving, and Apply Preset with active presets. Foundry's DialogV2 is faked
// by drawing the content into a real form and pressing a button.
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import { describe, expect, it, vi } from "vitest";
import type { DialogV2 } from "../src/foundry.ts";
import { addChange, flipChange } from "../src/view/changes.ts";
import { pickPreset } from "../src/view/pick-preset.ts";
import { reviewChanges } from "../src/view/review.ts";
import { worldData } from "../src/view/world-data.ts";
import langFile from "../static/lang/en.json";
import { fakeGame } from "./fakes.ts";

const NOW = "2026-11-19T10:00:00.000Z";
const LIB: Library = {
  ...emptyLibrary("s"),
  presets: [
    {
      id: "p1",
      name: "Combat <b>",
      description: "Fights",
      modules: ["b", "gone"],
      source: "user",
      revision: 1,
    },
    {
      id: "p2",
      name: "Basics",
      description: "",
      modules: ["a"],
      source: "user",
      revision: 1,
    },
  ],
};

const game = () =>
  fakeGame([
    { id: "stagehand", active: true },
    { id: "a", active: true },
    { id: "b" },
    { id: "c", requires: ["lib"] },
    { id: "lib" },
    { id: "d", active: true, requires: ["a"] },
  ]).game;

type Wait = DialogV2["wait"];
type Options = Parameters<Wait>[0];

/** Draws the dialog, ticks `ticks` (names or name=value), presses `action`. */
function pressing(action: string, ticks: readonly string[] = []) {
  const seen: { options?: Options; form?: HTMLFormElement } = {};
  const wait = vi.fn((options: Options) => {
    const form = document.createElement("form");
    form.innerHTML = options.content;
    for (const b of options.buttons) {
      const el = document.createElement("button");
      el.dataset.action = b.action;
      el.disabled = b.disabled === true;
      form.append(el);
    }
    options.render?.(new Event("render"), { element: form });
    for (const tick of ticks) {
      const [name, value] = tick.split("=");
      const sel = value
        ? `input[name="${name}"][value="${value}"]`
        : `input[name="${name}"]`;
      const input = form.querySelector<HTMLInputElement>(sel);
      if (!input) throw new Error(`no ${tick}`);
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    seen.options = options;
    seen.form = form;
    const button = form.querySelector<HTMLButtonElement>(
      `button[data-action="${action}"]`,
    );
    const config = options.buttons.find((b) => b.action === action);
    if (!button || !config) return Promise.resolve(null);
    if (button.disabled) return Promise.resolve(null);
    return Promise.resolve(
      config.callback?.(new Event("click"), button) ?? action,
    );
  });
  return { dialog: { wait } as DialogV2, seen };
}

const fresh = (() => {
  let n = 0;
  return () => ({ id: `c${String(++n)}`, createdAt: NOW });
})();

describe("reviewChanges", () => {
  it("lists what turns on, what comes along, and saves the result", async () => {
    // Arrange
    const g = game();
    const changes = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "c",
      true,
      fresh(),
    );
    const { dialog, seen } = pressing("save");
    const save = vi.fn(() => Promise.resolve());

    // Act
    const outcome = await reviewChanges(
      { dialog, game: g, warn: vi.fn(), save },
      worldData(g, LIB, changes, NOW),
    );

    // Assert
    expect(seen.form?.textContent).toContain("STAGEHAND.Manage.TurnsOn");
    expect(seen.form?.textContent).toContain("STAGEHAND.Manage.Dependencies");
    expect(outcome).toBe("saved");
    expect(save).toHaveBeenCalledWith(
      expect.arrayContaining(["stagehand", "a", "c", "lib", "d"]),
    );
  });

  it("saves nothing on Back", async () => {
    const g = game();
    const changes = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "b",
      true,
      fresh(),
    );
    const save = vi.fn(() => Promise.resolve());

    const outcome = await reviewChanges(
      { dialog: pressing("back").dialog, game: g, warn: vi.fn(), save },
      worldData(g, LIB, changes, NOW),
    );

    expect(outcome).toBe("back");
    expect(save).not.toHaveBeenCalled();
  });

  it("needs a choice before turning off a module others still need", async () => {
    const g = game();
    const changes = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "a",
      false,
      fresh(),
    );
    const warn = vi.fn();
    const save = vi.fn((_target: readonly string[]) => Promise.resolve());

    const refused = await reviewChanges(
      { dialog: pressing("save").dialog, game: g, warn, save },
      worldData(g, LIB, changes, NOW),
    );
    const agreed = await reviewChanges(
      {
        dialog: pressing("save", ["removeDependents"]).dialog,
        game: g,
        warn,
        save,
      },
      worldData(g, LIB, changes, NOW),
    );

    expect(refused).toBe("blocked");
    expect(warn).toHaveBeenCalledWith("STAGEHAND.Manage.NeedDependentsChoice");
    expect(agreed).toBe("saved");
    const target = vi.mocked(save).mock.calls[0]?.[0] ?? [];
    expect(target).not.toContain("a");
    expect(target).not.toContain("d");
  });

  it("stays open with a warning until the dependents choice is made", async () => {
    // Arrange: turning off a module another one needs
    const g = game();
    const changes = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "a",
      false,
      fresh(),
    );
    const warn = vi.fn();
    let pressed: { before: boolean; after: boolean } | undefined;
    const wait = vi.fn((options: Parameters<DialogV2["wait"]>[0]) => {
      const form = document.createElement("form");
      form.innerHTML = options.content;
      const save = document.createElement("button");
      save.dataset.action = "save";
      save.type = "submit";
      form.append(save);
      document.body.append(form);
      options.render?.(new Event("render"), { element: form });
      // Act: Save without the box, then with it
      const first = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      save.dispatchEvent(first);
      form.querySelector<HTMLInputElement>(
        'input[name="removeDependents"]',
      )!.checked = true;
      const second = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      save.dispatchEvent(second);
      pressed = {
        before: first.defaultPrevented,
        after: second.defaultPrevented,
      };
      return Promise.resolve(null);
    });

    await reviewChanges(
      { dialog: { wait }, game: g, warn, save: vi.fn() },
      worldData(g, LIB, changes, NOW),
    );

    // Assert
    expect(pressed).toEqual({ before: true, after: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("STAGEHAND.Manage.NeedDependentsChoice");
  });

  it("offers only Back when nothing changes", async () => {
    const g = game();
    const { dialog, seen } = pressing("back");

    await reviewChanges(
      { dialog, game: g, warn: vi.fn(), save: vi.fn() },
      worldData(g, LIB, [], NOW),
    );

    expect(seen.options?.buttons.map((b) => b.action)).toEqual(["back"]);
    expect(seen.form?.textContent).toContain("STAGEHAND.Manage.NoChange");
  });

  it("shows module titles as text, never as markup", async () => {
    const g = game();
    const changes = addChange(
      [],
      "w1",
      { mode: "add", presetIds: ["p1"] },
      fresh(),
    );
    const { dialog, seen } = pressing("back");

    await reviewChanges(
      { dialog, game: g, warn: vi.fn(), save: vi.fn() },
      worldData(g, LIB, changes, NOW),
    );

    expect(seen.form?.querySelector("b")).toBeNull();
    expect(seen.form?.textContent).toContain("Combat <b>");
  });
});

describe("pickPreset", () => {
  it("marks the chosen presets in the chosen way", async () => {
    // Arrange
    const g = game();
    const onPick = vi.fn();
    const { dialog } = pressing("mark", ["preset=p1", "mode=replace"]);

    // Act
    await pickPreset(
      { dialog, game: g, warn: vi.fn(), onPick },
      worldData(g, LIB, [], NOW),
    );

    // Assert
    expect(onPick).toHaveBeenCalledWith("replace", ["p1"]);
  });

  it("keeps Mark Changes off until a preset is chosen", async () => {
    const g = game();
    const onPick = vi.fn();

    await pickPreset(
      { dialog: pressing("mark").dialog, game: g, warn: vi.fn(), onPick },
      worldData(g, LIB, [], NOW),
    );

    expect(onPick).not.toHaveBeenCalled();
  });

  it("marks a preset whose installed modules are all on as active", async () => {
    const g = game();
    const { dialog, seen } = pressing("cancel");

    await pickPreset(
      { dialog, game: g, warn: vi.fn(), onPick: vi.fn() },
      worldData(g, LIB, [], NOW),
    );

    const rows = [...(seen.form?.querySelectorAll(".stagehand-preset") ?? [])];
    expect(rows.map((r) => r.classList.contains("active"))).toEqual([
      false,
      true,
    ]);
  });

  it("says which of a preset's modules this server doesn't have", async () => {
    const base = game();
    const g = {
      ...base,
      i18n: {
        ...base.i18n,
        format: (key: string, data: Record<string, string | number>) =>
          `${key}: ${Object.values(data).join(", ")}`,
      },
    };
    const warn = vi.fn();

    await pickPreset(
      {
        dialog: pressing("mark", ["preset=p1"]).dialog,
        game: g,
        warn,
        onPick: vi.fn(),
      },
      worldData(g, LIB, [], NOW),
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gone"));
  });
});

describe("pickPreset with a tampered library", () => {
  it("shows a module id from the library file as text in its notice", async () => {
    const base = game();
    const g = {
      ...base,
      i18n: {
        ...base.i18n,
        format: (_key: string, data: Record<string, string | number>) =>
          String(data.modules),
      },
    };
    const lib: Library = {
      ...LIB,
      presets: [
        { ...LIB.presets[0]!, modules: ['<img src=x onerror="alert(1)">'] },
      ],
    };
    const warn = vi.fn();

    await pickPreset(
      {
        dialog: pressing("mark", ["preset=p1"]).dialog,
        game: g,
        warn,
        onPick: vi.fn(),
      },
      worldData(g, lib, [], NOW),
    );

    expect(warn).toHaveBeenCalledWith(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});

describe("the dialogs' words", () => {
  const lang: Record<string, unknown> = langFile;
  const lookup = (key: string): string => {
    const found = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        lang,
      );
    if (typeof found !== "string") throw new Error(`missing string ${key}`);
    return found;
  };

  it("are all in the companion's language file", async () => {
    // Arrange: a change with a preset, a dependency and a dependent
    const base = game();
    const g = {
      ...base,
      i18n: { ...base.i18n, localize: lookup, format: lookup },
    };
    const first = flipChange(
      worldData(g, LIB, [], NOW),
      "w1",
      "a",
      false,
      fresh(),
    );
    const changes = addChange(
      first,
      "w1",
      { mode: "add", presetIds: ["p1"] },
      fresh(),
    );
    const data = worldData(g, LIB, changes, NOW);

    // Act and assert: neither dialog asks for a string the file lacks
    await reviewChanges(
      {
        dialog: pressing("back").dialog,
        game: g,
        warn: vi.fn(),
        save: vi.fn(),
      },
      data,
    );
    await pickPreset(
      {
        dialog: pressing("mark", ["preset=p1"]).dialog,
        game: g,
        warn: vi.fn(),
        onPick: vi.fn(),
      },
      data,
    );
  });
});
