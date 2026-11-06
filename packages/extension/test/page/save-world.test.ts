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
