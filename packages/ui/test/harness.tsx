// Renders the shared modules view with a page's context, as Setup or a
// running world would give it.
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import type { PackageInfo } from "@stagehand/shared/package";
import type { Snapshot } from "@stagehand/shared/world";
import { render } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { vi } from "vitest";
import { ModulesContext, type ModulesUi } from "../src/context.ts";
import { createTranslator } from "../src/i18n.ts";
import type { ModulesData } from "../src/model/data.ts";

export const pkg = (
  id: string,
  over: Partial<PackageInfo> = {},
): PackageInfo => ({
  id,
  title: `Title ${id}`,
  version: "1.0.0",
  authors: [{ name: "Ann" }],
  library: false,
  hasPacks: false,
  hasCode: true,
  compatibility: { minimum: "13", verified: "14" },
  requires: [],
  recommends: [],
  conflicts: [],
  systems: [],
  ...over,
});

export const LIBRARY: Library = {
  ...emptyLibrary("s"),
  folders: [
    {
      id: "f1",
      name: "Combat",
      color: "#c94c4c",
      parentId: null,
      order: 0,
      collapsed: false,
      revision: 1,
    },
  ],
  tags: [{ id: "t1", name: "visual", color: "#3c8dc9", revision: 1 }],
  modules: { a: { folderId: "f1", tags: ["t1"], note: "for Strahd" } },
  presets: [
    {
      id: "p1",
      name: "QoL",
      description: "",
      modules: ["a", "b"],
      source: "user",
      revision: 1,
    },
    {
      id: "p2",
      name: "Maps",
      description: "",
      modules: ["a", "gone"],
      source: "user",
      revision: 1,
    },
  ],
};

const snapshot = (active: readonly string[]): Snapshot => ({
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5.1" },
  coreVersion: "14.370",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.2",
  takenAt: "2026-11-19T10:00:00.000Z",
});

export function worldOf(active: readonly string[]): ModulesData {
  return {
    library: LIBRARY,
    setup: {
      core: { version: "14.370", generation: 14, build: 370 },
      lang: "en",
      modules: [pkg("a"), pkg("b"), pkg("stagehand")],
      worlds: [
        {
          id: "w1",
          title: "Strahd",
          system: "dnd5e",
          systemVersion: "5.1",
          coreVersion: "14.370",
        },
      ],
    },
    snapshots: { w1: snapshot(active) },
    commands: [],
  };
}

export function fakeUi(over: Partial<ModulesUi> = {}): ModulesUi {
  return {
    t: createTranslator("en"),
    data: worldOf(["stagehand", "a"]),
    where: "world",
    canSwitch: true,
    canOrganise: false,
    view: { by: "folder", layout: "cards" },
    panel: null,
    openPanel: vi.fn(),
    flip: vi.fn(() => Promise.resolve()),
    queueApply: vi.fn(() => Promise.resolve()),
    organise: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

export const renderWith = (ui: ModulesUi, node: ComponentChildren) =>
  render(<ModulesContext.Provider value={ui}>{node}</ModulesContext.Provider>);
