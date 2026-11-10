import { describe, expect, test, vi } from "vitest";
import { saveWorld } from "../../src/page/save-world.ts";

function foundry(
  over: {
    validate?: () => void;
    post?: () => Promise<unknown>;
    render?: () => Promise<unknown>;
    updateSource?: () => void;
  } = {},
) {
  const world = {
    id: "w",
    title: "Old",
    validate: vi.fn(over.validate ?? (() => undefined)),
    updateSource: vi.fn(over.updateSource),
  };
  const post = vi.fn(
    over.post ?? (() => Promise.resolve({ id: "w", title: "New" })),
  );
  const render = vi.fn(over.render ?? (() => Promise.resolve()));
  const page = {
    game: {
      worlds: {
        values: () => [].values(),
        get: (id: string) => (id === "w" ? world : undefined),
      },
      post,
    },
    ui: { setupPackages: { render } },
  };
  return { page, world, post, render };
}

describe("saving a world through Foundry", () => {
  test("validates like World Configuration, posts editWorld, applies the answer and re-renders", async () => {
    const f = foundry();
    expect(await saveWorld(f.page, "w", { title: "New" })).toBeUndefined();
    expect(f.world.validate).toHaveBeenCalledWith({
      changes: { id: "w", title: "New" },
      clean: true,
    });
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      title: "New",
    });
    expect(f.world.updateSource).toHaveBeenCalledWith({
      id: "w",
      title: "New",
    });
    expect(f.render).toHaveBeenCalled();
  });

  test("once saved, a failing redraw of Foundry's Setup is still a save, and logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const render = (): Promise<unknown> =>
      Promise.reject(new TypeError("RegExp.escape is not a function"));
    const f = foundry({ render });
    expect(await saveWorld(f.page, "w", { title: "New" })).toBeUndefined();
    expect(f.render).toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  test("once saved, a failing copy into Setup is still a save, and logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const updateSource = (): void => {
      throw new Error("bad copy");
    };
    const f = foundry({ updateSource });
    expect(await saveWorld(f.page, "w", { title: "New" })).toBeUndefined();
    expect(f.render).toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  test("our schedule goes into the world's flags; null removes it", async () => {
    const f = foundry();
    const schedule = {
      start: "2026-11-10",
      time: "19:00",
      tz: "Europe/Berlin",
      freq: "w1" as const,
      skips: [],
    };
    await saveWorld(f.page, "w", {
      schedule,
      nextSession: "2026-11-10T18:00:00.000Z",
    });
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w",
      nextSession: "2026-11-10T18:00:00.000Z",
      flags: { stagehand: { schedule } },
    });
    await saveWorld(f.page, "w", { schedule: null });
    expect(f.post).toHaveBeenLastCalledWith({
      action: "editWorld",
      id: "w",
      flags: { stagehand: { "-=schedule": null } },
    });
    // The client's copy drops it too: merging the answer alone keeps it.
    expect(f.world.updateSource).toHaveBeenCalledWith({
      flags: { stagehand: { "-=schedule": null } },
    });
  });

  test("a save moves a schedule from before the rename under the new name", async () => {
    const f = foundry();
    const schedule = {
      start: "2026-12-01",
      time: "19:00",
      tz: "UTC",
      freq: "dates" as const,
      skips: [],
      dates: { "2026-12-01": "19:00" },
    };
    Object.assign(f.world, {
      flags: {
        "module-library": {
          schedule: { ...schedule, dates: { "2026-12-08": "19:00" } },
        },
      },
    });
    await saveWorld(f.page, "w", { schedule });
    expect(f.post).toHaveBeenLastCalledWith({
      action: "editWorld",
      id: "w",
      flags: { stagehand: { schedule }, "-=module-library": null },
    });
  });

  test("a removed chosen date is deleted, not kept by Foundry's merge (review)", async () => {
    const f = foundry();
    const stored = {
      start: "2026-12-01",
      time: "19:00",
      tz: "UTC",
      freq: "dates" as const,
      skips: [],
      dates: { "2026-12-01": "19:00", "2026-12-08": "19:00" },
    };
    Object.assign(f.world, {
      flags: { stagehand: { schedule: stored } },
    });
    await saveWorld(f.page, "w", {
      schedule: { ...stored, dates: { "2026-12-01": "19:00" } },
    });
    expect(f.post).toHaveBeenLastCalledWith({
      action: "editWorld",
      id: "w",
      flags: {
        stagehand: {
          schedule: {
            ...stored,
            dates: { "2026-12-01": "19:00", "-=2026-12-08": null },
          },
        },
      },
    });
    // A rule without chosen dates drops the stored ones.
    await saveWorld(f.page, "w", {
      schedule: {
        start: "2026-12-01",
        time: "19:00",
        tz: "UTC",
        freq: "w1",
        skips: [],
      },
    });
    expect(f.post).toHaveBeenLastCalledWith(
      expect.objectContaining({
        flags: {
          stagehand: {
            schedule: expect.objectContaining({ "-=dates": null }) as unknown,
          },
        },
      }),
    );
  });

  test("a value Foundry rejects is never sent", async () => {
    const f = foundry({
      validate: () => {
        throw new Error("title: may not be blank");
      },
    });
    expect(await saveWorld(f.page, "w", { title: "x" })).toMatch(/blank/);
    expect(f.post).not.toHaveBeenCalled();
  });

  test("a failed request or a missing world is reported, never thrown", async () => {
    const f = foundry({ post: () => Promise.reject(new Error("403")) });
    expect(await saveWorld(f.page, "w", { nextSession: null })).toMatch(/403/);
    expect(await saveWorld(f.page, "nope", { title: "x" })).toMatch(/nope/);
    expect(await saveWorld({}, "w", { title: "x" })).toBeTruthy();
  });
});
