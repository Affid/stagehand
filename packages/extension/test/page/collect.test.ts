import { describe, expect, test } from "vitest";
import { collect } from "../../src/page/collect.ts";

const list = (...items: object[]) => ({ values: () => items.values() });

describe("reading Setup's package data (V-1)", () => {
  test("core, admin flag, language, modules, systems and worlds", () => {
    const data = collect({
      release: { generation: 14, build: 369 },
      data: { isAdmin: true },
      i18n: { lang: "de" },
      modules: list({ id: "a", title: "A", version: "1" }),
      systems: list({ id: "dnd5e", title: "D&D", version: "5" }),
      worlds: list(
        { id: "w", title: "W", system: "dnd5e", lastPlayed: "2026-11-05" },
        { id: "x", title: "X" },
      ),
    });
    expect(data.core).toEqual({
      version: "14.369",
      generation: 14,
      build: 369,
    });
    expect(data.isAdmin).toBe(true);
    expect(data.lang).toBe("de");
    expect(data.modules.map((m) => m.id)).toEqual(["a"]);
    expect(data.systems).toEqual([{ id: "dnd5e", title: "D&D", version: "5" }]);
    expect(data.worlds[0]).toMatchObject({ id: "w", lastPlayed: "2026-11-05" });
    expect(data.worlds[1]).not.toHaveProperty("lastPlayed");
  });

  test("worlds carry favourite, lock and background, as Foundry's Setup marks them", () => {
    const data = collect({
      worlds: list(
        {
          id: "w",
          title: "W",
          favorite: true,
          locked: true,
          background: "worlds/w/bg.webp",
        },
        { id: "x", title: "X", favorite: "yes", background: 7 },
      ),
    });
    expect(data.worlds[0]).toMatchObject({
      favorite: true,
      locked: true,
      background: "worlds/w/bg.webp",
    });
    expect(data.worlds[1]).toMatchObject({ favorite: false, locked: false });
    expect(data.worlds[1]).not.toHaveProperty("background");
  });

  test("missing pieces read as empty, never throw", () => {
    expect(collect({})).toMatchObject({
      core: { version: "0.0" },
      isAdmin: false,
      lang: "",
      modules: [],
      worlds: [],
    });
  });
});
