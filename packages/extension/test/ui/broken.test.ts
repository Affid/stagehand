import { describe, expect, test, vi } from "vitest";
import { watchProblems } from "../../src/ui/broken.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import { createStore, type UiState } from "../../src/ui/store.ts";
import { fakePage, setupState, uiState } from "./harness.tsx";

const t = createTranslator("en");
const snap = {
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: ["module-library", "c", "lib"].map((id) => ({
    id,
    version: "1.0.0",
  })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
};
const broken = setupState({
  snapshots: { w1: snap },
  commands: [
    {
      id: "n",
      scope: "world",
      worldId: "w1",
      type: "preset.apply",
      payload: { mode: "remove", presetIds: [], modules: ["lib"] },
      createdAt: "2026-11-05T01:00:00.000Z",
      baseSnapshotAt: null,
      status: "pending",
    },
  ],
});

function run(route: UiState["route"]) {
  const store = createStore(
    uiState({ data: setupState({ snapshots: { w1: snap } }), route }),
  );
  const { page } = fakePage();
  const write = vi.fn(() => {
    store.set({ data: broken });
    return Promise.resolve();
  });
  return { page, done: watchProblems({ store, t, page }, "w1", write) };
}

describe("a change that leaves a world with problems (Phase 6, review)", () => {
  test("from elsewhere: says so", async () => {
    const r = run({ kind: "library" });
    await r.done;
    expect(r.page.notify).toHaveBeenCalledWith(
      "warning",
      "Strahd now has 2 modules that need attention. Open it to fix.",
    );
  });

  test("on the world shown by default (no route yet): its cards show it, no notice", async () => {
    const r = run(null);
    await r.done;
    expect(r.page.notify).not.toHaveBeenCalled();
  });
});
