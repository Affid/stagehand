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

function description(m) {
  const note = showsLibrary() && NOTES[m.id] ? `<p class="stagehand-note-line"><strong>Note:</strong> ${esc(NOTES[m.id])}</p>` : "";
  const deps = m.requires.length
    ? `<li><strong>Dependencies:</strong> ${m.requires.map((r) => `<span class="tag">${esc(r)}</span>`).join(" ")}</li>`
    : "";
  return `<div class="package-description">${note}${esc(m.description)}
    <ul class="package-metadata"><li><strong>Author:</strong> <span class="author">${esc(m.author)}</span></li>${deps}</ul></div>`;
}

function row(m) {
  const disabled = isEditable() ? "" : " disabled";
  return `<li class="package flexrow${S.saved.has(m.id) ? " active" : ""}"${isShown(m) ? "" : " hidden"} data-module-id="${esc(m.id)}">
    <div class="package-overview tags flexrow">
      <label class="package-title flexrow">
        <input type="checkbox" name="${esc(m.id)}"${S.ticks.has(m.id) ? " checked" : ""}${disabled}>
        <div class="title-group"><span class="title">${esc(m.title)}</span></div>
      </label>
      ${libraryTags(m)}${foundryTags(m)}
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
  return `<form id="module-management" class="application" autocomplete="off">
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
      <menu class="package-list scrollable${S.expanded ? " expanded" : ""}">${listHtml()}</menu>
      ${sourceHint()}
      ${footerHtml()}
    </section>
  </form>`;
}

// ---------- rendering and actions ----------

function renderList() {
  const win = document.getElementById("module-management");
  if (!win) return;
  win.querySelector(".package-list").innerHTML = listHtml();
  win.querySelector(".package-list").classList.toggle("expanded", S.expanded);
  win.querySelector(".search-row").innerHTML = searchRowHtml();
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
};

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
