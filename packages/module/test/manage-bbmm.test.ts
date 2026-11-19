// @vitest-environment happy-dom
// BBMM in the same world (docs/IN-WORLD-LIBRARY-PLAN.md, decided
// 2026-11-18): with BBMM's enhanced module management on, the first full
// Gamemaster with Stagehand's view on is asked once which view Module
// Management opens. Neither answer is the default; closing asks again.
import { describe, expect, it, vi } from "vitest";
import type { DialogV2 } from "../src/foundry.ts";
import {
  askAboutBbmm,
  type BbmmDeps,
  bbmmHoldsButton,
} from "../src/manage/bbmm.ts";
import langFile from "../static/lang/en.json";
import { fakeGame } from "./fakes.ts";

function setup(
  over: {
    role?: number;
    enhanced?: unknown;
    answered?: string;
    bbmmActive?: boolean;
  } = {},
) {
  const { game, set } = fakeGame(
    [
      { id: "stagehand", active: true },
      { id: "bbmm", active: over.bbmmActive ?? true },
    ],
    over.role ?? 4,
  );
  const values: Record<string, unknown> = {
    "bbmm.enableModuleManagement": over.enhanced ?? true,
    "stagehand.bbmmAnswer": over.answered ?? "",
  };
  vi.spyOn(game.settings, "get").mockImplementation((ns, key) => {
    const k = `${ns}.${key}`;
    if (!(k in values)) throw new Error(`not registered: ${k}`);
    return values[k];
  });
  return { game, set };
}

const answering = (action: string | null) => {
  const wait = vi.fn((_options: Parameters<DialogV2["wait"]>[0]) =>
    Promise.resolve(action),
  );
  return { dialog: { wait } as DialogV2, wait };
};

function deps(
  game: BbmmDeps["game"],
  action: string | null,
  over: Partial<BbmmDeps> = {},
) {
  const { dialog, wait } = answering(action);
  const d: BbmmDeps = {
    game,
    dialog,
    info: vi.fn(),
    reloadAll: vi.fn(),
    settingOn: () => true,
    hasLibrary: () => Promise.resolve(true),
    loadCss: vi.fn(),
    ...over,
  };
  return { d, wait };
}

describe("bbmmHoldsButton", () => {
  it("is true while BBMM is on with its enhanced module management", () => {
    expect(bbmmHoldsButton(setup().game)).toBe(true);
  });

  it("is false with the enhanced management off, BBMM off, or no BBMM setting", () => {
    expect(bbmmHoldsButton(setup({ enhanced: false }).game)).toBe(false);
    expect(bbmmHoldsButton(setup({ bbmmActive: false }).game)).toBe(false);
    const { game } = setup();
    vi.spyOn(game.settings, "get").mockImplementation(() => {
      throw new Error("not registered");
    });
    expect(bbmmHoldsButton(game)).toBe(false);
  });
});

describe("askAboutBbmm", () => {
  it("turns BBMM's window off world-wide and reloads on Use Stagehand's View", async () => {
    // Arrange
    const { game, set } = setup();
    const { d, wait } = deps(game, "useStagehand");

    // Act
    const answer = await askAboutBbmm(d);

    // Assert
    expect(answer).toBe("stagehand");
    expect(set).toHaveBeenCalledWith("bbmm", "enableModuleManagement", false);
    expect(set).toHaveBeenCalledWith("stagehand", "bbmmAnswer", "stagehand");
    expect(d.reloadAll).toHaveBeenCalledTimes(1);
    const buttons = wait.mock.calls[0]?.[0].buttons ?? [];
    expect(buttons.some((b) => b.default)).toBe(false);
    // Opening focuses the question, not one of the answers.
    expect(wait.mock.calls[0]?.[0].content).toMatch(
      /<p class="stagehand-lead" tabindex="-1" autofocus>/,
    );
  });

  it("changes nothing of BBMM's on Keep BBMM's View, and says how to reach ours", async () => {
    const { game, set } = setup();
    const { d } = deps(game, "keepBbmm");

    const answer = await askAboutBbmm(d);

    expect(answer).toBe("bbmm");
    expect(set).not.toHaveBeenCalledWith(
      "bbmm",
      "enableModuleManagement",
      false,
    );
    expect(set).toHaveBeenCalledWith("stagehand", "bbmmAnswer", "bbmm");
    expect(d.info).toHaveBeenCalledWith("STAGEHAND.Manage.BbmmKept");
    expect(d.reloadAll).not.toHaveBeenCalled();
  });

  it("asks again next time when the dialog is closed", async () => {
    const { game, set } = setup();
    const { d } = deps(game, null);

    const answer = await askAboutBbmm(d);

    expect(answer).toBe("later");
    expect(set).not.toHaveBeenCalled();
  });

  it.each([
    ["an Assistant Gamemaster", { role: 3 }, {}],
    ["a world that has answered", { answered: "bbmm" }, {}],
    ["BBMM's management off", { enhanced: false }, {}],
    ["Stagehand's view off for them", {}, { settingOn: () => false }],
    [
      "no library on the server",
      {},
      { hasLibrary: () => Promise.resolve(false) },
    ],
  ])("doesn't ask %s", async (_why, world, more) => {
    const { game } = setup(world);
    const { d, wait } = deps(game, "useStagehand", more);

    const answer = await askAboutBbmm(d);

    expect(answer).toBe("skip");
    expect(wait).not.toHaveBeenCalled();
  });
});

describe("the prompt's words", () => {
  it("are all in the companion's language file", async () => {
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
    const base = setup().game;
    const game = { ...base, i18n: { ...base.i18n, localize: lookup } };

    const { d } = deps(game, "keepBbmm");

    await expect(askAboutBbmm(d)).resolves.toBe("bbmm");
    expect(lookup("STAGEHAND.Manage.SettingHintBbmm")).toContain("Shift-click");
  });
});
