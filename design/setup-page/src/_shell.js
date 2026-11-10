// Interactive mockup of a new Setup page. All state lives in memory (ST and the sample library),
// so a change made on one page shows on every other page. Nothing is saved.

const IMG = ["fvtt/ui/backgrounds/setup.webp", "fvtt/ui/thumb-dnd5e.webp"];
const WORLDS_X = [
  { id: "strahd", title: "Curse of Strahd", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "2 days ago", img: 0, pos: "30% 40%", desc: "<p>Gothic horror in <strong>Barovia</strong>. Tuesday group, five players, voice through LiveKit.</p><p>House rules:</p><ul><li>Milestone levelling</li><li>Lingering injuries on a critical hit</li><li>No flanking</li></ul><p>Session zero notes, safety tools and the content list are in the <em>Table</em> journal. Read the <a href=\"https://foundryvtt.com/article/game-worlds/\">world guide</a> before the first session.</p>" },
  { id: "sttest", title: "Stagehand test", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "today", img: 1, pos: "center", desc: "Test world for the Stagehand companion." },
  { id: "heist", title: "Dragon Heist", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "5 weeks ago", att: "The last snapshot is 5 weeks old. Launch once to refresh it.", img: 0, pos: "80% 60%", desc: "Waterdeep, alternate Fridays." },
  { id: "vaults", title: "Abomination Vaults", system: "Pathfinder 2e", sysFull: "Pathfinder Second Edition 7.2.0", last: "3 weeks ago", att: "The companion is not enabled in this world yet.", noCompanion: true, img: 1, pos: "20% 80%", desc: "PF2e dungeon crawl." },
  { id: "oneshot", title: "One-shot: Heist Night", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "2 months ago", img: 0, pos: "60% 20%", desc: "A convention one-shot." },
  { id: "avtest", title: "Modular A/V test", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "yesterday", img: 1, pos: "70% 30%", desc: "Test world for Modular A/V." },
];
// "?worlds=12": a busier server, for checking how lists hold up.
if (Q.get("worlds") === "12") WORLDS_X.push(
  { id: "phandelver", title: "Lost Mine of Phandelver", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "4 days ago", img: 0, pos: "45% 55%", desc: "<p>Starter campaign for new players, Sunday afternoons.</p>" },
  { id: "kingmaker", title: "Kingmaker", system: "Pathfinder 2e", sysFull: "Pathfinder Second Edition 7.2.0", last: "yesterday", img: 1, pos: "35% 25%", desc: "<p>Kingdom building in the Stolen Lands.</p>" },
  { id: "deadlands", title: "Deadlands: The Weird West", system: "SWADE", sysFull: "Savage Worlds Adventure Edition 4.4.1", last: "6 weeks ago", img: 0, pos: "85% 35%", desc: "<p>Savage Worlds, monthly.</p>" },
  { id: "stormwreck", title: "Dragons of Stormwreck Isle", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "6 months ago", att: "The companion is not enabled in this world yet.", noCompanion: true, img: 1, pos: "55% 70%", desc: "<p>A one-off for a school club.</p>" },
  { id: "runelords", title: "Rise of the Runelords", system: "Pathfinder 2e", sysFull: "Pathfinder Second Edition 7.2.0", last: "8 months ago", att: "Last saved with Foundry 13: it migrates when it next launches.", img: 0, pos: "15% 45%", desc: "<p>On hold since the spring.</p>" },
  { id: "levels", title: "Test: Scene Levels", system: "D&D 5e", sysFull: "Dungeons & Dragons Fifth Edition 5.1.4", last: "today", img: 1, pos: "65% 60%", desc: "<p>Trying out V14's scene levels.</p>" },
);
const STRAHD_ON = ["modular-av", "modular-av-livekit", "modular-av-dock", "modular-av-audio-mixer", "modular-av-mic-denoise", "modular-av-p2p", "stagehand", "modular-av-cam-background", "modular-av-dock-vines", "st-fixture-a", "st-fixture-lib"];
const SYSTEMS = [
  { id: "dnd5e", title: "Dungeons & Dragons Fifth Edition", author: "Atropos", version: "5.1.4", description: "A system for playing the fifth edition of the world's most popular role-playing game.", used: "5 worlds" },
  { id: "pf2e", title: "Pathfinder Second Edition", author: "The PF2e team", version: "7.2.0", description: "Pathfinder 2e for Foundry VTT.", used: "Abomination Vaults" },
  { id: "swade", title: "Savage Worlds Adventure Edition", author: "FloRad", version: "4.4.1", description: "Savage Worlds.", unverified: true, used: "no world" },
];
const TAG_COLOURS = ["#d9822a", "#3fa45b", "#4f8fd6", "#a46bd6", "#d6b13f", "#8c8c8c", "#d65f5f", "#4fc3c3"];

const ST = {
  page: Q.get("page") || "world", world: Q.get("world") || "strahd",
  view: VIEW, group: Q.get("group") || "folder",
  collapsed: new Set((Q.get("collapsed") || "").split(",").filter(Boolean)),
  wtab: "modules", show: "all", lsub: Q.get("sys") ? "systems" : "modules",
  panel: Q.get("panel") ? { kind: "module", id: Q.get("panel") } : null,
  tagSel: "audio", presetSel: "av",
  select: false, selected: new Set(), news: Q.get("news") === "1", newsSeen: false,
  pop: null, q: "", wq: "",
  changes: new Map([["strahd:modular-av-p2p", false]]),
  presetQueue: { strahd: ["rack"] },
  tagStage: {}, mtab: "library",
  fav: new Set(["modular-av"]), lock: new Set(["modular-av-livekit"]),
};

// ---------- world state ----------
const world = (id = ST.world) => WORLDS_X.find((w) => w.id === id);
/** Days since a world was last played, from the mockup's labels; null if never. */
function playedDaysAgo(w) {
  const t = String(w.last ?? "").toLowerCase();
  if (!t || t === "never") return null;
  if (t === "just now") return -1;
  if (t === "today") return 0;
  if (t === "yesterday") return 1;
  const m = t.match(/(\d+)\s+(day|week|month|year)/);
  return m ? Number(m[1]) * { day: 1, week: 7, month: 30, year: 365 }[m[2]] : null;
}
/** Foundry's own world order (SetupPackages#sortWorlds): favourites, then last played, then never played, then title. */
function worldOrder() {
  const favs = ST.wfav ?? new Set();
  return [...WORLDS_X].sort((a, b) => {
    const fd = Number(favs.has(b.id)) - Number(favs.has(a.id));
    if (fd) return fd;
    const da = playedDaysAgo(a), db = playedDaysAgo(b);
    if (da !== null && db === null) return -1;
    if (db !== null && da === null) return 1;
    if (da !== null && db !== null && da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}
/** Launching makes a world the most recently played, so it moves up, as in Foundry. */
const markPlayed = (id) => { const w = world(id); if (w) w.last = "just now"; };
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const BASE_SETS = {};
function baseSet(wid) {
  if (BASE_SETS[wid]) return BASE_SETS[wid];
  let s;
  if (wid === "strahd") s = new Set(STRAHD_ON);
  else if (wid === "vaults") s = new Set();
  else {
    s = new Set(ALL_MODULES.filter((m) => hash(wid + m.id) % 3 !== 0 && m.id !== "st-fixture-b" && !LATE.has(m.id)).map((m) => m.id));
    s.add("stagehand");
    if ([...s].some((id) => id.startsWith("modular-av-"))) s.add("modular-av");
    if (s.has("st-fixture-a")) s.add("st-fixture-lib");
  }
  BASE_SETS[wid] = s;
  return s;
}
const baseOn = (wid, id) => baseSet(wid).has(id);
const presetOn = (wid, id) => (ST.presetQueue[wid] ?? []).some((pid) => PRESETS.find((p) => p.id === pid)?.modules.includes(id));
const defaultOn = (wid, id) => presetOn(wid, id) || baseOn(wid, id);
function desired(wid, id) {
  const k = `${wid}:${id}`;
  return ST.changes.has(k) ? ST.changes.get(k) : defaultOn(wid, id);
}
function setDesired(wid, id, on) {
  if (id === "stagehand" && !on) { notify("The companion always stays on, so the world can report back.", "warning"); return; }
  const k = `${wid}:${id}`;
  if (on === defaultOn(wid, id)) ST.changes.delete(k); else ST.changes.set(k, on);
}
function diff(wid) {
  return ALL_MODULES.filter((m) => desired(wid, m.id) !== baseOn(wid, m.id))
    .map((m) => ({ id: m.id, on: desired(wid, m.id), manual: ST.changes.has(`${wid}:${m.id}`) }));
}
const onCount = (wid, use = desired) => ALL_MODULES.filter((m) => use(wid, m.id)).length;

function problems(wid) {
  const on = new Set(ALL_MODULES.filter((m) => desired(wid, m.id)).map((m) => m.id));
  const out = [];
  const needAv = [...on].filter((id) => id.startsWith("modular-av-"));
  if (needAv.length && !on.has("modular-av")) out.push({ text: `${needAv.length} A/V module${needAv.length > 1 ? "s need" : " needs"} Modular A/V, which is off.`, fix: "Turn it on", id: "modular-av", on: true });
  if (on.has("st-fixture-a") && !on.has("st-fixture-lib")) out.push({ text: "Stagehand Fixture: A needs Stagehand Fixture: library.", fix: "Turn it on", id: "st-fixture-lib", on: true });
  if (on.has("st-fixture-a") && on.has("st-fixture-b")) out.push({ text: "Stagehand Fixture: B conflicts with Stagehand Fixture: A.", fix: "Turn B off", id: "st-fixture-b", on: false });
  return out;
}

// ---------- small renderers ----------
const short = (id) => esc((MOD[id]?.title ?? id).replace("Modular A/V: ", "A/V: ").replace(/ — .*$/, ""));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function topBar() {
  const menu = [["fa-triangle-exclamation", "", "Support & issues"], ["fa-gears", "", "Configuration"], ["fa-download", '<span class="pip">!</span>', "Update Foundry"], ["fa-floppy-disks", "", "Backups"], ["fa-door-open", "", "Log out"], ["fa-power-off", "", "Shut down"]]
    .map(([i, pip, l]) => `<button type="button" class="icon" data-act="foundry" data-what="${l}" data-tooltip="${l}" aria-label="${l}"><i class="fa-solid ${i}"></i>${pip}</button>`).join("");
  const news = `<button type="button" class="sts-news${ST.news ? " st-on" : ""}" data-act="news" aria-expanded="${ST.news}"><i class="fa-solid fa-newspaper"></i>News${ST.newsSeen ? "" : '<span class="pip dot"></span>'}</button>`;
  return `<header class="sts-top"><span class="logo" aria-hidden="true"></span><h1>Foundry Virtual Tabletop</h1><span class="st-spacer"></span><div class="sts-menu">${news}${menu}</div></header>`;
}

function rail() {
  // Favourites first, as Foundry orders its own list.
  const favs = ST.wfav ?? new Set(), locks = ST.wlock ?? new Set();
  const ordered = worldOrder();
  const worlds = ordered.filter((w) => !ST.wq || w.title.toLowerCase().includes(ST.wq.toLowerCase())).map((w) => {
    const flag = railFlag(w);
    const marks = `${favs.has(w.id) ? '<i class="fa-solid fa-star sts-wfav" aria-label="Favourite"></i>' : ""}${locks.has(w.id) ? '<i class="fa-solid fa-lock sts-wlock" aria-label="Locked"></i>' : ""}`;
    return `<li class="sts-world${ST.page === "world" && w.id === ST.world ? " sts-on" : ""}" data-act="world" data-id="${w.id}"><span class="thumb" style="--img:url(${IMG[w.img]});background-position:${w.pos}"></span><strong>${marks}${esc(w.title)}</strong>${flag}<span class="meta">${w.system} · ${w.last}</span></li>`;
  }).join("");
  return `<aside class="application framed sts-rail" aria-label="Worlds and library">
    <a class="sts-lib${ST.page === "library" ? " sts-on" : ""}" data-act="library"><i class="fa-solid fa-books"></i><strong>Library${ST.fresh.size ? ` <span class="sts-newtag" data-tooltip="Installed since you last sorted">${ST.fresh.size} new</span>` : ""}</strong><span>${ALL_MODULES.length} modules · 3 systems · 2 updates</span></a>
    <h2 class="divider">Game Worlds</h2>
    <div class="sts-railbar"><input type="search" data-filter="worlds" value="${esc(ST.wq)}" placeholder="Filter worlds (${WORLDS_X.length})"><button type="button" class="icon" data-act="foundry" data-what="Create World" data-tooltip="Create World"><i class="fa-solid fa-plus"></i></button></div>
    <ol class="sts-worlds">${worlds}</ol></aside>`;
}

function vmodes() {
  const b = (id, icon, label) => `<button type="button" class="view-mode icon fa-solid ${icon}${ST.view === id ? " active" : ""}" data-act="view" data-id="${id}" aria-label="${label}" data-tooltip="${label}"></button>`;
  return `<div class="view-modes">${b("gallery", "fa-image-landscape", "Gallery")}${b("tiles", "fa-grid-horizontal", "Tiles")}${b("details", "fa-list", "Details")}</div>`;
}
const GROUPS = { folder: "Folder", author: "Author", preset: "Preset", tag: "Tag", smart: "Smart group" };
const groupSelect = () => `<span class="st-label">Group by</span><select data-change="group" aria-label="Group by">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}"${k === ST.group ? " selected" : ""}>${v}</option>`).join("")}</select>`;

// ---------- a world's page ----------
function worldCard(w, m) {
  const now = desired(w.id, m.id), was = baseOn(w.id, m.id);
  const plus = now && !was, minus = !now && was;
  let html = card(m, { check: true, selected: now, detailExtra: ST.view === "details" ? detailExtra(m) : "" });
  const viewing = ST.panel?.kind === "module" && ST.panel.id === m.id;
  html = html.replace("st-selected", "").replace(/<a class="control package-update"[\s\S]*?<\/a>/, "")
    .replace('class="package module', `class="package module ${now ? "" : "sts-off"} ${plus ? "sts-plus" : ""} ${minus ? "sts-minus" : ""} ${viewing ? "st-selected" : ""}`)
    .replace(/<label class="st-check" aria-label="Select ([^"]+)">/, `<label class="st-check" aria-label="$1 on in ${esc(w.title)}" data-tooltip="${now ? "On" : "Off"} at the next launch">`)
    .replace('<input type="checkbox"', `<input type="checkbox" data-act="toggle" data-id="${m.id}"${w.noCompanion ? " disabled" : ""}`);
  if (plus || minus) html = html.replace('<div class="tags flexrow left">', `<div class="tags flexrow left"><span class="tag flexrow sts-delta ${plus ? "plus" : "minus"}">${plus ? "turns on" : "turns off"}</span>`);
  return html;
}

function worldSections(w) {
  const keep = (m) => ST.show === "all" || (ST.show === "on" ? desired(w.id, m.id) : desired(w.id, m.id) !== baseOn(w.id, m.id));
  return groupsFor(ST.group, ALL_MODULES).map((g) => {
    const mods = g.modules.filter(keep);
    if (!mods.length && ST.show !== "all") return "";
    const on = g.modules.filter((m) => desired(w.id, m.id)).length;
    const collapsed = ST.collapsed.has(g.key);
    const style = g.color && g.kind === "folder" ? `--sidebar-folder-color:${g.color}` : g.color ? `--st-c:${g.color}` : "";
    return `<li class="folder st-section${collapsed ? "" : " expanded"}" data-group="${esc(g.key)}"><header class="folder-header st-section-header ${g.kind}" style="${style}" data-act="collapse" data-id="${esc(g.key)}" aria-expanded="${!collapsed}">
      <i class="fa-solid ${collapsed ? "fa-folder" : g.icon} fa-fw"></i>${g.kind === "tag" ? '<i class="st-dot"></i>' : ""}<span class="folder-name">${esc(g.name)}</span>
      <span class="st-count">${on} of ${g.modules.length} on</span>
      ${w.noCompanion ? "" : `<button type="button" class="st-hbtn" data-act="gmenu" data-id="${esc(g.key)}" aria-label="${esc(g.name)}: actions" data-tooltip="Turn all on or off"><i class="fa-solid fa-ellipsis-vertical"></i></button>`}
      <i class="fa-solid fa-chevron-${collapsed ? "right" : "down"} st-caret"></i></header>
      ${collapsed ? "" : `<ol class="package-list ${ST.view} st-cards">${mods.map((m) => worldCard(w, m)).join("")}</ol>`}</li>`;
  }).join("");
}

function worldPage() {
  const w = world();
  const n = w.noCompanion ? 0 : diff(w.id).length;
  let banner = `<div class="sts-banner" style="--img:url(${IMG[w.img]});--pos:${w.pos}"><div><h2>${esc(w.title)}</h2>
    <div class="meta"><span><i class="fa-solid fa-dice-d20"></i>${esc(w.sysFull)}</span><span><i class="fa-solid fa-code-branch"></i>Core 14.369</span><span><i class="fa-solid fa-clock"></i>Last played ${w.last}</span><span><i class="fa-solid fa-plug"></i>${w.noCompanion ? "Modules unknown" : `${onCount(w.id, baseOn)} modules on now`}</span></div></div>
    <div class="acts"><button type="button" class="icon" data-act="foundry" data-what="Edit World" data-tooltip="Edit World"><i class="fa-solid fa-pen"></i></button><button type="button" class="icon" data-act="wmenu" data-tooltip="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>
    <button type="button" class="bright sts-launch" data-act="launch"><i class="fa-solid fa-play"></i>Launch</button></div></div>`;
  const t = (id, icon, label, c = "") => `<a class="${ST.wtab === id ? "active" : ""}" data-act="wtab" data-id="${id}"><i class="fa-solid ${icon}"></i>${label}${c ? ` <span class="c">${c}</span>` : ""}</a>`;
  let tabs = `<nav class="sts-subtabs">${t("modules", "fa-plug", "Modules", w.noCompanion ? "" : diff(w.id).length ? `${onCount(w.id)} after launch` : `${onCount(w.id)} on`)}${t("about", "fa-scroll", "About")}${t("backups", "fa-floppy-disks", "Backups", "3")}</nav>`;
  let body;
  if (ST.wtab === "about") {
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    body = `<div class="sts-pane"><p>${esc(w.desc)}</p><table>
      ${row("Title", esc(w.title))}${row("Folder", `<code>worlds/${w.id}</code>`)}${row("System", esc(w.sysFull))}
      ${row("Compatibility", "Core 14 · verified 14.369")}${row("Next session", w.id === "strahd" ? "Tue 10 Nov, 19:00" : "Not set")}
      ${row("Background", `<span class="sts-bgthumb" style="--img:url(${IMG[w.img]});background-position:${w.pos}"></span>`)}${row("Last played", w.last)}</table>
      <div class="sts-foundry-acts"><button type="button" data-act="foundry" data-what="Edit World"><i class="fa-solid fa-pen"></i>Edit World…</button>
        <button type="button" data-act="foundry" data-what="Reset User Access"><i class="fa-solid fa-key"></i>Reset user access</button>
        <button type="button" data-act="foundry" data-what="Migrate World Data"><i class="fa-solid fa-database"></i>Migrate data</button>
        <button type="button" data-act="foundry" data-what="Delete World"><i class="fa-solid fa-trash"></i>Delete World</button></div>
      <p class="st-muted" style="font-size:12px">These are Foundry's own world details; Edit opens Foundry's World configuration. Settings stored inside the world (module settings, users, permissions) can only be changed in the world.</p></div>`;
  } else if (ST.wtab === "backups") {
    body = `<div class="sts-pane"><table><tr><td>Before V14 migration</td><td>14 Mar 2026</td><td>412 MB</td></tr><tr><td>Session 23</td><td>2 Oct 2026</td><td>430 MB</td></tr><tr><td>Session 31</td><td>3 Nov 2026</td><td>441 MB</td></tr></table>
      <button type="button" data-act="foundry" data-what="Take Backup"><i class="fa-solid fa-floppy-disk"></i>Take a backup</button><p class="st-muted" style="font-size:12px">Backups are Foundry's own: we call its backup and restore.</p></div>`;
  } else if (w.noCompanion) {
    body = `<div class="sts-notice"><i class="fa-solid fa-puzzle-piece"></i><span>Stagehand can't see or change this world's modules until its companion is enabled. Launch the world and turn on <b>Stagehand</b> in Manage Modules once.</span></div>
      <ol class="st-sections scrollable sts-world-cards">${worldSections(w)}</ol>`;
  } else {
    const seg = (id, l) => `<span class="${ST.show === id ? "on" : ""}" data-act="show" data-id="${id}">${l}</span>`;
    const ctrl = `<div class="st-row"><span class="st-seg2">${seg("all", `All ${ALL_MODULES.length}`)}${seg("on", `On ${onCount(w.id)}`)}${seg("changes", `Changes ${n}`)}</span>
      ${groupSelect()}<input type="search" data-filter="cards" value="${esc(ST.q)}" placeholder="Filter modules"><span class="st-spacer"></span>
      <button type="button" data-act="presetpop"><i class="fa-solid fa-layer-group"></i>Add a preset…</button><button type="button" class="icon" data-act="copyfrom" data-tooltip="Copy modules from another world" aria-label="Copy modules from another world"><i class="fa-solid fa-copy"></i></button>${vmodes()}</div>`;
    body = `${pendingStrip(w)}${ctrl}<ol class="st-sections scrollable sts-world-cards">${worldSections(w)}</ol>`;
  }
  if (CALM) ({ banner, tabs, body } = calmWorld(w, { banner, tabs, body }));
  const back = REVIEW_AT_LAUNCH ? "Close" : "Back to Next launch";
  const close = `<button type="button" class="icon sts-close" data-act="closepanel" aria-label="${back}" data-tooltip="${back}"><i class="fa-solid fa-xmark"></i></button>`;
  const side = ST.panel?.kind === "module" && MOD[ST.panel.id] ? modulePanel(close)
    : ST.panel?.kind === "copy" && ST.copy ? copyPanel(close)
    : REVIEW_AT_LAUNCH ? "" : worldPanel(w);
  return `<section id="setup-packages" class="application framed sts-main">${banner}<div class="sts-body-main">${tabs}${body}</div></section>${side}`;
}

function worldPanel(w) {
  if (w.noCompanion) {
    return `<aside class="application framed sts-panel"><h2 class="divider">Next launch</h2><div class="scroll">
      <p class="lead">Nothing can be queued for ${esc(w.title)} yet: the companion isn't enabled there. Once it is, this panel lists what changes at the next launch.</p></div></aside>`;
  }
  const d = diff(w.id);
  const manual = d.filter((c) => c.manual);
  const row = (c) => `<li><span class="s ${c.on ? "plus" : "minus"}">${c.on ? "+" : "−"}</span><span>${short(c.id)}</span><a class="x" data-act="undo" data-id="${c.id}" aria-label="Undo" data-tooltip="Undo"><i class="fa-solid fa-xmark"></i></a></li>`;
  const presets = (ST.presetQueue[w.id] ?? []).map((pid) => {
    const p = PRESETS.find((x) => x.id === pid);
    const mine = d.filter((c) => !c.manual && p.modules.includes(c.id));
    const list = mine.length ? mine.map(row).join("") : `<li class="none" style="grid-template-columns:1fr">Everything in it is already on.</li>`;
    return `<div class="sts-chg"><h4><span>Preset · ${esc(p.name)}</span><a data-act="unpreset" data-id="${pid}">Remove</a></h4><ul>${list}</ul></div>`;
  }).join("");
  const probs = problems(w.id);
  const check = probs.length
    ? `<div class="sts-checks">${probs.map((p) => `<div class="sts-check warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(p.text)} <a data-act="fix" data-id="${p.id}" data-on="${p.on}">${p.fix}</a></span></div>`).join("")}</div>`
    : `<div class="sts-check ok"><i class="fa-solid fa-circle-check"></i><span>Dependencies are met and nothing conflicts. ${onCount(w.id, baseOn)} → ${onCount(w.id)} modules on.</span></div>`;
  const mine = `<div class="sts-chg"><h4><span>Your changes</span>${manual.length ? '<a data-act="undoall">Undo all</a>' : ""}</h4><ul>${manual.length ? manual.map(row).join("") : '<li class="none" style="grid-template-columns:1fr">Flip a switch on a card, or add a preset.</li>'}</ul></div>`;
  return `<aside class="application framed sts-panel" aria-label="Next launch"><h2 class="divider">Next launch</h2>
    <div class="scroll"><p class="lead">${d.length ? `These ${plural(d.length, "change")} apply when ${esc(w.title)} next launches. You confirm them in the world.` : `Nothing queued for ${esc(w.title)}.`}</p>
      ${d.length || probs.length ? check : ""}${presets}${mine}
      <div class="sts-chg"><h4><span>World</span></h4><ul style="gap:6px">
        <li><i class="fa-solid fa-camera" style="color:var(--color-light-4)"></i><span>Snapshot from ${w.last}</span><span></span></li>
        <li><i class="fa-solid fa-puzzle-piece" style="color:var(--color-light-4)"></i><span>Companion 0.1.0, on</span><span></span></li></ul></div></div>
    <footer><button type="button" data-act="discard"${d.length ? "" : " disabled"}><i class="fa-solid fa-trash"></i>Discard all</button><button type="button" class="bright" data-act="launch"><i class="fa-solid fa-play"></i>Launch</button></footer></aside>`;
}

// ---------- the Library ----------
function libraryPage() {
  const sys = ST.lsub === "systems";
  const t = (id, icon, label, c) => `<a class="${ST.lsub === id ? "active" : ""}" data-act="lsub" data-id="${id}"><i class="fa-solid ${icon}"></i>${label} <span class="c">${c}</span></a>`;
  const tabs = `<nav class="sts-subtabs">${t("modules", "fa-plug", "Modules", ALL_MODULES.length)}${t("systems", "fa-dice", "Systems", 3)}${t("grid", "fa-table-cells", "By world", WORLDS_X.length)}</nav>`;
  if (ST.lsub === "grid") return `<section id="setup-packages" class="application framed sts-main"><div class="sts-body-main">${tabs}${gridBody()}</div></section>${libraryPanel()}`;
  const fctrl = `<header class="controls flexrow"><label class="filter search"><input type="search" data-filter="cards" value="${esc(ST.q)}" placeholder="Filter ${sys ? "Systems (3)" : `Modules (${ALL_MODULES.length})`}"></label>
    <button type="button" data-act="foundry" data-what="Install ${sys ? "System" : "Module"}"><i class="fa-solid fa-download"></i><span>Install ${sys ? "System" : "Module"}</span></button><button type="button" data-act="foundry" data-what="Update All"><i class="fa-solid fa-cloud-arrow-down"></i><span>Update All</span></button>
    <div class="view-modes">${["gallery:fa-image-landscape:Gallery", "tiles:fa-grid-horizontal:Tiles", "details:fa-list:Details"].map((s) => { const [id, ic, l] = s.split(":"); return `<button type="button" class="view-mode icon fa-solid ${ic}${ST.view === id ? " active" : ""}" data-act="view" data-id="${id}" aria-label="${l}"></button>`; }).join("")}</div></header>`;
  let body;
  if (sys) {
    body = `<ol class="package-list ${ST.view} scrollable" style="height:auto">${SYSTEMS.map((s) => card({ ...s, shortDesc: s.description }, { deco: false }).replace('<div class="tags flexrow right">', `<div class="tags flexrow right"><span class="tag flexrow" data-tooltip="Used by ${s.used}"><i class="fa-solid fa-globe fa-fw"></i>${s.used}</span>`)).join("")}</ol>`;
  } else {
    const on = (b) => (b ? " st-on" : "");
    const lib = ST.select ? selBar() : `<div class="st-row">${groupSelect()}<span class="st-spacer"></span>
      <button type="button" class="${on(ST.select)}" data-act="select" aria-pressed="${ST.select}"><i class="fa-solid fa-square-check"></i>Select</button>
      <button type="button" class="icon" data-act="collapseall" data-tooltip="Collapse or expand all"><i class="fa-solid fa-angles-up"></i></button>
      <button type="button" class="icon" data-act="newfolder" data-tooltip="New folder"><i class="fa-solid fa-folder-plus"></i></button>
      <button type="button" class="${on(ST.panel?.kind === "tags")}" data-act="panel" data-id="tags"><i class="fa-solid fa-tags"></i>Tags</button>
      <button type="button" class="${on(ST.panel?.kind === "presets")}" data-act="panel" data-id="presets"><i class="fa-solid fa-layer-group"></i>Presets</button>
      <button type="button" class="icon" data-act="foundry" data-what="Import and export" data-tooltip="Import and export"><i class="fa-solid fa-file-export"></i></button></div>`;
    const list = sections(groupsFor(ST.group, ALL_MODULES), {
      collapsed: [...ST.collapsed], hints: true, noMore: false, menuOn: ST.pop?.kind === "lmenu" ? ST.pop.key : undefined,
      cardOpts: (m) => ({ check: ST.select, selected: ST.select ? ST.selected.has(m.id) : ST.panel?.id === m.id, detailExtra: ST.view === "details" ? detailExtra(m) : "" }),
      emptyText: () => "No modules here. Select some and use Move to.",
    }).replace('class="st-sections scrollable"', `class="st-sections scrollable${ST.select && ST.selected.size ? " sts-has-bar" : ""}"`)
      .replace(/<header class="folder-header st-section-header/g, '<header data-act="collapse" class="folder-header st-section-header')
      .replace(/(<li class="folder st-section[^"]*" data-group="([^"]+)">\s*<header data-act="collapse")/g, '$1 data-id="$2"')
      .replace(/<button type="button" class="st-hbtn/g, '<button type="button" data-act="lmenu" class="st-hbtn')
      .replace(/(<header data-act="collapse" data-id="([^"]+)"[^>]*>)/g, (m0, h, key) => (ST.select ? h + groupCheck(key) : h));
    const fresh = list.replace(/(<li class="package module[^"]*" data-package-id="([^"]+)">[\s\S]*?<div class="tags flexrow left">)/g, (m0, head, id) => (ST.fresh.has(id) ? `${head}<span class="tag flexrow sts-newtag">New</span>` : m0));
    body = intakeBand() + lib + fresh;
  }
  return calmLibrary(`<section id="setup-packages" class="application framed sts-main"><div class="sts-body-main">${tabs}${fctrl}${body}</div></section>${libraryPanel()}`);
}

function selBar() {
  const n = ST.selected.size, dis = n ? "" : " disabled";
  const b = (id, icon, label) => `<button type="button" data-act="bulk" data-id="${id}"${dis}><i class="fa-solid ${icon}"></i>${label}</button>`;
  return `<div class="st-row sts-selbar" role="toolbar" aria-label="Selection"><i class="fa-solid fa-square-check"></i>
    <strong class="sts-selcount" data-tooltip="Click cards, or tick a group's box">${n ? `${n} selected` : "None selected"}</strong>
    <button type="button" data-act="selall">All shown</button><button type="button" data-act="clearsel"${dis}>None</button><span class="sts-sep"></span>
    ${b("move", "fa-folder", "Move to")}${b("tags", "fa-tags", "Tags")}${b("preset", "fa-layer-group", "Add to preset")}${b("world", "fa-globe", "Turn on in a world…")}
    <span class="st-spacer"></span><button type="button" class="bright" data-act="select">Done</button></div>`;
}

function groupCheck(key) {
  const g = groupsFor(ST.group, ALL_MODULES).find((x) => esc(x.key) === key);
  const ids = g?.modules.map((m) => m.id) ?? [];
  const n = ids.filter((id) => ST.selected.has(id)).length;
  if (!ids.length) return "";
  return `<input type="checkbox" class="sts-gcheck" data-act="gsel" data-id="${key}" ${n === ids.length ? "checked" : ""} data-indeterminate="${n > 0 && n < ids.length}" aria-label="Select all in ${key}" data-tooltip="Select the whole group">`;
}

function bulkBar() {
  if (!ST.select || !ST.selected.size) return "";
  return `<div class="st-bulk sta-bulk" role="toolbar" aria-label="${ST.selected.size} selected"><strong>${ST.selected.size} selected</strong>
    <button type="button" data-act="bulk" data-id="move"><i class="fa-solid fa-folder"></i>Move to</button>
    <button type="button" data-act="bulk" data-id="tags"><i class="fa-solid fa-tags"></i>Tags</button>
    <button type="button" data-act="bulk" data-id="preset"><i class="fa-solid fa-layer-group"></i>Add to preset</button>
    <button type="button" data-act="bulk" data-id="world"><i class="fa-solid fa-globe"></i>Turn on in a world…</button>
    <span class="st-sep"></span><button type="button" class="icon" data-act="clearsel" aria-label="Clear selection" data-tooltip="Clear"><i class="fa-solid fa-xmark"></i></button></div>`;
}

function libraryPanel() {
  if (!ST.panel) return "";
  const close = `<button type="button" class="icon sts-close" data-act="closepanel" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>`;
  if (ST.panel.kind === "tags") return tagsPanel(close);
  if (ST.panel.kind === "presets") return presetsPanel(close);
  if (ST.panel.kind === "system") return systemPanel(close);
  if (ST.panel.kind === "intake") return intakePanel(close);
  return modulePanel(close);
}

function modulePanel(close) {
  const m = MOD[ST.panel.id];
  const folderOpts = [`<option value="">Unfiled</option>`, ...FOLDERS.map((f) => `<option value="${f.id}"${FOLDER_OF[m.id] === f.id ? " selected" : ""}>${esc(f.name)}</option>`)].join("");
  const tags = tagsOf(m.id).map((t) => `<span class="st-chip"><i class="st-dot" style="--st-c:${t.color}"></i>${esc(t.name)}<i class="fa-solid fa-xmark" data-act="untag" data-id="${t.id}" aria-label="Remove tag ${esc(t.name)}"></i></span>`).join("")
    + `<span class="st-chip" style="padding:0 8px" data-act="addtag" aria-label="Add tag"><i class="fa-solid fa-plus" style="font-size:10px"></i></span>`;
  const presets = presetsOf(m.id).map((p) => `<span class="st-chip" style="padding:0 8px"><i class="fa-solid fa-layer-group" style="font-size:10px"></i>${esc(p.name)}</span>`).join("") || '<span class="st-muted">None</span>';
  const worlds = WORLDS_X.map((w) => {
    if (w.noCompanion) return `<li><span>${esc(w.title)}</span><span class="d na">companion off</span><input type="checkbox" class="sts-switch" disabled></li>`;
    const now = desired(w.id, m.id), was = baseOn(w.id, m.id);
    const d = now === was ? "<span></span>" : `<span class="d ${now ? "plus" : "minus"}">${now ? "on" : "off"} at next launch</span>`;
    const here = ST.page === "world" && w.id === ST.world;
    return `<li class="${here ? "sts-here" : ""}"><span>${esc(w.title)}${here ? ' <span class="st-muted">· this world</span>' : ""}</span>${d}<input type="checkbox" class="sts-switch" data-act="wtoggle" data-id="${w.id}" ${now ? "checked" : ""} aria-label="On in ${esc(w.title)}"></li>`;
  }).join("");
  const onIn = WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, m.id)).length;
  const t = (id, icon, label) => `<a class="${ST.mtab === id ? "active" : ""}" data-act="mtab" data-id="${id}"><i class="fa-solid ${icon}"></i>${label}</a>`;
  const head = `<div class="sts-modhead"><h3>${esc(m.title)}</h3><div class="sub">${m.id} · v${m.version ?? "0.11.0"} · ${esc(m.author)}</div></div>
      <nav class="sts-subtabs">${t("library", "fa-books", "Library")}${t("package", "fa-box-open", "Package")}</nav>`;
  if (ST.mtab === "package") return `<aside class="application framed sts-panel" aria-label="Module"><h2 class="divider">Module</h2>${close}<div class="scroll">${head}${packageInfo(m, "Module")}</div></aside>`;
  return `<aside class="application framed sts-panel" aria-label="Module"><h2 class="divider">Module</h2>${close}
    <div class="scroll">
      ${head}
      <div class="sts-kv"><span>Folder</span><select data-change="folder">${folderOpts}</select>
        <span>Tags</span><div class="chips">${tags}</div>
        <span>Note</span><textarea data-change="note" placeholder="A note only you see">${esc(NOTES[m.id] ?? "")}</textarea>
        <span>Presets</span><div class="chips">${presets}</div></div>
      <div class="sts-chg"><h4><span>On in worlds · ${onIn} of ${WORLDS_X.length}</span></h4><ul class="sts-wlist">${worlds}</ul></div>
    </div></aside>`;
}

function pkgOf(m) {
  const req = m.id === "st-fixture-a" ? ["st-fixture-lib"] : m.id.startsWith("modular-av-") ? ["modular-av"] : [];
  const rec = m.id === "modular-av" ? ["modular-av-livekit", "modular-av-dock"] : m.id === "modular-av-livekit" ? ["modular-av-mic-denoise"] : [];
  const conf = m.id === "st-fixture-b" ? ["st-fixture-a"] : [];
  const packs = m.id === "modular-av-starter-set" ? ["Starter macros", "Sound board scenes"] : m.packs ? ["Content"] : [];
  return { req, rec, conf, packs, verified: m.unverified ? "13.351" : "14.369", langs: ["English"] };
}

/** Foundry's own data about an installed package, read from its manifest, plus Foundry's own controls. */
function packageInfo(m, kind) {
  const p = pkgOf(m);
  const rel = (ids, verb, cls) => ids.map((id) => `<li><span class="s ${cls}"><i class="fa-solid ${cls === "minus" ? "fa-ban" : cls === "plus" ? "fa-link" : "fa-thumbs-up"}"></i></span><span>${verb} ${short(id)}</span><span class="x">${MOD[id] ? "installed" : "not installed"}</span></li>`).join("");
  const rels = rel(p.req, "Needs", "plus") + rel(p.rec, "Recommends", "rec") + rel(p.conf, "Conflicts with", "minus");
  const badge = m.unverified ? `<span class="sts-badge warn"><i class="fa-solid fa-code-branch"></i>verified for 13.351 only</span>` : `<span class="sts-badge ok"><i class="fa-solid fa-code-branch"></i>verified for 14.369</span>`;
  const link = (l) => `<a data-act="foundry" data-what="${l} (opens the package's own page)">${l}</a>`;
  const sw = (act, on, label, hint) => `<li><span>${label}<br><span class="st-muted" style="font-size:11.5px">${hint}</span></span><span></span><input type="checkbox" class="sts-switch" data-act="${act}" data-id="${m.id}" ${on ? "checked" : ""} aria-label="${label}"></li>`;
  return `<div class="sts-kv"><span>Version</span><span>${m.version ?? "0.11.0"} ${badge}</span>
      <span>Needs</span><span>Foundry 13 or newer</span>
      <span>Authors</span><span>${esc(m.author)}</span>
      <span>Links</span><span class="sts-links">${["Project", "Readme", "Changelog", "License", "Report a bug"].map(link).join(" · ")}</span></div>
    ${rels ? `<div class="sts-chg"><h4><span>Relationships</span></h4><ul>${rels}</ul></div>` : ""}
    <div class="sts-chg"><h4><span>Contents</span></h4><ul>
      <li><span class="s"><i class="fa-solid fa-book"></i></span><span>${p.packs.length ? `${plural(p.packs.length, "compendium pack")}: ${p.packs.join(", ")}` : "No compendium packs"}</span><span></span></li>
      <li><span class="s"><i class="fa-solid fa-language"></i></span><span>${p.langs.join(", ")}</span><span></span></li></ul></div>
    <div class="sts-chg"><h4><span>On this server</span></h4><ul class="sts-wlist">
      ${sw("fav", ST.fav.has(m.id), "Favourite", "Foundry's star: shows first in its lists")}
      ${sw("lockpkg", ST.lock.has(m.id), "Lock updates", "Foundry skips it in Update All")}</ul>
      <div class="sts-foundry-acts" style="margin-top:8px">
        <button type="button" data-act="foundry" data-what="Edit ${kind}"><i class="fa-solid fa-pen-to-square"></i>Edit manifest…</button>
        <button type="button" data-act="foundry" data-what="Check for update"><i class="fa-solid fa-rotate"></i>Check update</button>
        <button type="button" data-act="foundry" data-what="Take Backup"><i class="fa-solid fa-floppy-disk"></i>Backup</button>
        <button type="button" data-act="foundry" data-what="Uninstall"><i class="fa-solid fa-trash"></i>Uninstall</button></div></div>
    <p class="st-muted" style="font-size:12px;margin:0">Read from the ${kind.toLowerCase()}'s manifest. Favourite and lock are Foundry's own settings; the buttons open Foundry's own dialogs.</p>`;
}

function systemPanel(close) {
  const s = SYSTEMS.find((x) => x.id === ST.panel.id);
  const users = WORLDS_X.filter((w) => w.system === (s.id === "dnd5e" ? "D&D 5e" : s.id === "pf2e" ? "Pathfinder 2e" : "-"));
  return `<aside class="application framed sts-panel" aria-label="System"><h2 class="divider">System</h2>${close}<div class="scroll">
    <div class="sts-modhead"><h3>${esc(s.title)}</h3><div class="sub">${s.id} · v${s.version} · ${esc(s.author)}</div></div>
    <div class="sts-chg"><h4><span>Used by ${plural(users.length, "world")}</span></h4><ul>${users.map((w) => `<li data-act="world" data-id="${w.id}"><span class="s"><i class="fa-solid fa-globe"></i></span><span>${esc(w.title)}</span><span class="x">open</span></li>`).join("") || '<li class="none" style="grid-template-columns:1fr">No world uses it. Safe to uninstall.</li>'}</ul></div>
    ${packageInfo(s, "System")}</div></aside>`;
}

function moduleChecks(isOn, act) {
  return groupsFor("folder", ALL_MODULES).map((g) => g.modules.length ? `<li class="grp">${esc(g.name)}</li>${g.modules.map((m) => `<li><label><input type="checkbox" data-act="${act}" data-id="${m.id}" ${isOn(m) ? "checked" : ""}>${esc(m.title)}</label></li>`).join("")}` : "").join("");
}

function tagsPanel(close) {
  const t = TAGS.find((x) => x.id === ST.tagSel) ?? TAGS[0];
  const count = (id) => ALL_MODULES.filter((m) => (TAGS_OF[m.id] ?? []).includes(id)).length;
  const list = TAGS.map((x) => `<li class="${x.id === t?.id ? "active" : ""}" data-act="tagsel" data-id="${x.id}"><span class="sw" style="--st-c:${x.color}"></span><span>${esc(x.name)}</span><span class="c">${count(x.id)}</span></li>`).join("")
    + `<li class="new" data-act="newtag"><i class="fa-solid fa-plus"></i><span>New tag</span><span></span></li>`;
  const edit = t ? `<div class="sts-kv"><span>Name</span><input type="text" data-change="tagname" value="${esc(t.name)}">
      <span>Colour</span><div class="sts-sws">${TAG_COLOURS.map((c) => `<button type="button" class="st-swatch${c === t.color ? " st-on" : ""}" style="--st-c:${c}" data-act="tagcolour" data-id="${c}" aria-label="${c}"></button>`).join("")}</div></div>
    <div class="sts-chg"><h4><span>Modules tagged “${esc(t.name)}” · ${count(t.id)}</span><a data-act="deltag">Delete tag</a></h4><ul class="sts-mods">${moduleChecks((m) => (TAGS_OF[m.id] ?? []).includes(t.id), "tagmod")}</ul></div>` : "";
  return `<aside class="application framed sts-panel" aria-label="Tags"><h2 class="divider">Tags</h2>${close}<div class="scroll"><ul class="sts-list">${list}</ul>${edit}</div></aside>`;
}

function presetsPanel(close) {
  const p = PRESETS.find((x) => x.id === ST.presetSel) ?? PRESETS[0];
  const list = PRESETS.map((x) => `<li class="${x.id === p?.id ? "active" : ""}" data-act="presetsel" data-id="${x.id}"><i class="fa-solid fa-layer-group"></i><span>${esc(x.name)}</span><span class="c">${x.modules.length}</span></li>`).join("")
    + `<li class="new" data-act="newpreset"><i class="fa-solid fa-plus"></i><span>New preset</span><span></span></li>`;
  const edit = p ? `<div class="sts-kv"><span>Name</span><input type="text" data-change="presetname" value="${esc(p.name)}">
      <span>About</span><textarea data-change="presetdesc">${esc(p.desc)}</textarea></div>
    <button type="button" class="bright" data-act="presetworld" style="height:32px"><i class="fa-solid fa-globe"></i>Add to a world…</button>
    <div class="sts-chg"><h4><span>Modules · ${p.modules.length}</span><a data-act="delpreset">Delete preset</a></h4><ul class="sts-mods">${moduleChecks((m) => p.modules.includes(m.id), "presetmod")}</ul></div>` : "";
  return `<aside class="application framed sts-panel" aria-label="Presets"><h2 class="divider">Presets</h2>${close}<div class="scroll"><ul class="sts-list">${list}</ul>${edit}</div></aside>`;
}

// ---------- overlays ----------
function newsDrawer() {
  return "";
  const items = [["n1.webp", "2026 Year in Review", true], ["n2.webp", "2026 Anniversary Celebration Events", false], ["n3.webp", "Version 14 Stable Release", false], ["n4.png", "Try Out Scene Levels with The Restored Keep", false]]
    .map(([img, t, isNew]) => `<a class="news${isNew ? "" : " seen"}" data-act="foundry" data-what="Open the article on foundryvtt.com"><img src="fvtt/news/${img}" alt="">${isNew ? '<span class="new">New</span>' : ""}<h3>${t}</h3></a>`).join("");
  return `<section class="application framed sts-drawer" aria-label="News"><h2 class="divider">News</h2><div class="container">${items}</div>
    <h2 class="divider">Featured Content</h2><div class="container"><a class="news" data-act="foundry" data-what="Open the featured content"><img src="fvtt/news/n5.webp" alt=""><h3>Bastion of Blasphemies Available Now</h3></a></div></section>`;
}

function menu(x, y, groups) {
  const items = groups.map((g) => `<li class="context-group"><ol>${g.map(([icon, label, act, id = ""]) => `<li class="context-item" data-act="${act}" data-id="${esc(id)}"><i class="fa-solid ${icon} fa-fw" inert></i><span>${label}</span></li>`).join("")}</ol></li>`).join("");
  return `<nav id="context-menu" class="expand-down themed theme-dark sts-menu-live" style="left:${x}px;top:${y}px"><menu class="context-items">${items}</menu></nav>`;
}
const pop = (x, y, title, inner, w = 300) => `<div class="st-pop" style="left:${x}px;top:${y}px;width:${w}px" role="dialog" aria-label="${esc(title)}"><header><strong>${title}</strong></header>${inner}</div>`;
const worldPick = (act, note) => `<ul class="sts-pick">${WORLDS_X.map((w) => `<li class="${w.noCompanion ? "dis" : ""}" ${w.noCompanion ? "" : `data-act="${act}" data-id="${w.id}"`}><i class="fa-solid fa-globe"></i><span>${esc(w.title)}</span><span class="st-muted">${w.noCompanion ? "companion off" : ""}</span></li>`).join("")}</ul>${note ? `<div class="sts-pop-note">${note}</div>` : ""}`;

function overlay() {
  const p = ST.pop;
  if (!p) return "";
  const x = Math.min(p.x, innerWidth - 340), y = p.kind === "fmenu" ? p.y : Math.min(p.y, innerHeight - 380);
  switch (p.kind) {
    case "gmenu": return menu(x, y, [[["fa-toggle-on", "Turn all on", "gall", "1"], ["fa-toggle-off", "Turn all off", "gall", "0"]]]);
    case "wmenu": return menu(x - 180, y, [[["fa-pen", "Edit World", "foundry", "Edit World"], ["fa-key", "Reset User Access", "foundry", "Reset User Access"], ["fa-database", "Migrate Data", "foundry", "Migrate World Data"]], [["fa-copy", "Copy modules from another world…", "copyfrompop"]], [["fa-floppy-disk", "Take Backup", "foundry", "Take Backup"], ["fa-floppy-disks", "Manage Backups", "wtab", "backups"]], [["fa-trash", "Delete World", "foundry", "Delete World"]]]);
    case "lmenu": {
      const isFolder = FOLDERS.some((f) => f.id === p.key);
      const folderItems = isFolder ? [[["fa-pen", "Rename", "rename"], ["fa-palette", "Colour…", "colour"]], [["fa-arrow-up", "Move up", "fmove", "-1"], ["fa-arrow-down", "Move down", "fmove", "1"]]] : [];
      return menu(x - 200, y, [...folderItems, [["fa-square-check", "Select its modules", "gselect"], ["fa-layer-group", "New preset from these", "gpreset"], ["fa-globe", "Turn on in a world…", "gworld"]], ...(isFolder ? [[["fa-trash", "Delete folder", "fdelete"]]] : [])]);
    }
    case "colour": {
      const f = FOLDERS.find((z) => z.id === p.key);
      return pop(x - 200, y, "Folder colour", `<div class="st-swatches">${PALETTE.map((c) => `<button type="button" class="st-swatch${c === f?.color ? " st-on" : ""}" style="--st-c:${c}" data-act="fcolour" data-id="${c}" aria-label="${c}"></button>`).join("")}</div>`, 230);
    }
    case "rename": {
      const f = FOLDERS.find((z) => z.id === p.key);
      return pop(x - 200, y, "Rename folder", `<div class="sts-rename"><input type="text" id="sts-rename" value="${esc(f?.name)}"><button type="button" class="st-small-btn bright" data-act="dorename">Save</button></div>`, 300);
    }
    case "presetpop": {
      const rows = PRESETS.map((pr) => {
        const adds = pr.modules.filter((id) => !desired(ST.world, id)).length;
        const queued = (ST.presetQueue[ST.world] ?? []).includes(pr.id);
        return `<li class="${queued ? "dis" : ""}" ${queued ? "" : `data-act="addpreset" data-id="${pr.id}"`}><i class="fa-solid fa-layer-group"></i><span>${esc(pr.name)}</span><span class="st-muted">${queued ? "queued" : adds ? `+${adds}` : "all on"}</span></li>`;
      }).join("");
      return pop(x - 300, y, `Add a preset to ${esc(world().title)}`, `<ul class="sts-pick">${rows}</ul><div class="sts-pop-note">Its modules turn on at the next launch. Nothing else changes.</div>`, 320);
    }
    case "move": return pop(x, y, `Move ${ST.selected.size} to`, `<ul class="sts-pick">${FOLDERS.map((f) => `<li data-act="domove" data-id="${f.id}"><i class="fa-solid fa-folder" style="color:color-mix(in srgb, ${f.color} 55%, white)"></i><span>${esc(f.name)}</span><span></span></li>`).join("")}<li data-act="domove" data-id=""><i class="fa-solid fa-folder"></i><span>Unfiled</span><span></span></li></ul>`, 260);
    case "preset": return pop(x, y, `Add ${ST.selected.size} to a preset`, `<ul class="sts-pick">${PRESETS.map((pr) => `<li data-act="dopreset" data-id="${pr.id}"><i class="fa-solid fa-layer-group"></i><span>${esc(pr.name)}</span><span class="st-muted">${pr.modules.length}</span></li>`).join("")}</ul>`, 280);
    case "world": case "gworld": case "presetworld": {
      const what = p.kind === "presetworld" ? `“${esc(PRESETS.find((z) => z.id === ST.presetSel)?.name)}”` : p.kind === "world" ? plural(ST.selected.size, "module") : "these modules";
      return pop(x, y, `Turn on ${what} in…`, worldPick(p.kind === "presetworld" ? "dopresetworld" : "doworld", "They turn on at that world's next launch. You can review it on the world's page."), 300);
    }
    case "tags": return tagsPop(x, y);
    case "addtag": return pop(x - 120, y, "Add a tag", `<ul class="sts-pick">${TAGS.filter((t) => !(TAGS_OF[ST.panel.id] ?? []).includes(t.id)).map((t) => `<li data-act="doaddtag" data-id="${t.id}"><i class="st-dot" style="--st-c:${t.color}"></i><span>${esc(t.name)}</span><span></span></li>`).join("") || '<li class="dis"><span></span><span>It has every tag</span><span></span></li>'}</ul>`, 220);
    default: return ideasPop(p, x, y);
  }
}

function tagState(tid) {
  const ids = [...ST.selected];
  const n = ids.filter((id) => (TAGS_OF[id] ?? []).includes(tid)).length;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}
function tagsPop(x, y) {
  const n = ST.selected.size;
  let adds = 0, removes = 0;
  const rows = TAGS.map((t) => {
    const was = tagState(t.id), st = ST.tagStage[t.id] ?? was;
    if (st !== was && st === "all") adds++;
    if (st !== was && st === "none") removes++;
    const delta = st === was ? "" : `<span class="st-delta ${st === "all" ? "st-plus" : "st-minus"}">${st === "all" ? "add" : "remove"}</span>`;
    const label = st === was ? (was === "all" ? `<span class="st-muted">all ${n}</span>` : was === "some" ? `<span class="st-muted">${[...ST.selected].filter((id) => (TAGS_OF[id] ?? []).includes(t.id)).length} of ${n}</span>` : "") : "";
    return `<li class="${st !== was ? "st-changed" : ""}" data-act="tagcycle" data-id="${t.id}"><label><input type="checkbox" ${st === "all" ? "checked" : ""} data-indeterminate="${st === "some"}"><i class="st-dot" style="--st-c:${t.color}"></i><span class="st-name">${esc(t.name)}</span>${delta}${label}</label></li>`;
  }).join("");
  const pending = adds || removes ? [adds ? `${adds} to add` : "", removes ? `${removes} to remove` : ""].filter(Boolean).join(", ") : "Click a tag: all, none, then back";
  return `<div class="st-pop st-tagpop" style="left:${x}px;top:${Math.max(70, y)}px" role="dialog"><header><strong>Tags for ${plural(n, "selected module")}</strong></header>
    <ul class="st-checklist">${rows}</ul><footer><span class="st-muted">${pending}</span><button type="button" class="st-small-btn" data-act="closepop">Cancel</button><button type="button" class="st-small-btn bright" data-act="tagapply">Apply</button></footer></div>`;
}

function notify(text, type = "info") {
  let box = document.getElementById("notifications");
  if (!box) { box = document.createElement("ol"); box.id = "notifications"; box.className = "sts-toasts"; document.body.append(box); }
  const li = document.createElement("li");
  li.className = `notification ${type} active`;
  li.innerHTML = `<p>${text}</p>`;
  box.append(li);
  setTimeout(() => li.remove(), 3600);
}

// ---------- render ----------
function render() {
  VIEW = ST.view;
  const keep = [...document.querySelectorAll(".st-sections, .sts-panel .scroll, .sts-worlds, .sts-gridwrap")].map((el) => el.scrollTop);
  const toasts = document.getElementById("notifications");
  document.body.innerHTML = `<div id="main-background"></div>${topBar()}<section id="setup" class="sts">${rail()}${ST.page === "world" ? worldPage() : ST.page === "backups" ? serverBackupsPage() : ST.page === "config" ? serverConfigPage() : ST.page === "update" ? updatePage() : libraryPage()}</section>${newsDrawer()}`;
  document.body.insertAdjacentHTML("beforeend", overlay() + launchDialog() + snapshotDialog() + cfgDialog() + cfgStopDialog());
  if (toasts) document.body.append(toasts);
  document.querySelectorAll(".st-sections, .sts-panel .scroll, .sts-worlds, .sts-gridwrap").forEach((el, i) => { if (keep[i] !== undefined) el.scrollTop = keep[i]; });
  document.querySelectorAll("[data-indeterminate=true]").forEach((el) => { el.indeterminate = true; });
  applyFilter();
  document.querySelectorAll("li.package").forEach((li) => {
    const id = li.dataset.packageId, icons = li.querySelector(".status-icons");
    if (!icons) return;
    if (ST.lock.has(id)) icons.querySelector(".fa-lock")?.removeAttribute("hidden");
    if (ST.fav.has(id) && !icons.querySelector(".favorite")) icons.insertAdjacentHTML("afterbegin", '<i class="favorite fa-solid fa-star"></i>');
  });
  document.getElementById("sts-rename")?.focus();
}
// A text field saves when it loses focus, which happens on mousedown elsewhere. Redrawing then would
// replace the element under the pointer and lose the click, so such redraws wait for the pointer.
let pointerHeld = false, renderQueued = false;
document.addEventListener("pointerdown", () => { pointerHeld = true; }, true);
document.addEventListener("pointerup", () => {
  pointerHeld = false;
  if (renderQueued) setTimeout(() => { if (renderQueued) { renderQueued = false; render(); } }, 0);
}, true);
function renderSoon() { if (pointerHeld) renderQueued = true; else render(); }
const rerender = (scrollTop = false) => { render(); if (scrollTop) document.querySelectorAll(".st-sections, .sts-panel .scroll").forEach((el) => { el.scrollTop = 0; }); };

function applyFilter() {
  const q = ST.q.trim().toLowerCase();
  document.querySelectorAll(".stc-row").forEach((li) => { li.style.display = !q || li.textContent.toLowerCase().includes(q) || li.dataset.id.includes(q) ? "" : "none"; });
  document.querySelectorAll(".sts-grid tr[data-mid]").forEach((tr) => { tr.style.display = !q || tr.textContent.toLowerCase().includes(q) || tr.dataset.mid.includes(q) ? "" : "none"; });
  document.querySelectorAll(".st-sections li.package, .sts-main > .sts-body-main > ol.package-list li.package, li.stw-lib, li.stw-card").forEach((li) => {
    const t = li.querySelector(".package-title, .t")?.textContent.toLowerCase() ?? "";
    li.style.display = !q || t.includes(q) || (li.dataset.packageId ?? li.dataset.id ?? "").includes(q) ? "" : "none";
  });
  document.querySelectorAll(".st-sections > li.st-section").forEach((s) => {
    const cards = s.querySelectorAll("li.package, li.stw-card");
    s.style.display = q && cards.length && [...cards].every((c) => c.style.display === "none") ? "none" : "";
  });
}

// ---------- events ----------
const A = {};
const near = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.bottom + 4, r }; };
const openPop = (kind, el, extra = {}) => { const { x, y } = near(el); ST.pop = { kind, x, y, ...extra }; };

A.library = () => { ST.page = "library"; ST.pop = null; ST.q = ""; ST.collapsed.clear(); rerender(true); };
A.world = (id) => { ST.page = "world"; ST.world = id; ST.wtab = "modules"; ST.pop = null; ST.copy = null; ST.dialog = null; ST.q = ""; ST.select = false; ST.selected.clear(); ST.panel = null; ST.collapsed.clear(); rerender(true); };
A.news = () => { ST.news = !ST.news; ST.newsSeen = true; render(); showNews(ST.news ? "all" : "none"); };
A.view = (id) => { ST.view = id; render(); };
A.collapse = (id) => { ST.collapsed.has(id) ? ST.collapsed.delete(id) : ST.collapsed.add(id); render(); };
A.collapseall = () => { const keys = groupsFor(ST.group, ALL_MODULES).map((g) => g.key); const all = keys.every((k) => ST.collapsed.has(k)); ST.collapsed = new Set(all ? [] : keys); render(); };
A.wtab = (id) => { ST.wtab = id; render(); };
A.lsub = (id) => { ST.lsub = id; ST.q = ""; if (ST.panel?.kind === "system" || (id === "systems" && ST.panel)) ST.panel = null; render(); };
A.show = (id) => { ST.show = id; render(); };
A.toggle = (id) => { setDesired(ST.world, id, !desired(ST.world, id)); render(); };
A.wtoggle = (wid) => { setDesired(wid, ST.panel.id, !desired(wid, ST.panel.id)); render(); if (wid !== ST.world || ST.page !== "world") warnIfBroken(wid); };
A.undo = (id) => { const k = `${ST.world}:${id}`; if (ST.changes.has(k)) ST.changes.delete(k); else ST.changes.set(k, baseOn(ST.world, id)); render(); };
A.undoall = () => { [...ST.changes.keys()].filter((k) => k.startsWith(`${ST.world}:`)).forEach((k) => ST.changes.delete(k)); render(); };
A.unpreset = (pid) => { ST.presetQueue[ST.world] = (ST.presetQueue[ST.world] ?? []).filter((p) => p !== pid); render(); };
A.discard = () => { A.undoall(); ST.presetQueue[ST.world] = []; render(); notify(`Discarded the queued changes for ${esc(world().title)}.`); };
A.fix = (id, el) => { setDesired(ST.world, id, el.dataset.on === "true"); render(); };
A.launch = () => {
  if (ST.page !== "world") return;
  if (REVIEW_AT_LAUNCH && !world().noCompanion && (diff(ST.world).length || problems(ST.world).length)) { ST.dialog = "launch"; render(); return; }
  const w = world(), n = w.noCompanion ? 0 : diff(w.id).length, probs = w.noCompanion ? [] : problems(w.id);
  if (probs.length) { notify(`${plural(probs.length, "problem")} to fix first (see Next launch). In the real page you could still launch, and the world would ask.`, "warning"); return; }
  markPlayed(w.id); render();
  notify(`Mockup: Foundry would launch ${esc(w.title)} here${n ? `, and the companion would show the ${plural(n, "change")} for you to confirm` : ""}.`);
};
A.foundry = (id, el) => { const what = el?.dataset.what || id; if (what === "Install Module") installMore(); else notify(`Mockup: this opens Foundry's own “${esc(what)}”. We don't rebuild it.`); };
A.gmenu = (id, el) => { openPop("gmenu", el, { key: id }); render(); };
A.gall = (on) => { const g = groupsFor(ST.group, ALL_MODULES).find((x) => x.key === ST.pop.key); g?.modules.forEach((m) => { if (m.id !== "stagehand" || on === "1") setDesired(ST.world, m.id, on === "1"); }); ST.pop = null; render(); };
A.wmenu = (_id, el) => { openPop("wmenu", el); render(); };
A.copyfrompop = () => { ST.pop = { ...ST.pop, kind: "copyfrom", x: ST.pop.x + 180 }; render(); };
A.presetpop = (_id, el) => { openPop("presetpop", el); render(); };
A.addpreset = (pid) => { ST.presetQueue[ST.world] = [...(ST.presetQueue[ST.world] ?? []), pid]; ST.pop = null; render(); };
A.closepop = () => { ST.pop = null; ST.tagStage = {}; render(); };

// Library
A.card = (id, el, e) => {
  if (!ST.select && ST.panel?.id !== id) ST.mtab = "library";
  if (ST.select) {
    if (e.shiftKey && ST.lastSel) {
      const ids = [...document.querySelectorAll(".st-sections li.package, .st-sections li.stw-lib")].map((li) => li.dataset.packageId);
      const [a, b] = [ids.indexOf(ST.lastSel), ids.indexOf(id)].sort((p, q) => p - q);
      ids.slice(a, b + 1).forEach((x) => ST.selected.add(x));
    } else ST.selected.has(id) ? ST.selected.delete(id) : ST.selected.add(id);
    ST.lastSel = id;
  } else ST.panel = ST.panel?.id === id ? null : { kind: "module", id };
  render();
};
A.select = () => { ST.select = !ST.select; ST.selected.clear(); ST.pop = null; render(); };
A.clearsel = () => { ST.selected.clear(); ST.pop = null; render(); };
A.bulk = (id, el) => { openPop(id, el); ST.tagStage = {}; render(); };
A.selall = () => { document.querySelectorAll(".st-sections li.package, .st-sections li.stw-lib").forEach((li) => { if (li.style.display !== "none" && li.closest(".st-section")?.style.display !== "none") ST.selected.add(li.dataset.packageId); }); render(); };
A.gsel = (key) => { const g = groupsFor(ST.group, ALL_MODULES).find((x) => esc(x.key) === key); const ids = g?.modules.map((m) => m.id) ?? []; const all = ids.every((id) => ST.selected.has(id)); ids.forEach((id) => (all ? ST.selected.delete(id) : ST.selected.add(id))); render(); };
A.mtab = (id) => { ST.mtab = id; render(); };
A.fav = (id) => { ST.fav.has(id) ? ST.fav.delete(id) : ST.fav.add(id); render(); };
A.lockpkg = (id) => { ST.lock.has(id) ? ST.lock.delete(id) : ST.lock.add(id); render(); };
A.syscard = (id) => { ST.panel = ST.panel?.id === id ? null : { kind: "system", id }; ST.mtab = "package"; render(); };
A.domove = (fid) => { ST.selected.forEach((id) => { if (fid) FOLDER_OF[id] = fid; else delete FOLDER_OF[id]; }); const n = ST.selected.size; ST.pop = null; ST.selected.clear(); render(); notify(`Moved ${plural(n, "module")} to ${esc(FOLDERS.find((f) => f.id === fid)?.name ?? "Unfiled")}.`); };
A.dopreset = (pid) => { const p = PRESETS.find((x) => x.id === pid); ST.selected.forEach((id) => { if (!p.modules.includes(id)) p.modules.push(id); }); ST.pop = null; render(); notify(`Added to the preset ${esc(p.name)}.`); };
A.doworld = (wid) => {
  const ids = ST.pop.kind === "gworld" ? groupsFor(ST.group, ALL_MODULES).find((g) => g.key === ST.pop.key)?.modules.map((m) => m.id) ?? [] : [...ST.selected];
  ids.forEach((id) => setDesired(wid, id, true)); ST.pop = null; render();
  notify(`Queued for ${esc(world(wid).title)}. Open the world on the left to review it.`); warnIfBroken(wid);
};
A.tagcycle = (tid) => {
  const was = tagState(tid), cur = ST.tagStage[tid] ?? was;
  const order = was === "some" ? ["some", "all", "none"] : was === "all" ? ["all", "none"] : ["none", "all"];
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (next === was) delete ST.tagStage[tid]; else ST.tagStage[tid] = next;
  render();
};
A.tagapply = () => {
  Object.entries(ST.tagStage).forEach(([tid, st]) => ST.selected.forEach((id) => {
    const cur = TAGS_OF[id] ?? [];
    TAGS_OF[id] = st === "all" ? [...new Set([...cur, tid])] : cur.filter((t) => t !== tid);
  }));
  ST.tagStage = {}; ST.pop = null; render(); notify("Tags updated.");
};
A.lmenu = (_id, el) => { openPop("lmenu", el, { key: el.closest("[data-group]")?.dataset.group }); render(); };
A.rename = () => { ST.pop = { ...ST.pop, kind: "rename" }; render(); };
A.dorename = () => { const f = FOLDERS.find((z) => z.id === ST.pop.key); const v = document.getElementById("sts-rename")?.value.trim(); if (f && v) f.name = v; ST.pop = null; render(); };
A.colour = () => { ST.pop = { ...ST.pop, kind: "colour" }; render(); };
A.fcolour = (c) => { const f = FOLDERS.find((z) => z.id === ST.pop.key); if (f) f.color = c; ST.pop = null; render(); };
A.fmove = (d) => { const i = FOLDERS.findIndex((z) => z.id === ST.pop.key), j = i + Number(d); if (j >= 0 && j < FOLDERS.length) [FOLDERS[i], FOLDERS[j]] = [FOLDERS[j], FOLDERS[i]]; ST.pop = null; render(); };
A.fdelete = () => { const key = ST.pop.key; const i = FOLDERS.findIndex((z) => z.id === key); const name = FOLDERS[i]?.name; FOLDERS.splice(i, 1); Object.keys(FOLDER_OF).forEach((id) => { if (FOLDER_OF[id] === key) delete FOLDER_OF[id]; }); ST.pop = null; render(); notify(`Deleted the folder ${esc(name)}. Its modules are Unfiled now.`); };
A.gselect = () => { const g = groupsFor(ST.group, ALL_MODULES).find((x) => x.key === ST.pop.key); ST.select = true; ST.selected = new Set(g?.modules.map((m) => m.id)); ST.pop = null; render(); };
A.gpreset = () => { const g = groupsFor(ST.group, ALL_MODULES).find((x) => x.key === ST.pop.key); const id = `p${PRESETS.length + 1}`; PRESETS.push({ id, name: g.name, desc: "", modules: g.modules.map((m) => m.id) }); ST.presetSel = id; ST.panel = { kind: "presets" }; ST.pop = null; render(); };
A.gworld = () => { ST.pop = { ...ST.pop, kind: "gworld" }; render(); };
A.newfolder = () => { const id = `f${Date.now()}`; FOLDERS.push({ id, name: "New folder", color: PALETTE[FOLDERS.length % PALETTE.length] }); ST.group = "folder"; render(); const el = document.querySelector(`[data-group="${id}"] .st-hbtn`); if (el) { el.scrollIntoView({ block: "center" }); openPop("rename", el, { key: id }); render(); } };
A.panel = (kind) => { ST.panel = ST.panel?.kind === kind ? null : { kind }; ST.select = false; ST.selected.clear(); render(); };
A.closepanel = () => { ST.panel = null; render(); };
A.untag = (tid) => { TAGS_OF[ST.panel.id] = (TAGS_OF[ST.panel.id] ?? []).filter((t) => t !== tid); render(); };
A.addtag = (_id, el) => { openPop("addtag", el); render(); };
A.doaddtag = (tid) => { TAGS_OF[ST.panel.id] = [...(TAGS_OF[ST.panel.id] ?? []), tid]; ST.pop = null; render(); };
A.tagsel = (id) => { ST.tagSel = id; render(); };
A.newtag = () => { const id = `t${Date.now()}`; TAGS.push({ id, name: "new tag", color: TAG_COLOURS[TAGS.length % TAG_COLOURS.length] }); ST.tagSel = id; render(); document.querySelector('[data-change="tagname"]')?.select(); };
A.tagcolour = (c) => { const t = TAGS.find((x) => x.id === ST.tagSel); if (t) t.color = c; render(); };
A.tagmod = (id) => { const tid = ST.tagSel; const cur = TAGS_OF[id] ?? []; TAGS_OF[id] = cur.includes(tid) ? cur.filter((t) => t !== tid) : [...cur, tid]; render(); };
A.deltag = () => { const i = TAGS.findIndex((x) => x.id === ST.tagSel); const [t] = TAGS.splice(i, 1); Object.keys(TAGS_OF).forEach((id) => { TAGS_OF[id] = TAGS_OF[id].filter((x) => x !== t.id); }); ST.tagSel = TAGS[0]?.id; render(); notify(`Deleted the tag ${esc(t.name)}.`); };
A.presetsel = (id) => { ST.presetSel = id; render(); };
A.newpreset = () => { const id = `p${Date.now()}`; PRESETS.push({ id, name: "New preset", desc: "", modules: [] }); ST.presetSel = id; render(); document.querySelector('[data-change="presetname"]')?.select(); };
A.presetmod = (id) => { const p = PRESETS.find((x) => x.id === ST.presetSel); const i = p.modules.indexOf(id); if (i >= 0) p.modules.splice(i, 1); else p.modules.push(id); render(); };
A.delpreset = () => { const i = PRESETS.findIndex((x) => x.id === ST.presetSel); const [p] = PRESETS.splice(i, 1); Object.keys(ST.presetQueue).forEach((w) => { ST.presetQueue[w] = ST.presetQueue[w].filter((x) => x !== p.id); }); ST.presetSel = PRESETS[0]?.id; render(); };
A.presetworld = (_id, el) => { openPop("presetworld", el); ST.pop.x -= 0; render(); };
A.dopresetworld = (wid) => { if (!(ST.presetQueue[wid] ?? []).includes(ST.presetSel)) ST.presetQueue[wid] = [...(ST.presetQueue[wid] ?? []), ST.presetSel]; ST.pop = null; render(); notify(`Queued for ${esc(world(wid).title)}. Open the world on the left to review it.`); warnIfBroken(wid); };

document.addEventListener("click", (e) => {
  const inPop = e.target.closest(".st-pop, #context-menu");
  let el = e.target.closest("[data-act]");
  const upd = e.target.closest(".package-update");
  if (upd && !inPop) {
    const li = upd.closest("li.package");
    notify(`Mockup: this runs Foundry's own update for ${esc(li?.querySelector(".package-title")?.textContent ?? "this package")}. It installs at once, as in Foundry today.`);
    return;
  }
  if (!el && !inPop) {
    const cardEl = e.target.closest(".sts-main li.package, .sts-main li.stw-lib");
    if (cardEl && ST.page === "library" && ST.lsub === "modules") { A.card(cardEl.dataset.packageId, cardEl, e); return; }
    if (cardEl && ST.page === "library" && ST.lsub === "systems") { A.syscard(cardEl.dataset.packageId); return; }
    if (cardEl && ST.page === "world" && !e.target.closest(".sts-dialog")) { const id = cardEl.dataset.packageId; ST.panel = ST.panel?.id === id ? null : { kind: "module", id }; ST.mtab = "library"; render(); return; }
  }
  if (ST.pop && !inPop && !(el && ["gmenu", "lmenu", "wmenu", "presetpop", "bulk", "addtag", "presetworld", "copyfrom", "gcolmenu", "copyfrompop", "copyto", "addmenu", "viewpop", "fmenu", "pmenu", "news", "newsall", "updpage", "gridpick"].includes(el.dataset.act))) {
    ST.pop = null; ST.tagStage = {};
    if (!el) { render(); return; }
  }
  if (!el) return;
  if (el.tagName === "INPUT" && el.type === "checkbox") e.preventDefault();
  if (el.dataset.act === "collapse" && e.target.closest(".st-hbtn")) return;
  e.stopPropagation();
  A[el.dataset.act]?.(el.dataset.id, el, e);
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-change]");
  if (!el) return;
  const v = el.value;
  switch (el.dataset.change) {
    case "group": ST.group = v; ST.collapsed.clear(); break;
    case "folder": if (v) FOLDER_OF[ST.panel.id] = v; else delete FOLDER_OF[ST.panel.id]; break;
    case "note": NOTES[ST.panel.id] = v; break;
    case "tagname": { const t = TAGS.find((x) => x.id === ST.tagSel); if (t && v.trim()) t.name = v.trim(); break; }
    case "presetname": { const p = PRESETS.find((x) => x.id === ST.presetSel); if (p && v.trim()) p.name = v.trim(); break; }
    case "presetdesc": { const p = PRESETS.find((x) => x.id === ST.presetSel); if (p) p.desc = v; break; }
    case "ifolder": ST.intakeFolder[el.dataset.id] = v; break;
    default: return;
  }
  renderSoon();
});
document.addEventListener("input", (e) => {
  const f = e.target.dataset?.filter;
  if (f === "cards" || f === "grid") { ST.q = e.target.value; applyFilter(); }
  if (f === "worlds") { ST.wq = e.target.value; const pos = e.target.selectionStart; render(); const inp = document.querySelector('[data-filter="worlds"]'); inp.focus(); inp.setSelectionRange(pos, pos); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ST.dialog) { ST.dialog = null; render(); return; }
  if (e.key === "Escape") { if (ST.pop) { ST.pop = null; ST.tagStage = {}; render(); } else if (ST.news) { A.news(); } else if (ST.select && ST.selected.size) { ST.selected.clear(); render(); } }
  if (e.key === "Enter" && e.target.id === "sts-rename") A.dorename();
});

