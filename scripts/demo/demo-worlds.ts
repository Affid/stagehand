// The demo's system, modules and worlds (scripts/demo/setup-demo.ts): free
// modules from Foundry's package list, verified for Foundry 14, each world
// with what its modules require.

export const DEMO_SYSTEM = "worldbuilding";

export const DEMO_MODULES = [
  "dice-so-nice",
  "lib-wrapper",
  "socketlib",
  "sequencer",
  "tokenmagic",
  "monks-tokenbar",
  "monks-little-details",
  "monks-enhanced-journal",
  "smalltime",
  "dice-calculator",
  "token-action-hud-core",
  "quick-insert",
  "monks-active-tiles",
  "monks-sound-enhancements",
  "color-picker",
] as const;

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
    ],
  },
];
