import { describe, expect, test } from "vitest";
import {
  emptyLibrary,
  type Library,
} from "@module-library/shared/library/schema";
import type { PackageInfo } from "@module-library/shared/package";
import type { Command, Snapshot } from "@module-library/shared/world";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import type { SetupState } from "../../src/messages.ts";
import { groupByFolder, scopeModules } from "../../src/ui/model/modules.ts";
import { previewApply } from "../../src/ui/model/preview.ts";
import { worldRows } from "../../src/ui/model/worlds.ts";

const pkg = (id: string, over: Partial<PackageInfo> = {}): PackageInfo => ({
  id,
  title: id,
  version: "1.0.0",
  authors: [],
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

const library: Library = {
  ...emptyLibrary("s"),
  folders: [
    {
      id: "f2",
      name: "Second",
      color: "#000000",
      parentId: null,
      order: 1,
      collapsed: false,
      revision: 1,
    },
    {
      id: "f1",
      name: "First",
      color: "#000000",
      parentId: null,
      order: 0,
      collapsed: false,
      revision: 1,
    },
  ],
  modules: {
    a: { folderId: "f1", tags: [], note: "" },
    b: { folderId: "f2", tags: [], note: "" },
  },
  presets: [
    {
      id: "p1",
      name: "QoL",
      description: "",
      modules: ["a", "lib-user"],
      source: "user",
      revision: 1,
    },
  ],
};

const modules = [
  pkg("a"),
  pkg("b"),
  pkg("c"),
  pkg("lib", { library: true }),
  pkg("lib-user", { requires: [{ id: "lib", type: "module" }] }),
];

describe("groupByFolder", () => {
  test("orders folders, then unfiled modules last, skipping empty groups", () => {
    const groups = groupByFolder(modules, library);
    expect(
      groups.map((g) => [g.folder?.id ?? null, g.modules.map((m) => m.id)]),
    ).toEqual([
      ["f1", ["a"]],
      ["f2", ["b"]],
      [null, ["c", "lib", "lib-user"]],
    ]);
  });
});

describe("scopeModules", () => {
  test("narrows to a folder, to unfiled, or to a smart group", () => {
    expect(
      scopeModules(modules, library, { kind: "folder", id: "f2" }, []).map(
        (m) => m.id,
      ),
    ).toEqual(["b"]);
    expect(
      scopeModules(modules, library, { kind: "folder", id: null }, []).map(
        (m) => m.id,
      ),
    ).toEqual(["c", "lib", "lib-user"]);
    const groups = [{ key: "library", label: "x", moduleIds: ["lib"] }];
    expect(
      scopeModules(
        modules,
        library,
        { kind: "group", key: "library" },
        groups,
      ).map((m) => m.id),
    ).toEqual(["lib"]);
    expect(scopeModules(modules, library, { kind: "all" }, [])).toHaveLength(5);
  });
});

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  worldId: "w1",
  title: "W1",
  system: { id: "dnd5e", version: "5.1.0" },
  coreVersion: "14.369",
  active: [{ id: "module-library", version: "0.1.0" }],
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T10:00:00.000Z",
  ...over,
});

const command = (over: Partial<Command>): Command => ({
  id: "c",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: ["p1"] },
  createdAt: "t",
  baseSnapshotAt: null,
  status: "pending",
  ...over,
});

const state = (over: Partial<SetupState> = {}): SetupState => ({
  server: "s",
  adminVerified: true,
  library,
  setup: {
    core: { version: "14.369", generation: 14, build: 369 },
    isAdmin: true,
    lang: "en",
    modules: [...modules, pkg("module-library")],
    systems: [],
    worlds: [
      {
        id: "w1",
        title: "W1",
        system: "dnd5e",
        systemVersion: "5.1.0",
        coreVersion: "14.369",
        lastPlayed: "2026-11-05T09:00:00.000Z",
      },
      {
        id: "w2",
        title: "W2",
        system: "pf2e",
        systemVersion: "6",
        coreVersion: "13.351",
      },
    ],
    seenAt: "t",
  },
  snapshots: { w1: snapshot() },
  commands: [],
  hellos: {},
  config: BUNDLED_CONFIG,
  ...over,
});

describe("worldRows (W-1, W-2)", () => {
  test("a world without a snapshot needs the companion", () => {
    const rows = worldRows(state());
    expect(rows.map((r) => [r.world.id, r.status])).toEqual([
      ["w1", "ok"],
      ["w2", "no-companion"],
    ]);
  });

  test("a snapshot older than the last play is stale", () => {
    const rows = worldRows(
      state({
        snapshots: { w1: snapshot({ takenAt: "2026-11-01T00:00:00.000Z" }) },
      }),
    );
    expect(rows[0]?.status).toBe("stale");
  });

  test("a rejected handshake marks the companion outdated", () => {
    const rows = worldRows(
      state({
        hellos: {
          w1: { worldId: "w1", moduleVersion: "0", protocol: null, at: "t" },
        },
      }),
    );
    expect(rows[0]?.status).toBe("outdated");
  });

  test("lists pending and recently finished commands per world", () => {
    const rows = worldRows(
      state({
        commands: [
          command({ id: "1" }),
          command({ id: "2", status: "failed" }),
          command({ id: "3", worldId: "w2" }),
        ],
      }),
    );
    expect(rows[0]?.pending.map((c) => c.id)).toEqual(["1"]);
    expect(rows[0]?.recent.map((c) => c.id)).toEqual(["2"]);
  });
});

describe("previewApply (P-4)", () => {
  test("diffs presets against the world's last snapshot, with dependencies", () => {
    const preview = previewApply(state(), {
      worldId: "w1",
      presetIds: ["p1"],
      mode: "add",
      removeDependents: false,
    });
    expect(preview.warnings).toEqual([]);
    expect([...(preview.plan?.enable ?? [])].sort()).toEqual([
      "a",
      "lib",
      "lib-user",
    ]);
    expect(preview.plan?.dependencyAdditions).toEqual(["lib"]);
  });

  test("without a snapshot the preview starts from nothing and says so", () => {
    const preview = previewApply(state(), {
      worldId: "w2",
      presetIds: ["p1"],
      mode: "add",
      removeDependents: false,
    });
    expect(preview.warnings).toEqual(["no-snapshot"]);
    expect(preview.plan?.start).toEqual(["module-library"]);
  });

  test("uses the world's own core version (V-7)", () => {
    const withV15 = state({
      library: {
        ...library,
        presets: [
          {
            id: "p2",
            name: "New",
            description: "",
            modules: ["v15"],
            source: "user",
            revision: 1,
          },
        ],
      },
      setup: {
        ...state().setup!,
        modules: [
          ...modules,
          pkg("module-library"),
          pkg("v15", { compatibility: { minimum: "15" } }),
        ],
      },
    });
    const preview = previewApply(withV15, {
      worldId: "w1",
      presetIds: ["p2"],
      mode: "add",
      removeDependents: false,
    });
    expect(preview.plan?.incompatible).toEqual([
      { id: "v15", reason: "core", availability: "requires-core-upgrade" },
    ]);
  });
});
