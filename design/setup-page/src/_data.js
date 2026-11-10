// Sample data for the Add-on Modules mockups. The first 19 modules are the
// owner's real ones (titles, descriptions and Foundry tag markup captured from
// the live V14 Setup page); the rest make the 60-module set.
const Q = new URLSearchParams(location.search.slice(1) || location.hash.slice(1));
let VIEW = (Q.get("view") || "tiles").toLowerCase();
const READONLY = Q.get("ro") === "1";
const COUNT = Number(Q.get("n") || 19);
const FIRST_RUN = Q.get("first") === "1";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CAPTURED = /*MODULES_JSON*/[];

const AUTHOR_OF = (id) => (id.startsWith("st-fixture") ? "Stagehand tests" : id === "stagehand" ? "Stagehand" : "Andrei Fedorov");

const EXTRA = [
  ["lib-wrapper", "libWrapper", "Rui Pinheiro", "Library for wrapping core Foundry VTT methods.", { lib: 1 }],
  ["socketlib", "socketlib", "Stäbchenfisch", "A library to simplify sending socket messages.", { lib: 1 }],
  ["dice-so-nice", "Dice So Nice!", "Simone", "3D dice rolls with physics.", {}],
  ["sequencer", "Sequencer", "Wasp", "Chain together effects, sounds and macros.", {}],
  ["jb2a-free", "JB2A - Jules&Ben's Animated Assets", "Jules & Ben", "Free animated spell effects.", { packs: 1 }],
  ["token-action-hud-core", "Token Action HUD Core", "Larkinabout", "A HUD of token actions.", {}],
  ["monks-active-tiles", "Monk's Active Tile Triggers", "IronMonk", "Tiles that trigger actions.", {}],
  ["monks-tokenbar", "Monk's TokenBar", "IronMonk", "A bar of player tokens.", {}],
  ["tidy5e-sheet", "Tidy 5e Sheets", "Kgar", "Alternative character sheets for dnd5e.", {}],
  ["item-piles", "Item Piles", "Wasp", "Piles of items, merchants and loot.", {}],
  ["simple-calendar", "Simple Calendar", "Vigorator", "A calendar and time keeping.", { unverified: 1 }],
  ["combat-carousel", "Combat Carousel", "Errational", "Turn order as a carousel.", { unverified: 1 }],
  ["drag-ruler", "Drag Ruler", "Manuel Vögele", "Rulers while dragging tokens.", { unverified: 1 }],
  ["health-estimate", "Health Estimate", "Mana", "Vague health descriptions.", {}],
  ["dfreds-convenient-effects", "DFreds Convenient Effects", "DFreds", "Common status effects.", {}],
  ["chat-portrait", "Chat Portrait", "ShoyuVanilla", "Token portraits in chat.", {}],
  ["forien-quest-log", "Forien's Quest Log", "Forien", "A quest log.", { unverified: 1 }],
  ["tagger", "Tagger", "Wasp", "Tag placeables.", { lib: 1 }],
  ["lib-themer", "libThemer", "Ghost", "Theme library.", { lib: 1 }],
  ["color-picker-lib", "lib - Color Settings", "Ghost", "Colour picker settings.", { lib: 1 }],
  ["popout", "PopOut!", "KaKaRoTo", "Pop windows out.", {}],
  ["df-curvy-walls", "DF Curvy Walls", "Flamewave", "Curved walls.", {}],
  ["df-chat-enhance", "DF Chat Enhancements", "Flamewave", "Chat archive and more.", {}],
  ["df-templates", "DF Template Enhancements", "Flamewave", "Better templates.", {}],
  ["perfect-vision", "Perfect Vision", "dev7355608", "Vision and lighting.", { unverified: 1 }],
  ["levels-3d-preview", "3D Canvas", "theripper93", "A 3D canvas.", {}],
  ["tokenmagic", "Token Magic FX", "SecretFire", "Filters and effects.", {}],
  ["fxmaster", "FXMaster", "Ghost", "Weather and filters.", {}],
  ["dungeon-draw", "Dungeon Draw", "Moo Man", "Draw dungeons.", { unverified: 1 }],
  ["pf2e-workbench", "PF2e Workbench", "Silvative", "Automation for PF2e.", {}],
  ["pf2e-dorako-ux", "Dorako UX", "Dorako", "UI tweaks.", {}],
  ["dnd5e-srd-maps", "SRD Battlemaps", "Pack Author", "Battle maps for the SRD.", { packs: 1 }],
  ["tavern-tunes", "Tavern Tunes", "Bard Co", "Ambient playlists.", { packs: 1 }],
  ["quick-insert", "Quick Insert", "Sunspots", "Search everything.", {}],
  ["find-the-path", "Find the Path", "Will Saunders", "Path finding.", { unverified: 1 }],
  ["about-time", "About Time", "Tim Posney", "Time based events.", {}],
  ["torch", "Torch", "Deuce", "Light sources from tokens.", {}],
  ["autocomplete-whisper", "Autocomplete Whisper", "Ghost", "Whisper names.", {}],
  ["module-credits", "Module Management+", "Ghost", "Changelogs for modules.", {}],
  ["smalltime", "SmallTime", "Unsure", "A small clock.", {}],
  ["scene-packer", "Library: Scene Packer", "Blair", "Scene import library.", { lib: 1 }],
];

function foundryTags(m) {
  if (m.tagsRight) return m.tagsRight;
  const info = `<span class="tag flexrow" data-tooltip-html="" data-locked><i class="fa-solid fa-circle-info fa-fw" inert></i></span>`;
  const user = `<span class="tag flexrow" data-tooltip-html="${esc(m.author)}" data-locked><i class="fa-solid fa-user fa-fw" inert></i></span>`;
  const packs = m.packs ? `<span class="tag flexrow compendium" data-tooltip aria-label="Compendium"><i class="fa-solid fa-book fa-fw" inert></i></span>` : "";
  const badge = m.unverified
    ? `<span class="tag flexrow badge warning" data-tooltip-html="Package is not verified for this version of Foundry"><i class="fa-solid fa-code-branch fa-fw" inert></i> ${m.version}</span>`
    : `<span class="tag flexrow badge success" data-tooltip-html="Package is verified for this version of Foundry"><i class="fa-solid fa-code-branch fa-fw" inert></i> ${m.version}</span>`;
  return info + user + packs + badge;
}

// Jitsi is shown as not verified for this core build, as Foundry would badge it.
const unverify = (html) => html.replace("badge success", "badge warning").replace("Package is verified", "Package is not verified");
const BASE = CAPTURED.map((c) => ({
  ...c, author: AUTHOR_OF(c.id), lib: c.id === "st-fixture-lib", unverified: c.id === "modular-av-jitsi",
  tagsRight: c.id === "modular-av-jitsi" ? unverify(c.tagsRight) : c.tagsRight,
}));
const EXTRA_MODULES = EXTRA.map(([id, title, author, desc, f], i) => ({
  id, title, author, shortDesc: desc, description: desc, version: `${1 + (i % 4)}.${(i * 7) % 12}.${i % 5}`,
  lib: !!f.lib, packs: !!f.packs, unverified: !!f.unverified,
}));
const ALL_MODULES = [...BASE, ...EXTRA_MODULES]
  .slice(0, Math.max(COUNT, 19))
  .sort((a, b) => a.title.localeCompare(b.title));
const MOD = Object.fromEntries(ALL_MODULES.map((m) => [m.id, m]));

// ---------- the library (folders, tags, notes, presets, usage) ----------
const FOLDERS = FIRST_RUN ? [] : [
  { id: "voice", name: "Voice & video", color: "#2b4f5c" },
  { id: "audio", name: "Audio effects", color: "#5a3a6e" },
  { id: "fixtures", name: "Test fixtures", color: "#6b4a1f" },
  ...(COUNT > 19 ? [
    { id: "combat", name: "Combat", color: "#6e2a2a" },
    { id: "maps", name: "Maps & scenes", color: "#2f5a35" },
    { id: "ui", name: "UI & sheets", color: "#3a3f6e" },
    { id: "libs", name: "Libraries", color: "#444046" },
  ] : []),
];
const TAGS = FIRST_RUN ? [] : [
  { id: "essential", name: "essential", color: "#3fa45b" },
  { id: "audio", name: "audio", color: "#d9822a" },
  { id: "video", name: "video", color: "#4f8fd6" },
  { id: "ui", name: "ui", color: "#a46bd6" },
  { id: "beta", name: "beta", color: "#d6b13f" },
  { id: "test", name: "test", color: "#8c8c8c" },
];
const FOLDER_OF = FIRST_RUN ? {} : {
  "modular-av": "voice", "modular-av-livekit": "voice", "modular-av-livekit-krisp": "voice", "modular-av-jitsi": "voice",
  "modular-av-p2p": "voice", "modular-av-dock": "voice", "modular-av-starter-set": "voice",
  "modular-av-audio-mixer": "audio", "modular-av-audio-echo": "audio", "modular-av-audio-eq": "audio",
  "modular-av-audio-radio": "audio", "modular-av-audio-reverb": "audio", "modular-av-mic-denoise": "audio",
  "st-fixture-a": "fixtures", "st-fixture-b": "fixtures", "st-fixture-lib": "fixtures",
  "dice-so-nice": "combat", "combat-carousel": "combat", "health-estimate": "combat", "dfreds-convenient-effects": "combat",
  "token-action-hud-core": "combat", "monks-tokenbar": "combat", "drag-ruler": "combat",
  "df-curvy-walls": "maps", "dungeon-draw": "maps", "levels-3d-preview": "maps", "perfect-vision": "maps", "fxmaster": "maps", "dnd5e-srd-maps": "maps",
  "tidy5e-sheet": "ui", "pf2e-dorako-ux": "ui", "chat-portrait": "ui", "popout": "ui", "smalltime": "ui", "quick-insert": "ui",
  "lib-wrapper": "libs", "socketlib": "libs", "tagger": "libs", "lib-themer": "libs", "color-picker-lib": "libs", "scene-packer": "libs",
};
const TAGS_OF = FIRST_RUN ? {} : {
  "modular-av": ["essential", "audio", "video"], "modular-av-livekit": ["essential", "video"], "modular-av-dock": ["ui", "video"],
  "modular-av-audio-mixer": ["audio"], "modular-av-audio-echo": ["audio"], "modular-av-audio-eq": ["audio"],
  "modular-av-audio-radio": ["audio", "beta"], "modular-av-audio-reverb": ["audio"], "modular-av-mic-denoise": ["audio", "essential"],
  "modular-av-cam-background": ["video", "beta"], "modular-av-livekit-krisp": ["audio", "beta"], "modular-av-dock-vines": ["ui"],
  "modular-av-jitsi": ["video"], "modular-av-p2p": ["video"],
  "st-fixture-a": ["test"], "st-fixture-b": ["test"], "st-fixture-lib": ["test"], "stagehand": ["essential"],
  "dice-so-nice": ["essential"], "lib-wrapper": ["essential"], "socketlib": ["essential"], "tidy5e-sheet": ["ui"], "pf2e-dorako-ux": ["ui"],
  "levels-3d-preview": ["beta"], "chat-portrait": ["ui"], "popout": ["ui"],
};
const NOTES = FIRST_RUN ? {} : {
  "st-fixture-a": "Installed for the Strahd campaign",
  "modular-av-livekit": "LiveKit Cloud project: table-night. Server URL lives in each world's settings.",
  "modular-av-audio-radio": "Sounds odd above 3 people, check after 0.12",
  "perfect-vision": "Conflicts with 3D Canvas lighting",
};
const USAGE = {
  "modular-av": 4, "modular-av-livekit": 3, "modular-av-dock": 4, "modular-av-audio-mixer": 2, "modular-av-mic-denoise": 3,
  "modular-av-audio-echo": 1, "modular-av-audio-reverb": 1, "modular-av-starter-set": 0, "modular-av-jitsi": 0, "modular-av-p2p": 1,
  "st-fixture-a": 1, "st-fixture-lib": 1, "st-fixture-b": 0, "stagehand": 5, "modular-av-cam-background": 2,
  "modular-av-audio-eq": 1, "modular-av-audio-radio": 0, "modular-av-livekit-krisp": 1, "modular-av-dock-vines": 2,
};
const PRESETS = FIRST_RUN ? [] : [
  { id: "av", name: "A/V essentials", desc: "Voice and video for a normal table night", modules: ["modular-av", "modular-av-livekit", "modular-av-dock", "modular-av-mic-denoise", "modular-av-audio-mixer"] },
  { id: "rack", name: "Full audio rack", desc: "Every audio effect, for horror one-shots", modules: ["modular-av-audio-mixer", "modular-av-audio-echo", "modular-av-audio-eq", "modular-av-audio-radio", "modular-av-audio-reverb"] },
  { id: "bench", name: "Fixture test bench", desc: "Dependency and conflict checks", modules: ["st-fixture-a", "st-fixture-lib", "stagehand"] },
];
const WORLDS = ["Curse of Strahd", "Stagehand test", "Dragon Heist", "Abomination Vaults", "One-shot: Heist Night"];

const folderOf = (id) => FOLDERS.find((f) => f.id === FOLDER_OF[id]) ?? null;
const tagsOf = (id) => (TAGS_OF[id] ?? []).map((t) => TAGS.find((x) => x.id === t)).filter(Boolean);
const usageOf = (id) => USAGE[id] ?? ((id.length * 7) % 5);
const presetsOf = (id) => PRESETS.filter((p) => p.modules.includes(id));
