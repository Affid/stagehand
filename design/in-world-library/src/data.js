// Sample data for the in-world library mockup: a world ("Curse of Strahd",
// dnd5e) on a server whose admin keeps a Stagehand library. Module titles and
// authors follow real packages; versions are made up.

const MODULES = [
  // id, title, author, description, version, flags
  ["stagehand", "Stagehand", "Andrei Fedorov", "Companion for Stagehand: your module library in Module Management, and presets for this world.", "0.2.0", {}],
  ["modular-av", "Modular A/V", "Andrei Fedorov", "Audio and video for the table, built from parts.", "0.11.2", {}],
  ["modular-av-livekit", "Modular A/V: LiveKit", "Andrei Fedorov", "LiveKit transport for Modular A/V.", "0.11.2", { requires: ["modular-av"] }],
  ["modular-av-dock", "Modular A/V: Dock", "Andrei Fedorov", "A dock of camera views.", "0.11.0", { requires: ["modular-av"] }],
  ["modular-av-audio-mixer", "Modular A/V: Audio mixer", "Andrei Fedorov", "Per-person volume and effects.", "0.10.4", { requires: ["modular-av"] }],
  ["modular-av-audio-reverb", "Modular A/V: Reverb", "Andrei Fedorov", "Room reverb on voices.", "0.10.4", { requires: ["modular-av-audio-mixer"] }],
  ["lib-wrapper", "libWrapper", "Rui Pinheiro", "Library for wrapping core Foundry VTT methods.", "1.13.2", {}],
  ["socketlib", "socketlib", "Stäbchenfisch", "A library to simplify sending socket messages.", "1.1.3", {}],
  ["tagger", "Tagger", "Wasp", "Tag placeables and find them from macros.", "1.5.3", {}],
  ["dice-so-nice", "Dice So Nice!", "Simone Ricciardi", "3D dice rolls with physics.", "5.2.1", {}],
  ["health-estimate", "Health Estimate", "Mana", "Vague health descriptions on token hover.", "12.0.1", {}],
  ["dfreds-convenient-effects", "DFreds Convenient Effects", "DFreds", "Common status effects, one click away.", "7.1.0", {}],
  ["token-action-hud-core", "Token Action HUD Core", "Larkinabout", "A HUD of a token's actions.", "2.0.12", { requires: ["socketlib"] }],
  ["monks-tokenbar", "Monk's TokenBar", "IronMonk", "A bar of player tokens, saving throws and contested rolls.", "12.0.3", { requires: ["socketlib"] }],
  ["combat-carousel", "Combat Carousel", "Errational", "Turn order as a carousel.", "0.3.1", { unverified: true }],
  ["drag-ruler", "Drag Ruler", "Manuel Vögele", "Rulers while dragging tokens.", "1.13.8", { requires: ["socketlib", "lib-wrapper"], unverified: true }],
  ["df-curvy-walls", "DF Curvy Walls", "Flamewave", "Curved and segmented walls.", "4.1.0", {}],
  ["dungeon-draw", "Dungeon Draw", "Moo Man", "Draw dungeons on the canvas.", "2.4.0", { unverified: true }],
  ["levels-3d-preview", "3D Canvas", "theripper93", "A 3D canvas for your scenes.", "13.1.5", { requires: ["socketlib"] }],
  ["dnd5e-srd-maps", "SRD Battlemaps", "Pack Author", "Battle maps for the SRD.", "1.2.0", { packs: true }],
  ["perfect-vision", "Perfect Vision", "dev7355608", "Vision and lighting rules.", "5.0.6", { requires: ["lib-wrapper"], unverified: true }],
  ["fxmaster", "FXMaster", "Ghost", "Weather, fog and screen filters.", "6.0.4", {}],
  ["torch", "Torch", "Deuce", "Light sources from a token's inventory.", "3.0.1", {}],
  ["tokenmagic", "Token Magic FX", "SecretFire", "Filters and effects on tokens and tiles.", "0.7.4", { requires: ["lib-wrapper"] }],
  ["tidy5e-sheet", "Tidy 5e Sheets", "Kgar", "Alternative character sheets for dnd5e.", "8.3.0", {}],
  ["chat-portrait", "Chat Portrait", "ShoyuVanilla", "Token portraits in chat messages.", "4.0.2", {}],
  ["popout", "PopOut!", "KaKaRoTo", "Pop windows out into their own browser window.", "2.18.0", {}],
  ["smalltime", "SmallTime", "Unsure", "A small clock for the time of day.", "1.21.0", {}],
  ["quick-insert", "Quick Insert", "Sunspots", "Search everything, insert anything.", "3.9.2", {}],
  ["cos-handouts", "Strahd Handouts", "Our table", "Letters, maps and portraits we made for Curse of Strahd.", "1.4.0", { packs: true }],
  ["barovia-maps", "Barovia Battlemaps", "Our table", "Battle maps for Barovia's locations.", "1.1.0", { packs: true }],
  ["simple-calendar", "Simple Calendar", "Vigorator", "A calendar and time keeping.", "2.4.18", { unverified: true }],
  ["item-piles", "Item Piles", "Wasp", "Piles of items, merchants and loot.", "3.1.6", { requires: ["socketlib", "lib-wrapper"] }],
  ["forien-quest-log", "Forien's Quest Log", "Forien", "A quest log for players and GM.", "0.7.11", { unverified: true }],
  ["sequencer", "Sequencer", "Wasp", "Chain effects, sounds and macros together.", "3.5.6", { requires: ["socketlib"] }],
  ["jb2a-free", "JB2A - Jules&Ben's Animated Assets", "Jules & Ben", "Free animated spell effects.", "0.7.7", { packs: true }],
  ["module-credits", "Module Management+", "Ghost", "Changelogs and conflicts for your modules.", "2.2.3", {}],
  ["about-time", "About Time", "Tim Posney", "Events that happen at a game time.", "13.0.2", {}],
].map(([id, title, author, description, version, f]) => ({
  id, title, author, description, version,
  requires: f.requires ?? [], packs: !!f.packs, unverified: !!f.unverified,
}));

/** What "Curse of Strahd" has on when the mockup opens. */
const ACTIVE = [
  "stagehand", "modular-av", "modular-av-livekit", "modular-av-dock", "lib-wrapper", "socketlib",
  "dice-so-nice", "health-estimate", "dfreds-convenient-effects", "token-action-hud-core", "tidy5e-sheet",
  "chat-portrait", "fxmaster", "perfect-vision", "torch", "cos-handouts", "simple-calendar", "sequencer", "jb2a-free",
];

// The server's library, as Setup keeps it in Data/stagehand/library.json.
// Folders are one level, as Setup makes them (it has no subfolders).
const FOLDERS = [
  { id: "voice", name: "Voice & video", color: "#2b4f5c", parentId: null },
  { id: "audio", name: "Audio & ambience", color: "#5a3a6e", parentId: null },
  { id: "combat", name: "Combat", color: "#6e2a2a", parentId: null },
  { id: "maps", name: "Maps & scenes", color: "#2f5a35", parentId: null },
  { id: "light", name: "Lighting & weather", color: "#6b5524", parentId: null },
  { id: "ui", name: "UI & sheets", color: "#3a3f6e", parentId: null },
  { id: "strahd", name: "Curse of Strahd", color: "#5c2433", parentId: null },
  { id: "libs", name: "Libraries", color: "#47434d", parentId: null },
];

const TAGS = [
  { id: "essential", name: "essential", color: "#3fa45b" },
  { id: "heavy", name: "heavy", color: "#d9822a" },
  { id: "beta", name: "beta", color: "#d6b13f" },
  { id: "players", name: "players see it", color: "#4f8fd6" },
];

const FOLDER_OF = {
  "modular-av": "voice", "modular-av-livekit": "voice", "modular-av-dock": "voice",
  "modular-av-audio-mixer": "audio", "modular-av-audio-reverb": "audio",
  "dice-so-nice": "combat", "health-estimate": "combat", "dfreds-convenient-effects": "combat",
  "token-action-hud-core": "combat", "monks-tokenbar": "combat", "combat-carousel": "combat", "drag-ruler": "combat",
  "df-curvy-walls": "maps", "dungeon-draw": "maps", "levels-3d-preview": "maps", "dnd5e-srd-maps": "maps",
  "perfect-vision": "light", "fxmaster": "light", "torch": "light", "tokenmagic": "light",
  "tidy5e-sheet": "ui", "chat-portrait": "ui", "popout": "ui", "smalltime": "ui", "quick-insert": "ui",
  "cos-handouts": "strahd", "barovia-maps": "strahd",
  "lib-wrapper": "libs", "socketlib": "libs", "tagger": "libs",
};

const TAGS_OF = {
  "modular-av": ["essential"], "modular-av-livekit": ["essential"], "lib-wrapper": ["essential"], "socketlib": ["essential"],
  "dice-so-nice": ["essential", "players"], "levels-3d-preview": ["heavy", "beta"], "tokenmagic": ["heavy"],
  "fxmaster": ["heavy"], "perfect-vision": ["beta"], "modular-av-audio-reverb": ["beta"], "chat-portrait": ["players"],
  "tidy5e-sheet": ["players"], "health-estimate": ["players"], "stagehand": ["essential"],
};

const NOTES = {
  "modular-av-livekit": "LiveKit Cloud project: table-night. The server address lives in each world's settings.",
  "perfect-vision": "Fights 3D Canvas over lighting. Never both in one world.",
  "levels-3d-preview": "Slow on Mia's laptop. Only for the big set pieces.",
  "cos-handouts": "Curse of Strahd only. Rebuild the compendium after editing a handout.",
  "fxmaster": "Fog preset 'Barovia mist' is saved in this module's settings.",
  "simple-calendar": "Barovian calendar; check the moon phases after updates.",
};

const PRESETS = [
  { id: "table", name: "Table night", description: "Voice, video and the usual comforts for a session.",
    modules: ["modular-av", "modular-av-livekit", "modular-av-dock", "dice-so-nice", "chat-portrait", "smalltime", "quick-insert", "popout"] },
  { id: "combat", name: "5e combat", description: "Turn order, effects and token actions for dnd5e fights.",
    modules: ["dice-so-nice", "health-estimate", "dfreds-convenient-effects", "token-action-hud-core", "monks-tokenbar", "drag-ruler", "combat-carousel"] },
  { id: "horror", name: "Horror ambience", description: "Fog, darkness and reverb for Barovia.",
    modules: ["fxmaster", "perfect-vision", "torch", "tokenmagic", "modular-av-audio-reverb"] },
  { id: "oneshot", name: "One-shot minimal", description: "Just enough for a one-shot. Use with Replace.",
    modules: ["modular-av", "modular-av-livekit", "dice-so-nice", "health-estimate", "tidy5e-sheet"] },
  { id: "strahd", name: "Strahd content", description: "Handouts, maps and the calendar for Curse of Strahd.",
    modules: ["cos-handouts", "barovia-maps", "simple-calendar", "monks-enhanced-journal"] },
];

/** Not installed on this server, but named by a preset. */
const NOT_INSTALLED = { "monks-enhanced-journal": "Monk's Enhanced Journal" };
