// The demo's library (scripts/demo/setup-demo.ts), as Stagehand keeps it on
// the server (Data/stagehand/library.json): folders, tags, a few notes and
// presets, so a fresh browser shows a sorted library after its first sync.
import {
  nextSyncFile,
  serializeSyncFile,
} from "../../packages/shared/src/library/sync-file.ts";
import {
  type Folder,
  type Library,
  type ModuleMeta,
  SCHEMA_VERSION,
} from "../../packages/shared/src/library/schema.ts";

const folder = (
  id: string,
  name: string,
  color: string,
  order: number,
): Folder => ({
  id,
  name,
  color,
  parentId: null,
  order,
  collapsed: false,
  revision: 1,
});

const FOLDERS: Folder[] = [
  folder("f-table", "At the table", "#c0843d", 0),
  folder("f-fx", "Effects", "#8a4f9e", 1),
  folder("f-gm", "GM tools", "#3f7f8c", 2),
  folder("f-lib", "Libraries", "#6b6f7a", 3),
];

const TAGS = [
  { id: "t-players", name: "players see it", color: "#4f9e6b", revision: 1 },
  { id: "t-heavy", name: "heavy", color: "#c0563d", revision: 1 },
  { id: "t-qol", name: "quality of life", color: "#3d7fc0", revision: 1 },
];

const meta = (
  folderId: string,
  tags: string[] = [],
  note = "",
): ModuleMeta => ({
  folderId,
  tags,
  note,
});

const MODULES: Record<string, ModuleMeta> = {
  "dice-so-nice": meta(
    "f-table",
    ["t-players"],
    "Players love it; turn off for slow laptops.",
  ),
  "dice-calculator": meta("f-table", ["t-qol"]),
  "monks-tokenbar": meta("f-table", ["t-qol"]),
  "token-action-hud-core": meta("f-table", ["t-players", "t-qol"]),
  sequencer: meta("f-fx", ["t-heavy"]),
  tokenmagic: meta("f-fx", ["t-heavy"], "Keep effects short on big maps."),
  "monks-enhanced-journal": meta("f-gm"),
  "monks-little-details": meta("f-gm", ["t-qol"]),
  smalltime: meta("f-gm", ["t-players"]),
  "monks-active-tiles": meta("f-fx"),
  "quick-insert": meta("f-gm", ["t-qol"], "Ctrl+Space finds anything."),
  "monks-sound-enhancements": meta("f-table", ["t-players"]),
  "lib-wrapper": meta("f-lib"),
  socketlib: meta("f-lib"),
};

const PRESETS = [
  {
    id: "p-core",
    name: "Every game",
    description: "What every world starts with.",
    modules: [
      "dice-so-nice",
      "lib-wrapper",
      "socketlib",
      "monks-little-details",
      "smalltime",
    ],
    source: "user" as const,
    revision: 1,
  },
  {
    id: "p-fx",
    name: "Cinematic",
    description: "Effects for big moments.",
    modules: ["sequencer", "tokenmagic", "lib-wrapper", "socketlib"],
    source: "user" as const,
    revision: 1,
  },
  {
    id: "p-new",
    name: "New players",
    description: "Fewer buttons, more help.",
    modules: ["dice-so-nice", "token-action-hud-core", "dice-calculator"],
    source: "user" as const,
    revision: 1,
  },
];

const LIBRARY: Library = {
  schemaVersion: SCHEMA_VERSION,
  serverId: "demo",
  revision: 1,
  folders: FOLDERS,
  tags: TAGS,
  modules: MODULES,
  views: [],
  presets: PRESETS,
};

/** Everything but Color Picker counts as sorted: it shows as new. */
const SORTED = Object.keys(MODULES).concat("stagehand");

export const DEMO_LIBRARY = (): string =>
  serializeSyncFile(
    nextSyncFile({ library: LIBRARY, sorted: SORTED }, "demo-seed", null),
    new Date().toISOString(),
  );
