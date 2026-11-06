import { describe, expect, test, vi } from "vitest";
import { saveWorld } from "../../src/page/save-world.ts";

function foundry(
  over: { validate?: () => void; post?: () => Promise<unknown> } = {},
) {
  const world = {
    id: "w",
    title: "Old",
    validate: vi.fn(over.validate ?? (() => undefined)),
    updateSource: vi.fn(),
  };
  const post = vi.fn(
    over.post ?? (() => Promise.resolve({ id: "w", title: "New" })),
  );
  const render = vi.fn(() => Promise.resolve());
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
      flags: { "module-library": { schedule } },
    });
    await saveWorld(f.page, "w", { schedule: null });
    expect(f.post).toHaveBeenLastCalledWith({
      action: "editWorld",
      id: "w",
      flags: { "module-library": { "-=schedule": null } },
    });
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
