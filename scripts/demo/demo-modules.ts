// The demo's modules (scripts/demo/setup-demo.ts), by the folder the demo
// library keeps them in: free modules from Foundry's package list, verified
// for Foundry 14, for no particular system, needing nothing outside this
// list. With the companion that makes 84, about what a long-running server
// carries.

export interface DemoFolder {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly modules: readonly string[];
}

export const DEMO_FOLDERS: readonly DemoFolder[] = [
  {
    id: "f-table",
    name: "At the table",
    color: "#c0843d",
    modules: [
      "dice-so-nice",
      "dice-calculator",
      "monks-tokenbar",
      "token-action-hud-core",
      "dfreds-convenient-effects",
      "monks-combat-details",
      "combat-tracker-dock",
      "healthEstimate",
      "polyglot",
      "monks-chat-timer",
      "raise-my-hand",
      "monks-hotbar-expansion",
      "always-hp",
      "visual-active-effects",
      "simple-dice-roller",
      "enhancedcombathud",
    ],
  },
  {
    id: "f-fx",
    name: "Effects",
    color: "#8a4f9e",
    modules: [
      "sequencer",
      "tokenmagic",
      "monks-active-tiles",
      "fxmaster",
      "splatter",
      "tile-scroll",
      "particule-fx",
      "monks-bloodsplats",
    ],
  },
  {
    id: "f-maps",
    name: "Maps and scenes",
    color: "#4f8a5b",
    modules: [
      "levels",
      "dungeon-draw",
      "multilevel-tokens",
      "monks-wall-enhancement",
      "monks-scene-navigation",
      "scene-packer",
      "simplefog",
      "gm-vision",
      "betterroofs",
      "smart-doors",
      "arms-reach",
      "stairways",
      "terrainmapper",
      "scene-transitions",
      "torch",
    ],
  },
  {
    id: "f-gm",
    name: "GM tools",
    color: "#3f7f8c",
    modules: [
      "monks-little-details",
      "smalltime",
      "quick-insert",
      "gm-notes",
      "monks-player-settings",
      "permission_viewer",
      "monks-common-display",
      "advanced-macros",
      "hurry-up",
      "token-mold",
      "about-time-next",
      "afk-ready-check",
      "_chatcommands",
      "easy-regions",
      "party-overview",
      "fvtt-party-resources",
      "item-piles",
    ],
  },
  {
    id: "f-story",
    name: "Story and handouts",
    color: "#b0596b",
    modules: [
      "monks-enhanced-journal",
      "pdf-pager",
      "theatre",
      "narrator-tools",
      "gm-screen",
      "share-media",
      "campaign-codex",
      "world-explorer",
      "notelicker",
      "vtta-tokenizer",
    ],
  },
  {
    id: "f-sound",
    name: "Sound",
    color: "#c0a23d",
    modules: [
      "monks-sound-enhancements",
      "walls-have-ears",
      "token-sounds",
      "scene-tracks",
      "modular-av",
    ],
  },
  {
    id: "f-ui",
    name: "Interface",
    color: "#5a6fc0",
    modules: [
      "window-controls",
      "custom-css",
      "token-hud-wildcard",
      "pause-icon",
      "loading-screen",
      "zoom-pan-options",
    ],
  },
  {
    id: "f-lib",
    name: "Libraries",
    color: "#6b6f7a",
    modules: ["lib-wrapper", "socketlib", "tagger", "babele", "portal-lib"],
  },
];

/** Installed but left out of every folder: the library shows it as new. */
export const DEMO_UNSORTED = ["color-picker"] as const;

export const DEMO_MODULES: readonly string[] = [
  ...DEMO_FOLDERS.flatMap((f) => f.modules),
  ...DEMO_UNSORTED,
];
