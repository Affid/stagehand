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
import { DEMO_FOLDERS } from "./demo-modules.ts";

const FOLDERS: Folder[] = DEMO_FOLDERS.map((f, order) => ({
  id: f.id,
  name: f.name,
  color: f.color,
  parentId: null,
  order,
  collapsed: false,
  revision: 1,
}));

const TAGS = [
  { id: "t-players", name: "players see it", color: "#4f9e6b", revision: 1 },
  { id: "t-heavy", name: "heavy", color: "#c0563d", revision: 1 },
  { id: "t-qol", name: "quality of life", color: "#3d7fc0", revision: 1 },
];

const TAGGED: Readonly<Record<string, readonly string[]>> = {
  "t-players": [
    "dice-so-nice",
    "token-action-hud-core",
    "smalltime",
    "monks-sound-enhancements",
    "polyglot",
    "healthEstimate",
    "raise-my-hand",
    "theatre",
    "combat-tracker-dock",
    "share-media",
    "scene-transitions",
  ],
  "t-heavy": [
    "sequencer",
    "tokenmagic",
    "fxmaster",
    "splatter",
    "particule-fx",
    "levels",
    "multilevel-tokens",
  ],
  "t-qol": [
    "dice-calculator",
    "monks-tokenbar",
    "token-action-hud-core",
    "monks-little-details",
    "quick-insert",
    "monks-hotbar-expansion",
    "always-hp",
    "window-controls",
    "zoom-pan-options",
    "smart-doors",
    "arms-reach",
    "hurry-up",
    "monks-scene-navigation",
    "gm-notes",
  ],
};

const NOTES: Readonly<Record<string, string>> = {
  "dice-so-nice": "Players love it; turn off for slow laptops.",
  tokenmagic: "Keep effects short on big maps.",
  "quick-insert": "Ctrl+Space finds anything.",
  polyglot: "Set each character's languages first.",
  simplefog: "Reset the fog after every session.",
  fxmaster: "Rain is fine; heavy snow slows the old laptop.",
  "hurry-up": "Two minutes a turn, agreed at session zero.",
  levels: "Only for the lighthouse maps.",
  "modular-av": "Voice and video for the remote players.",
};

const tagsOf = (id: string): string[] =>
  TAGS.filter((t) => TAGGED[t.id]?.includes(id)).map((t) => t.id);

const MODULES: Record<string, ModuleMeta> = Object.fromEntries(
  DEMO_FOLDERS.flatMap((f) =>
    f.modules.map((id): [string, ModuleMeta] => [
      id,
      { folderId: f.id, tags: tagsOf(id), note: NOTES[id] ?? "" },
    ]),
  ),
);

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
