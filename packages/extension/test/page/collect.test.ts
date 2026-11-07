import { SetupDataSchema } from "@module-library/shared/world";
import { describe, expect, test, vi } from "vitest";
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
    // Read as a package, as modules are (6c): favourite, lock, links and all.
    expect(data.systems).toEqual([
      expect.objectContaining({
        id: "dnd5e",
        title: "D&D",
        version: "5",
        authors: [],
      }),
    ]);
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
            {
              id: "u",
              flags: {
                "module-library": {
                  schedule: { ...schedule, tz: "Not/AZone" },
                },
              },
            },
          ].values(),
      },
    });
    expect(data.worlds[0]?.schedule).toEqual(schedule);
    expect(data.worlds[1]).not.toHaveProperty("schedule");
    expect(data.worlds[2]).not.toHaveProperty("schedule");
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

describe("one manifest we can't read (security review)", () => {
  test("is left out; the other packages still come through", () => {
    const bad = {
      get id(): string {
        throw new Error("broken manifest");
      },
    };
    const game = {
      release: { generation: 14, build: 370 },
      modules: {
        values: () => [bad, { id: "ok", title: "Ok", version: "1" }].values(),
      },
      systems: { values: () => [].values() },
      worlds: { values: () => [].values() },
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(collect(game as never).modules.map((m) => m.id)).toEqual(["ok"]);
  });
});

describe("Foundry's News and Featured Content (Phase 6)", () => {
  const IMG = "https://r2.foundryvtt.com/website-uploads-public/a.webp";
  const item = (title: string, over: object = {}) => ({
    title,
    url: `https://foundryvtt.com/article/${title}/`,
    image: IMG,
    caption: "A caption",
    ...over,
  });

  test("reads the news list and the featured item, without captions", () => {
    const data = collect({
      data: {
        news: [item("a"), item("b")],
        featuredContent: item("f", {
          url: "https://foundryvtt.store/products/f",
        }),
      },
    });
    expect(data.news).toEqual([
      { title: "a", url: "https://foundryvtt.com/article/a/", image: IMG },
      { title: "b", url: "https://foundryvtt.com/article/b/", image: IMG },
    ]);
    expect(data.featured).toEqual({
      title: "f",
      url: "https://foundryvtt.store/products/f",
      image: IMG,
    });
    expect(SetupDataSchema.safeParse(data).success).toBe(true);
  });

  test("unsafe items are left out; none at all leaves the fields out", () => {
    const data = collect({
      data: {
        news: [item("a", { url: "javascript:x" }), item("b"), 7],
        featuredContent: null,
      },
    });
    expect(data.news?.map((n) => n.title)).toEqual(["b"]);
    expect(data).not.toHaveProperty("featured");
    const none = collect({ data: { news: "nope" } });
    expect(none).not.toHaveProperty("news");
    expect(none).not.toHaveProperty("featured");
  });

  test("at most twenty news items", () => {
    const data = collect({
      data: { news: Array.from({ length: 30 }, (_, i) => item(`n${i}`)) },
    });
    expect(data.news).toHaveLength(20);
  });
});
