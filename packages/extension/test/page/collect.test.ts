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
      canUpdate: true,
      reachable: true,
    });
    expect(JSON.stringify(data)).not.toContain("secret");
    expect(collect({}).coreUpdate).toBeUndefined();
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("the update check says whether updating is allowed and foundryvtt.com answered; the channel falls back to Foundry's setting", () => {
    const data = collect({
      data: {
        options: { updateChannel: "development" },
        coreUpdate: {
          hasUpdate: false,
          canUpdate: false,
          couldReachWebsite: true,
          channel: null,
          version: null,
        },
      },
    } as never);
    expect(data.coreUpdate).toEqual({
      hasUpdate: false,
      channel: "development",
      version: "",
      canUpdate: false,
      reachable: true,
    });
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("a world's join screen, safe mode, play time and verified version are read", () => {
    const data = collect({
      worlds: {
        values: () =>
          [
            {
              id: "w",
              title: "W",
              system: "dnd5e",
              joinTheme: "minimal",
              safeMode: true,
              playtime: 219600,
              compatibility: { verified: "14.369" },
            },
            {
              id: "v",
              title: "V",
              system: "dnd5e",
              joinTheme: "fancy",
              playtime: -3,
            },
          ].values(),
      },
    });
    expect(data.worlds[0]).toMatchObject({
      joinTheme: "minimal",
      safeMode: true,
      playtime: 219600,
      verified: "14.369",
    });
    expect(data.worlds[1]).not.toHaveProperty("joinTheme");
    expect(data.worlds[1]).not.toHaveProperty("playtime");
    expect(data.worlds[1]).not.toHaveProperty("safeMode");
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("our schedule comes from the world's flags, only when it is sound", () => {
    const schedule = {
      start: "2026-11-10",
      time: "19:00",
      tz: "Europe/Berlin",
      freq: "w1",
      skips: [],
    };
    const data = collect({
      worlds: {
        values: () =>
          [
            { id: "w", flags: { "module-library": { schedule } } },
            {
              id: "v",
              flags: { "module-library": { schedule: { time: "25:00" } } },
            },
          ].values(),
      },
    } as never);
    expect(data.worlds[0]?.schedule).toEqual(schedule);
    expect(data.worlds[1]).not.toHaveProperty("schedule");
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("world and system names are cut to their bounds (security review)", () => {
    const long = "x".repeat(5000);
    const data = collect({
      worlds: {
        values: () => [{ id: "w", title: long, system: long }].values(),
      },
      systems: {
        values: () => [{ id: "s", title: long, version: long }].values(),
      },
    });
    expect(data.worlds[0]?.title).toHaveLength(300);
    expect(data.systems[0]?.title).toHaveLength(300);
    expect(data.systems[0]?.version).toHaveLength(50);
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("Foundry's count of setup warnings is read, when it is a count", () => {
    expect(collect({ issueCount: { total: 3 } }).issues).toBe(3);
    expect(collect({ issueCount: { total: -1 } })).not.toHaveProperty("issues");
    expect(collect({})).not.toHaveProperty("issues");
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
