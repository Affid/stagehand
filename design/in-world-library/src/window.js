// Foundry's Module Management window, as 14.370 renders it (markup captured
// from the live window), with Stagehand's library added: folder groups, tags,
// notes, search over tags and notes, the folders/A–Z switch and Apply presets.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NONE = "__none";

const isEditable = () => S.role !== "player";
const showsLibrary = () => S.library && S.role !== "player";
const canApply = () => showsLibrary() && S.role === "gm";
const isDirty = () => S.ticks.size !== S.saved.size || [...S.ticks].some((id) => !S.saved.has(id));

const tagsOf = (id) => (TAGS_OF[id] ?? []).map((t) => TAGS.find((x) => x.id === t)).filter(Boolean);
const folderIdOf = (id) => FOLDER_OF[id] ?? NONE;

/** Modules the window lists: everything for editors, the active ones for players (Foundry). */
function listed() {
  const all = MODULES.filter((m) => isEditable() || S.saved.has(m.id));
  return [...all].sort((a, b) => a.title.localeCompare(b.title));
}

function matchesFilter(m) {
  if (S.filter === "active") return S.saved.has(m.id);
  if (S.filter === "inactive") return !S.saved.has(m.id);
  return true;
}

function matchesSearch(m) {
  const q = S.search.trim().toLowerCase();
  if (!q) return true;
  const own = [m.title, m.id];
  const lib = showsLibrary() ? [...tagsOf(m.id).map((t) => t.name), NOTES[m.id] ?? ""] : [];
  return [...own, ...lib].some((text) => text.toLowerCase().includes(q));
}

const isShown = (m) => matchesFilter(m) && matchesSearch(m);

// ---------- one row ----------

function libraryTags(m) {
  if (!showsLibrary()) return "";
  const tags = tagsOf(m.id)
    .map((t) => `<span class="tag stagehand-tag" style="--st-tag: ${t.color}"><span class="swatch" aria-hidden="true"></span>${esc(t.name)}</span>`)
    .join("");
  const note = NOTES[m.id];
  const noteTag = note
    ? `<span class="tag flexrow stagehand-note" tabindex="0" data-tooltip-text="${esc(note)}" aria-label="Note: ${esc(note)}"><i class="fa-solid fa-note-sticky fa-fw" inert></i></span>`
    : "";
  return tags + noteTag;
}

function foundryTags(m) {
  const author = `<span class="tag flexrow" data-tooltip-text="${esc(m.author)}" data-locked><i class="fa-solid fa-user fa-fw" inert></i></span>`;
  const packs = m.packs ? `<span class="tag flexrow compendium" data-tooltip-text="Compendium Packs" aria-label="Compendium Packs"><i class="fa-solid fa-book fa-fw" inert></i></span>` : "";
  const badge = m.unverified
    ? `<span class="tag flexrow badge warning" data-tooltip-text="Package is not verified for this version of Foundry"><i class="fa-solid fa-code-branch fa-fw" inert></i> ${esc(m.version)}</span>`
    : `<span class="tag flexrow badge success" data-tooltip-text="Package is verified for this version of Foundry"><i class="fa-solid fa-code-branch fa-fw" inert></i> ${esc(m.version)}</span>`;
  return author + packs + badge;
}

const presetsWith = (id) => PRESETS.filter((p) => p.modules.includes(id)).map((p) => p.name);
const neededBy = (id) => MODULES.filter((m) => m.requires.includes(id)).map((m) => m.title);
const chips = (tags) => tags.map((t) => `<span class="tag stagehand-tag" style="--st-tag: ${t.color}"><span class="swatch" aria-hidden="true"></span>${esc(t.name)}</span>`).join("");

/** Label and value pairs for a module's details; empty ones are left out. */
function facts(m) {
  const folder = FOLDERS.find((f) => f.id === FOLDER_OF[m.id])?.name ?? "Not in a folder";
  const requires = m.requires.map((r) => esc(titleOf(r)) + (S.saved.has(r) ? "" : " <em>(not active)</em>")).join(", ");
  const version = esc(m.version) + (m.unverified ? " <em>(not verified for this version of Foundry)</em>" : "");
  return [
    ["Folder", esc(folder)],
    ["Tags", chips(tagsOf(m.id))],
    ["In presets", esc(presetsWith(m.id).join(", "))],
    ["Requires", requires],
    ["Needed by", esc(neededBy(m.id).join(", "))],
    ["Version", version],
    ["Author", esc(m.author)],
    ["Package", `<code>${esc(m.id)}</code>`],
  ].filter(([, value]) => value);
}

function detailsHtml(m) {
  const note = NOTES[m.id] ? `<p class="stagehand-note-line"><i class="fa-solid fa-note-sticky" inert></i> ${esc(NOTES[m.id])}</p>` : "";
  const dl = facts(m).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  return `${note}<p class="stagehand-about">${esc(m.description)}</p><dl class="stagehand-facts">${dl}</dl>`;
}

/** Foundry's own description block, untouched when there is no library. */
function foundryDescription(m) {
  const deps = m.requires.length
    ? `<li><strong>Dependencies:</strong> ${m.requires.map((r) => `<span class="tag">${esc(r)}</span>`).join(" ")}</li>`
    : "";
  return `${esc(m.description)}
    <ul class="package-metadata"><li><strong>Author:</strong> <span class="author">${esc(m.author)}</span></li>${deps}</ul>`;
}

function description(m) {
  return `<div class="package-description">${showsLibrary() ? `<div class="stagehand-details">${detailsHtml(m)}</div>` : foundryDescription(m)}</div>`;
}

/** The row's own details button (Stagehand): opens its details in place, or in the side panel. */
function moreButton(m) {
  if (!showsLibrary()) return "";
  const panel = S.details === "panel";
  const open = panel ? S.selected === m.id : S.open.has(m.id);
  const icon = panel ? "fa-angle-right" : open ? "fa-chevron-up" : "fa-chevron-down";
  const tip = panel ? "Show details" : open ? "Hide details" : "Show details";
  const state = panel ? `aria-pressed="${open}"` : `aria-expanded="${open}"`;
  return `<button type="button" class="inline-control icon fa-solid ${icon} stagehand-more" data-action="moduleDetails"
    ${state} data-tooltip-text="${tip}" aria-label="${tip}: ${esc(m.title)}"></button>`;
}

function row(m) {
  const disabled = isEditable() ? "" : " disabled";
  const open = showsLibrary() && (S.details === "panel" ? S.selected === m.id : S.open.has(m.id));
  const mark = open ? (S.details === "panel" ? " stagehand-selected" : " stagehand-open") : "";
  return `<li class="package flexrow${S.saved.has(m.id) ? " active" : ""}${mark}"${isShown(m) ? "" : " hidden"} data-module-id="${esc(m.id)}">
    <div class="package-overview tags flexrow">
      <label class="package-title flexrow">
        <input type="checkbox" name="${esc(m.id)}"${S.ticks.has(m.id) ? " checked" : ""}${disabled}>
        <div class="title-group"><span class="title">${esc(m.title)}</span></div>
      </label>
      ${libraryTags(m)}${foundryTags(m)}${moreButton(m)}
    </div>
    ${description(m)}
  </li>`;
}

// ---------- folder groups ----------

const childFolders = (parentId) => FOLDERS.filter((f) => f.parentId === parentId);
const modulesIn = (folderId, mods) => mods.filter((m) => folderIdOf(m.id) === folderId);

/** The folder's modules and its subfolders' modules. */
function deepModules(folder, mods) {
  return [...modulesIn(folder.id, mods), ...childFolders(folder.id).flatMap((c) => deepModules(c, mods))];
}

function group(folder, mods) {
  const all = deepModules(folder, mods);
  if (!all.length) return "";
  const shown = all.filter(isShown);
  const searching = S.search.trim() !== "";
  const open = searching || !S.collapsed.has(folder.id);
  const on = all.filter((m) => S.saved.has(m.id)).length;
  const color = folder.color ? ` style="--sidebar-folder-color: ${folder.color}"` : "";
  const inner = [...childFolders(folder.id).map((c) => group(c, mods)), ...modulesIn(folder.id, mods).map(row)].join("");
  return `<li class="folder stagehand-folder flexcol${open ? " expanded" : ""}"${shown.length ? "" : " hidden"} data-folder-id="${esc(folder.id)}"${color}>
    <header class="folder-header" role="button" tabindex="0" aria-expanded="${open}" data-action="toggleFolder">
      <i class="fa-solid ${open ? "fa-folder-open" : "fa-folder"} fa-fw" inert></i>
      <span class="folder-name ellipsis">${esc(folder.name)}</span>
      <span class="stagehand-count">${on} of ${all.length} active</span>
    </header>
    <ol class="subdirectory plain"${open ? "" : " hidden"}>${inner}</ol>
  </li>`;
}

function listHtml() {
  const mods = listed();
  if (!mods.length) return `<p class="hint">No Modules are available within this World.</p>`;
  if (!showsLibrary() || S.view === "az") return mods.map(row).join("");
  const loose = { id: NONE, name: "Not in a folder", color: "" };
  return [...childFolders(null), loose].map((f) => group(f, mods)).join("");
}

// ---------- the window ----------

function filtersHtml() {
  if (!isEditable()) return "";
  const count = { all: MODULES.length, active: S.saved.size, inactive: MODULES.length - S.saved.size };
  const label = { all: "All Modules", active: "Active Modules", inactive: "Inactive Modules" };
  return ["all", "active", "inactive"]
    .map((f) => `<a class="filter${S.filter === f ? " active" : ""}" data-action="changeFilter" data-filter="${f}">${label[f]} (${count[f]})</a>`)
    .join("");
}

function viewToggleHtml() {
  if (!showsLibrary()) return "";
  const az = S.view === "az";
  const tip = az ? "Group by library folders" : "Sort A–Z";
  return `<button type="button" class="inline-control icon fa-solid ${az ? "fa-folder-tree" : "fa-arrow-down-a-z"} stagehand-view"
    data-action="stagehandView" data-tooltip-text="${tip}" aria-label="${tip}"></button>`;
}

function searchRowHtml() {
  const tip = S.expanded ? "Collapse" : "Expand";
  return `${filtersHtml()}${viewToggleHtml()}
    <button type="button" class="inline-control icon fa-solid fa-angle-double-${S.expanded ? "down" : "up"}"
      data-action="toggleExpanded" data-tooltip-text="${tip}" aria-label="${tip}"></button>`;
}

function footerHtml() {
  if (!isEditable()) return "";
  const apply = canApply()
    ? `<button type="button" data-action="applyPresets"><i class="fa-solid fa-layer-group" inert></i><span>Apply Presets…</span></button>`
    : "";
  return `<footer class="form-footer">
    <button type="submit"><i class="fa-regular fa-floppy-disk" inert></i><span>Save Module Settings</span></button>
    <button type="button" data-action="deactivateAll"><i class="fa-solid fa-ban" inert></i><span>Deactivate All Modules</span></button>
    ${apply}
  </footer>`;
}

function sourceHint() {
  return showsLibrary()
    ? `<p class="hint stagehand-source">Folders, tags and notes come from this server's Stagehand library and are organised on the Setup screen.</p>`
    : "";
}

function windowHtml() {
  const hint = isEditable()
    ? "Use this form to configure which Modules are active within your current World. Submitting changes to active modules will cause the current session to reload."
    : "The Modules listed below are currently active within this World.";
  const wide = showsLibrary() && S.details === "panel" ? " stagehand-wide" : "";
  return `<form id="module-management" class="application${wide}" autocomplete="off">
    <header class="window-header">
      <i class="window-icon fa-fw fa-solid fa-cube" inert></i>
      <h1 class="window-title">Module Management</h1>
      <button type="button" class="header-control icon fa-solid fa-ellipsis-vertical" data-tooltip-text="Toggle Controls" aria-label="Toggle Controls"></button>
      <button type="button" class="header-control icon fa-solid fa-xmark" data-tooltip-text="Close Window" aria-label="Close Window" data-action="close"></button>
    </header>
    <section class="window-content standard-form">
      <p class="hint">${hint}</p>
      <search class="flexrow" aria-label="Module Management Navigation">
        <input type="search" id="module-search" autocomplete="off" placeholder="Filter Modules" aria-label="Filter Modules" value="${esc(S.search)}">
        <span class="search-row" style="display: contents">${searchRowHtml()}</span>
      </search>
      ${bodyHtml()}
      ${sourceHint()}
      ${footerHtml()}
    </section>
  </form>`;
}

function asideHtml() {
  const m = MODULE_BY_ID[S.selected];
  if (!m) return `<p class="hint stagehand-empty">Choose <i class="fa-solid fa-angle-right" inert></i> on a module to see its details here.</p>`;
  const state = S.saved.has(m.id) ? "Active in this world" : "Not active in this world";
  return `<h3 class="stagehand-aside-title">${esc(m.title)}</h3>
    <p class="stagehand-aside-state${S.saved.has(m.id) ? " on" : ""}">${state}</p>
    ${detailsHtml(m)}`;
}

function bodyHtml() {
  const menu = `<menu class="package-list scrollable${S.expanded ? " expanded" : ""}">${listHtml()}</menu>`;
  if (!(showsLibrary() && S.details === "panel")) return menu;
  return `<div class="stagehand-split">${menu}<aside class="stagehand-aside" aria-label="Module details">${asideHtml()}</aside></div>`;
}

// ---------- rendering and actions ----------

function renderList() {
  const win = document.getElementById("module-management");
  if (!win) return;
  win.querySelector(".package-list").innerHTML = listHtml();
  win.querySelector(".package-list").classList.toggle("expanded", S.expanded);
  win.querySelector(".search-row").innerHTML = searchRowHtml();
  const aside = win.querySelector(".stagehand-aside");
  if (aside) aside.innerHTML = asideHtml();
}

function openWindow() {
  S.windowOpen = true;
  const host = document.getElementById("windows");
  host.querySelector("#module-management")?.remove();
  host.insertAdjacentHTML("afterbegin", windowHtml());
  bindWindow(host.querySelector("#module-management"));
}

function closeWindow() {
  S.windowOpen = false;
  document.getElementById("module-management")?.remove();
}

const ACTIONS = {
  close: closeWindow,
  changeFilter: (el) => { S.filter = el.dataset.filter; renderList(); },
  toggleExpanded: () => { S.expanded = !S.expanded; renderList(); },
  stagehandView: () => { S.view = S.view === "az" ? "folders" : "az"; store("view", S.view); renderList(); },
  toggleFolder: (el) => toggleFolder(el.closest("[data-folder-id]").dataset.folderId),
  deactivateAll: () => { S.ticks = new Set(); renderList(); },
  applyPresets: () => openPicker(),
  moduleDetails: (el) => toggleDetails(el.closest("[data-module-id]").dataset.moduleId),
};

function toggleDetails(id) {
  if (S.details === "panel") S.selected = id;
  else if (S.open.has(id)) S.open.delete(id);
  else S.open.add(id);
  renderList();
}

function toggleFolder(id) {
  if (S.collapsed.has(id)) S.collapsed.delete(id);
  else S.collapsed.add(id);
  store("collapsed", [...S.collapsed]);
  renderList();
}

function bindWindow(win) {
  win.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || !win.contains(el)) return;
    e.preventDefault();
    ACTIONS[el.dataset.action]?.(el);
  });
  win.addEventListener("keydown", (e) => {
    const header = e.target.closest?.(".folder-header");
    if (header && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ACTIONS.toggleFolder(header); }
  });
  win.addEventListener("change", (e) => {
    const box = e.target.closest('.package input[type="checkbox"]');
    if (!box) return;
    if (box.checked) S.ticks.add(box.name);
    else S.ticks.delete(box.name);
  });
  win.querySelector("#module-search").addEventListener("input", (e) => { S.search = e.target.value; renderList(); });
  win.addEventListener("submit", (e) => { e.preventDefault(); saveSettings(); });
}

function saveSettings() {
  if (!isDirty()) { closeWindow(); return; }
  S.saved = new Set(S.ticks);
  closeWindow();
  reloadWorld();
}
