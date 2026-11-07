// @vitest-environment happy-dom
import type { Command } from "@module-library/shared/world";
import { act, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

const queued = (id: string): Command => ({
  id,
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: [], modules: ["a"] },
  createdAt: "2026-11-05T01:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending",
});

const said = (c: ParentNode): string =>
  c.querySelector(".mls-announce")?.textContent ?? "";

describe("queued changes are announced wherever they come from (Phase 6)", () => {
  test("a world's queue growing or emptying is said once; nothing on load", () => {
    const r = renderUi("shell", {
      data: { commands: [queued("c0")] },
      state: { route: { kind: "library" } },
    });
    expect(said(r.container)).toBe("");
    void act(() => {
      r.store.set((s) => ({
        data: { ...s.data, commands: [queued("c0"), queued("c1")] },
      }));
    });
    expect(said(r.container)).toBe(
      "Strahd: 2 changes wait for the next launch",
    );
    void act(() => {
      r.store.set((s) => ({ data: { ...s.data, commands: [] } }));
    });
    expect(said(r.container)).toBe("Strahd: nothing waits for the next launch");
  });
});

describe("several worlds at once (review)", () => {
  test("each world that changed is said", () => {
    const base = setupState();
    const worlds = [
      ...(base.setup?.worlds ?? []),
      {
        id: "w2",
        title: "Vaults",
        system: "dnd5e",
        systemVersion: "5",
        coreVersion: "14.370",
      },
    ];
    const r = renderUi("shell", {
      data: { setup: base.setup ? { ...base.setup, worlds } : undefined },
      state: { route: { kind: "library" } },
    });
    void act(() => {
      r.store.set((s) => ({
        data: {
          ...s.data,
          commands: [queued("a1"), { ...queued("b1"), worldId: "w2" }],
        },
      }));
    });
    expect(said(r.container)).toBe(
      "Strahd: 1 change waits for the next launch. Vaults: 1 change waits for the next launch",
    );
  });
});
