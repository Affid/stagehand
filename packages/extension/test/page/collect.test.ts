import { SetupDataSchema } from "@module-library/shared/world";
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

  test("worlds carry their description and next session; a huge description is cut, not refused", () => {
    const data = collect({
      worlds: list(
        {
          id: "w",
          title: "W",
          description: "<p>Gothic horror</p>",
          nextSession: "2026-11-12T18:00:00.000Z",
        },
        { id: "x", title: "X", description: "x".repeat(30000), nextSession: 5 },
      ),
    });
    expect(data.worlds[0]).toMatchObject({
      description: "<p>Gothic horror</p>",
      nextSession: "2026-11-12T18:00:00.000Z",
    });
    expect(data.worlds[1]?.description).toHaveLength(20000);
    expect(data.worlds[1]).not.toHaveProperty("nextSession");
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("only the update's version, channel and availability are read: never its download link", () => {
    const data = collect({
      data: {
        coreUpdate: {
          hasUpdate: true,
          channel: "stable",
          version: "14.371",
          download: "https://secret.example/timed-link",
          release: { notes: "x" },
        },
      },
    } as never);
    expect(data.coreUpdate).toEqual({
      hasUpdate: true,
      channel: "stable",
      version: "14.371",
    });
    expect(JSON.stringify(data)).not.toContain("secret");
    expect(collect({}).coreUpdate).toBeUndefined();
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
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
