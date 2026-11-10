// Renderers for Foundry's own Setup markup (copied from the live V14 page and
// templates/setup/parts/package-*.hbs) plus the Stagehand pieces placed
// into it. Styling comes from Foundry's real foundry2.css.

// ---------- Stagehand decorations on a Foundry card ----------
const tagChip = (t, extra = "") =>
  `<span class="tag flexrow st-tag ${extra}" style="--st-c:${t.color}" data-tooltip="Tag: ${esc(t.name)}"><i class="st-dot" aria-hidden="true"></i>${esc(t.name)}</span>`;

/** Our tags, note and usage as Foundry `.tag` items, first in `.tags.right`. */
function decorations(m, { maxTags = 2, usage = VIEW === "details" } = {}) {
  const tags = tagsOf(m.id);
  // Tiles clip Foundry's right-hand tags from the left: there, tags become one dot-tag.
  if (VIEW === "tiles" && tags.length) {
    const names = tags.map((t) => t.name).join(", ");
    // One chip: tag dots, plus the note icon when there is a note.
    const note = NOTES[m.id] ? `<i class="fa-solid fa-note-sticky st-chipnote" inert></i>` : "";
    const tip = `Tags: ${esc(names)}${NOTES[m.id] ? ` · Note: ${esc(NOTES[m.id])}` : ""}`;
    return `<span class="tag flexrow st-tagdots" data-tooltip="${tip}" aria-label="${tip}">${tags.slice(0, 4).map((t) => `<i class="st-dot" style="--st-c:${t.color}"></i>`).join("")}${note}</span>`;
  }
  const shown = tags.slice(0, maxTags).map((t) => tagChip(t)).join("");
  const more = tags.length > maxTags
    ? `<span class="tag flexrow st-more" data-tooltip="Also: ${esc(tags.slice(maxTags).map((t) => t.name).join(", "))}">+${tags.length - maxTags}</span>` : "";
  const note = NOTES[m.id]
    ? `<span class="tag flexrow st-note" data-tooltip="${esc(NOTES[m.id])}" aria-label="Note: ${esc(NOTES[m.id])}"><i class="fa-solid fa-note-sticky fa-fw" inert></i></span>` : "";
  const n = usageOf(m.id);
  const used = usage
    ? `<span class="tag flexrow st-used${n === 0 ? " st-zero" : ""}" data-tooltip="Active in ${n} of ${WORLDS.length} worlds" aria-label="Active in ${n} worlds"><i class="fa-solid fa-globe fa-fw" inert></i>${n}</span>` : "";
  return shown + more + note + used;
}

/** One Foundry module card in the current view mode. `o` adds our state. */
function card(m, o = {}) {
  const cls = ["package", "module", o.selected ? "st-selected" : "", o.dragging ? "st-dragging" : "", o.ghost ? "st-ghost" : ""].join(" ");
  const check = o.check ? `<label class="st-check" aria-label="Select ${esc(m.title)}"><input type="checkbox" ${o.selected ? "checked" : ""}></label>` : "";
  const status = `<div class="status-icons">${o.favorite ? '<i class="favorite fa-solid fa-star"></i>' : ""}<i class="fa-solid fa-lock" hidden></i></div>`;
  const update = READONLY && o.lockUpdate ? "" : `<a class="control package-update" data-action="updatePackage" aria-label="Perform Update If Available"><i class="fa-solid fa-rotate" inert></i></a>`;
  // Tiles clip Foundry's right-hand row from the left, so there our chip sits on the left, by the update button.
  const ours = o.deco === false ? "" : decorations(m, o.decoOpts);
  const tilesLeft = VIEW === "tiles" ? ours : "";
  const right = `${VIEW === "tiles" ? "" : ours}${foundryTags(m)}`;
  const title = esc(m.title);
  if (VIEW === "details") {
    const desc = `${m.description || esc(m.shortDesc)}${o.detailExtra ?? ""}`;
    return `<li class="${cls}" data-package-id="${m.id}">${status}${check}
      <div class="package-thumbnail"><img class="thumbnail" src="fvtt/ui/anvil-bg.png"><h3 class="package-title">${title}</h3></div>
      <div class="package-content flexcol"><div class="package-description scrollable">${desc}</div>
      <footer class="package-footer"><div class="tags flexrow left">${update}</div><div class="tags flexrow right">${right}</div></footer></div></li>`;
  }
  const thumb = VIEW === "gallery" ? `<img class="thumbnail" src="fvtt/ui/anvil-bg.png">` : "";
  return `<li class="${cls}" data-package-id="${m.id}">${thumb}${status}${check}
    <h3 class="package-title${VIEW === "tiles" ? " ellipsis" : ""}">${title}</h3>
    <div class="tags flexrow left">${update}${tilesLeft}</div>
    <div class="tags flexrow right">${right}</div></li>`;
}

/** Details mode has room in the description: our note and usage go there. */
function detailExtra(m) {
  const note = NOTES[m.id] ? `<p class="st-detail-line"><i class="fa-solid fa-note-sticky"></i><span>${esc(NOTES[m.id])}</span></p>` : "";
  const n = usageOf(m.id);
  const where = n ? `Active in ${n} world${n === 1 ? "" : "s"}: ${WORLDS.slice(0, n).join(", ")}` : "Not active in any world";
  const presets = presetsOf(m.id).map((p) => p.name);
  const pre = presets.length ? ` · In preset${presets.length > 1 ? "s" : ""} ${presets.join(", ")}` : "";
  return `${note}<p class="st-detail-line st-muted"><i class="fa-solid fa-globe"></i><span>${where}${pre}</span></p>`;
}

// ---------- Grouping ----------
const SMART = [
  { key: "lib", name: "Libraries", icon: "fa-books", test: (m) => m.lib },
  { key: "unverified", name: "Not verified for V14", icon: "fa-triangle-exclamation", test: (m) => m.unverified },
  { key: "unused", name: "Unused (in no world)", icon: "fa-moon", test: (m) => usageOf(m.id) === 0 },
  { key: "packs", name: "Content packs", icon: "fa-book", test: (m) => m.packs },
];

/** Groups for a "Group by" choice. Author, preset and tag groups can share modules. */
function groupsFor(by, modules) {
  if (by === "folder") {
    const g = FOLDERS.map((f) => ({ key: f.id, name: f.name, color: f.color, icon: "fa-folder-open", kind: "folder", modules: modules.filter((m) => FOLDER_OF[m.id] === f.id) }));
    return [...g, { key: "unfiled", name: "Unfiled", icon: "fa-folder-open", kind: "unfiled", modules: modules.filter((m) => !folderOf(m.id)) }];
  }
  if (by === "author") {
    const names = [...new Set(modules.map((m) => m.author))].sort((a, b) => modules.filter((m) => m.author === b).length - modules.filter((m) => m.author === a).length);
    return names.map((a) => ({ key: a, name: a, icon: "fa-user", kind: "author", modules: modules.filter((m) => m.author === a) }));
  }
  if (by === "preset") {
    const g = PRESETS.map((p) => ({ key: p.id, name: p.name, icon: "fa-layer-group", kind: "preset", hint: p.desc, modules: modules.filter((m) => p.modules.includes(m.id)) }));
    return [...g, { key: "none", name: "In no preset", icon: "fa-layer-group", kind: "rest", modules: modules.filter((m) => !presetsOf(m.id).length) }];
  }
  if (by === "tag") {
    const g = TAGS.map((t) => ({ key: t.id, name: t.name, color: t.color, icon: "fa-tag", kind: "tag", modules: modules.filter((m) => (TAGS_OF[m.id] ?? []).includes(t.id)) }));
    return [...g, { key: "untagged", name: "Untagged", icon: "fa-tag", kind: "rest", modules: modules.filter((m) => !tagsOf(m.id).length) }];
  }
  return SMART.map((s) => ({ key: s.key, name: s.name, icon: s.icon, kind: "smart", modules: modules.filter(s.test) }));
}

/** A section: Foundry's own folder header (as in the in-game sidebar) over a card list. */
function section(g, o = {}) {
  const collapsed = o.collapsed?.includes(g.key);
  const tint = g.kind === "tag" ? "st-tinted" : "";
  const style = g.color && g.kind === "folder" ? `--sidebar-folder-color:${g.color}` : g.color ? `--st-c:${g.color}` : "";
  const count = o.total?.[g.key] !== undefined && o.total[g.key] !== g.modules.length
    ? `${g.modules.length} of ${o.total[g.key]}` : `${g.modules.length}`;
  const more = o.noMore || READONLY && !o.moreInRo ? "" : `<button type="button" class="st-hbtn${o.menuOn === g.key ? " st-on" : ""}" aria-label="${esc(g.name)}: actions" data-tooltip="Actions (or right-click)"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
  const hint = g.hint && !collapsed && o.hints ? `<span class="st-hint">${esc(g.hint)}</span>` : "";
  const header = `<header class="folder-header st-section-header ${g.kind} ${tint}" style="${style}" role="button" aria-expanded="${!collapsed}">
      <i class="fa-solid ${collapsed ? (g.kind === "folder" || g.kind === "unfiled" ? "fa-folder" : g.icon) : g.icon} fa-fw"></i>
      ${g.kind === "tag" ? `<i class="st-dot" aria-hidden="true"></i>` : ""}
      <span class="folder-name">${esc(g.name)}</span>${hint}
      ${o.extra?.[g.key] ?? ""}<span class="st-count">${count}</span>${more}
      <i class="fa-solid fa-chevron-${collapsed ? "right" : "down"} st-caret" aria-hidden="true"></i></header>`;
  const body = collapsed ? "" : g.modules.length
    ? `<ol class="package-list ${VIEW} st-cards">${g.modules.map((m) => card(m, o.cardOpts?.(m, g) ?? {})).join("")}</ol>`
    : `<p class="st-empty-section">${o.emptyText?.(g) ?? "Empty. Drag modules here."}</p>`;
  return `<li class="folder st-section${collapsed ? "" : " expanded"}${o.drop === g.key ? " droptarget" : ""}" data-group="${esc(g.key)}">${header}${body}</li>`;
}

function sections(groups, o = {}) {
  return `<ol class="st-sections scrollable">${groups.map((g) => section(g, o)).join("")}</ol>`;
}

// ---------- Foundry chrome ----------
function viewModes({ organise = true, organiseBtn = true } = {}) {
  const b = (id, icon, label) => `<button type="button" data-action="viewMode" class="view-mode icon fa-solid ${icon}${VIEW === id ? " active" : ""}" aria-label="${label}"></button>`;
  const org = organiseBtn ? `<button type="button" class="view-mode icon fa-solid fa-folder-tree st-organise${organise ? " active" : ""}" aria-pressed="${organise}" aria-label="Organised view (Stagehand)"></button><span class="st-vsep" aria-hidden="true"></span>` : "";
  return `<div class="view-modes">${org}${b("gallery", "fa-image-landscape", "Gallery View")}${b("tiles", "fa-grid-horizontal", "Tiles View")}${b("details", "fa-list", "Details View")}</div>`;
}

function controls(o = {}) {
  return `<header class="controls flexrow">
    <label class="filter search"><input id="module-filter" type="search" value="${esc(o.filter ?? "")}" autocomplete="off" placeholder="Filter Modules (${o.count ?? ALL_MODULES.length})"></label>
    <button type="button" data-action="installPackage"><i class="fa-solid fa-download" inert></i><span>Install Module</span></button>
    <button type="button" data-action="updateAll"><i class="fa-solid fa-cloud-arrow-down" inert></i><span>Update All</span></button>
    <button id="moduleCreate" type="button" class="icon" data-action="moduleCreate"><i class="fa-solid fa-gear-code"></i></button>
    ${viewModes(o)}</header>`;
}

const NEWS = [["n1.webp", "2026 Year in Review"], ["n2.webp", "2026 Anniversary Celebration Events"], ["n3.webp", "Version 14 Stable Release"], ["n4.png", "Try Out Scene Levels with The Restored Keep"]];

/** The whole Setup page, with `tabBody` in the Add-on Modules tab under Foundry's controls. */
function setupPage({ tabBody = "", overlay = "", ctrl = {}, coreList = "" } = {}) {
  const tab = (id, icon, label) => `<h2 class="divider${id === "modules" ? " active" : ""}" data-tab="${id}"><i class="fa-solid ${icon}" inert></i><span class="tab-title">${label}</span></h2>`;
  const menu = [["fa-triangle-exclamation", ""], ["fa-gears", ""], ["fa-download", '<span class="pip warning">!</span>'], ["fa-floppy-disks", ""], ["fa-door-open", ""], ["fa-power-off", ""]]
    .map(([i, pip]) => `<button type="button" class="icon"><i class="fa-solid ${i}"></i>${pip}</button>`).join("");
  return `<ol id="notifications"></ol><div id="main-background"></div>
  <header id="main-header" class="flexcol"><h1>Foundry Virtual Tabletop</h1></header>
  <nav id="setup-menu"><div class="flexrow" id="setup-menu-buttons">${menu}</div></nav>
  <section id="setup"><section id="setup-packages" class="application framed">
    <nav class="tabs">${tab("worlds", "fa-globe-asia", "Game Worlds")}${tab("systems", "fa-dice", "Game Systems")}${tab("modules", "fa-plug", "Add-on Modules")}</nav>
    <section class="tab active" data-tab="modules" id="setup-packages-modules">${controls(ctrl)}${tabBody}${coreList}</section>
  </section>
  <aside id="setup-sidebar"><section class="application flexcol" id="setup-sidebar-news"><h2 class="divider">News</h2><div class="container"><div id="news-articles" class="flexcol scrollable">
    ${NEWS.map(([img, t]) => `<a class="news flexcol"><img src="fvtt/news/${img}" alt=""><h3>${t}</h3></a>`).join("")}</div></div></section>
    <section class="application flexcol" id="setup-sidebar-featured"><h2 class="divider">Featured Content</h2><a id="featured-content" class="news flexcol"><img src="fvtt/news/n5.webp" alt=""><h3 id="featured-content-title">Bastion of Blasphemies Available Now</h3></a></section></aside>
  </section><footer id="watermark" class="flexcol"><p id="software-version">Version 14 Build 369</p></footer>${overlay}`;
}

/** Foundry's core list (organise off): its own cards, still decorated. */
function coreList(modules = ALL_MODULES, deco = true) {
  return `<ol id="modules-list" class="package-list ${VIEW} scrollable">${modules.map((m) => card(m, { deco })).join("")}</ol>`;
}

// ---------- Foundry overlays: ContextMenu, window, toast, tooltip ----------
function contextMenu(x, y, groups) {
  const items = groups.map((g) => `<li class="context-group"><ol>${g.map(([icon, label, cls = ""]) => `<li class="context-item ${cls}"><i class="fa-solid ${icon} fa-fw" inert></i><span>${label}</span></li>`).join("")}</ol></li>`).join("");
  return `<nav id="context-menu" class="expand-down themed theme-dark st-static-menu" style="left:${x}px;top:${y}px"><menu class="context-items">${items}</menu></nav>`;
}

function fwindow({ title, icon = "fa-solid fa-folder-tree", x, y, w, h, body, footer = "", cls = "" }) {
  return `<div class="application st-window ${cls}" style="left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ""}z-index:101">
    <header class="window-header"><i class="window-icon fa-fw ${icon}" inert></i><h1 class="window-title">${title}</h1>
      <button type="button" class="header-control icon fa-solid fa-ellipsis-vertical" aria-label="Toggle Controls"></button>
      <button type="button" class="header-control icon fa-solid fa-xmark" aria-label="Close Window"></button></header>
    <section class="window-content">${body}</section>${footer ? `<footer class="st-window-footer form-footer">${footer}</footer>` : ""}</div>`;
}

const toast = (text, type = "info") => `<ol id="notifications" class="st-toasts"><li class="notification ${type} active"><p>${text}</p></li></ol>`;
const tooltip = (x, y, html, dir = "") => `<aside id="tooltip" class="active themed theme-dark st-static-tip ${dir}" style="left:${x}px;top:${y}px">${html}</aside>`;

/** Static annotation for the reviewer (not product UI). */
const callout = (x, y, w, html) => `<div class="st-callout-note" style="left:${x}px;top:${y}px;width:${w}px">${html}</div>`;

// ---------- Shared Stagehand popovers ----------
/** Tri-state tag checklist for a selection: all / some / none, staged until Apply. */
function tagPopover(x, y, { n = 4, states = {}, query = "", pending = "" } = {}) {
  const rows = TAGS.map((t) => {
    const s = states[t.id] ?? { state: "none" };
    const label = s.changed ? "" : s.state === "some" ? `<span class="st-muted">${s.of ?? 2} of ${n}</span>` : s.state === "all" ? `<span class="st-muted">all ${n}</span>` : "";
    const changed = s.changed ? `<span class="st-delta ${s.changed === "+" ? "st-plus" : "st-minus"}">${s.changed === "+" ? "add" : "remove"}</span>` : "";
    const shown = s.changed === "+" ? "all" : s.changed === "-" ? "none" : s.state;
    return `<li class="${s.changed ? "st-changed" : ""}"><label><input type="checkbox" ${shown === "all" ? "checked" : ""} data-indeterminate="${shown === "some"}"><i class="st-dot" style="--st-c:${t.color}"></i><span class="st-name">${t.name}</span>${changed}${label}</label></li>`;
  }).join("");
  const create = query ? `<li class="st-create"><i class="fa-solid fa-plus fa-fw"></i>Create tag “${esc(query)}” and add to ${n}</li>` : "";
  return `<div class="st-pop st-tagpop" style="left:${x}px;top:${y}px" role="dialog" aria-label="Tags for ${n} modules">
    <header><strong>Tags for ${n} selected modules</strong></header>
    <input type="search" class="st-pop-search" placeholder="Find or create a tag" value="${esc(query)}">
    <ul class="st-checklist">${rows}${create}</ul>
    <footer><span class="st-muted">${pending || "Click a box: all, then none, then back"}</span><button type="button" class="st-small-btn">Cancel</button><button type="button" class="st-small-btn bright">Apply</button></footer></div>`;
}

const PALETTE = ["#6e2a2a", "#7a4a1e", "#6b4a1f", "#5c5a1f", "#2f5a35", "#1f5a52", "#2b4f5c", "#2a3f6e", "#3a3f6e", "#5a3a6e", "#6e2f5a", "#444046"];

/** Colour choice: swatches plus Foundry's own <color-picker> for a custom value. */
function colourPopover(x, y, { current = "#5a3a6e", custom = "" } = {}) {
  const sw = PALETTE.map((c) => `<button type="button" class="st-swatch${c === current ? " st-on" : ""}" style="--st-c:${c}" aria-label="${c}"${c === current ? ' aria-pressed="true"' : ""}></button>`).join("");
  return `<div class="st-pop st-colourpop" style="left:${x}px;top:${y}px" role="dialog" aria-label="Folder colour">
    <header><strong>Folder colour</strong></header>
    <div class="st-swatches">${sw}</div>
    <div class="st-custom"><span>Custom</span><color-picker class="st-picker"><input type="text" value="${custom || current}"><input type="color" value="${custom || current}"></color-picker></div>
    <footer><button type="button" class="st-small-btn">No colour</button></footer></div>`;
}

function mount(html, after) {
  document.body.className = "setup auth flexcol theme-dark";
  document.body.innerHTML = html;
  document.querySelectorAll("[data-indeterminate=true]").forEach((el) => { el.indeterminate = true; });
  after?.();
}
