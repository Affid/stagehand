// The demo's system and worlds (scripts/demo/setup-demo.ts), each world with
// what its modules require. The modules themselves: demo-modules.ts.

export const DEMO_SYSTEM = "worldbuilding";

export interface DemoWorld {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly colors: readonly [string, string];
  readonly modules: readonly string[];
}

export const DEMO_WORLDS: readonly DemoWorld[] = [
  {
    id: "lighthouse-greywater",
    title: "The Lighthouse at Greywater",
    description: "A coastal mystery campaign, every other Friday.",
    colors: ["#1d3b53", "#3f7f8c"],
    modules: [
      "dice-so-nice",
      "lib-wrapper",
      "socketlib",
      "sequencer",
      "tokenmagic",
      "monks-enhanced-journal",
      "monks-little-details",
      "smalltime",
      "polyglot",
      "monks-combat-details",
      "levels",
      "simplefog",
      "smart-doors",
      "stairways",
      "torch",
      "theatre",
      "narrator-tools",
      "gm-notes",
      "pdf-pager",
      "walls-have-ears",
      "scene-transitions",
      "monks-scene-navigation",
    ],
  },
  {
    id: "starfall-season-two",
    title: "Starfall: Season Two",
    description: "Science fantasy among the drifting moons.",
    colors: ["#2b1d4f", "#8a4f9e"],
    modules: [
      "dice-so-nice",
      "lib-wrapper",
      "socketlib",
      "monks-tokenbar",
      "dice-calculator",
      "token-action-hud-core",
      "enhancedcombathud",
      "combat-tracker-dock",
      "healthEstimate",
      "fxmaster",
      "particule-fx",
      "sequencer",
      "tokenmagic",
      "dungeon-draw",
      "multilevel-tokens",
      "item-piles",
      "party-overview",
      "token-sounds",
      "window-controls",
      "always-hp",
    ],
  },
  {
    id: "clockwork-heist",
    title: "One-shot: The Clockwork Heist",
    description: "A four-hour heist for new players.",
    colors: ["#4a2e1a", "#c08a3e"],
    modules: [
      "dice-so-nice",
      "quick-insert",
      "monks-active-tiles",
      "monks-sound-enhancements",
      "raise-my-hand",
      "simple-dice-roller",
      "monks-chat-timer",
      "hurry-up",
      "share-media",
      "loading-screen",
      "socketlib",
      "_chatcommands",
    ],
  },
];
