// Foundry's Module Management window, as 14.370 renders it (frame and list
// markup captured from the live window). With a Stagehand library on the
// server, Gamemasters get Setup's world page inside it (cards.js), unless they
// turn off "Library view in Module Management" (settings.js):
// then it is Foundry's own list, untouched, so what other modules add to its
// rows keeps working there.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const isEditable = () => S.role !== "player";
const showsLibrary = () => S.library && S.role !== "player";
const usesCards = () => showsLibrary() && S.structured;
const isDirty = () => S.ticks.size !== S.saved.size || [...S.ticks].some((id) => !S.saved.has(id));
const tagsOf = (id) => (TAGS_OF[id] ?? []).map((t) => TAGS.find((x) => x.id === t)).filter(Boolean);

// ---------- Foundry's own list ----------

function foundryRow(m) {
  const shown = (S.filter === "all" || (S.filter === "active") === S.saved.has(m.id)) && m.title.toLowerCase().includes(S.search.trim().toLowerCase());
  const packs = m.packs ? `<span class="tag flexrow compendium" data-tooltip-text="Compendium Packs" aria-label="Compendium Packs"><i class="fa-solid fa-book fa-fw" inert></i></span>` : "";
  const badge = `<span class="tag flexrow badge ${m.unverified ? "warning" : "success"}" data-tooltip-text="Package is ${m.unverified ? "not " : ""}verified for this version of Foundry"><i class="fa-solid fa-code-branch fa-fw" inert></i> ${esc(m.version)}</span>`;
  const deps = m.requires.length ? `<li><strong>Dependencies:</strong> ${m.requires.map((r) => `<span class="tag">${esc(r)}</span>`).join(" ")}</li>` : "";
  return `<li class="package flexrow${S.saved.has(m.id) ? " active" : ""}"${shown ? "" : " hidden"} data-module-id="${esc(m.id)}">
    <div class="package-overview tags flexrow">
      <label class="package-title flexrow">
        <input type="checkbox" name="${esc(m.id)}"${S.ticks.has(m.id) ? " checked" : ""}${isEditable() ? "" : " disabled"}>
        <div class="title-group"><span class="title">${esc(m.title)}</span></div>
      </label>
      <span class="tag flexrow" data-tooltip-text="${esc(m.author)}" data-locked><i class="fa-solid fa-user fa-fw" inert></i></span>${packs}${badge}
    </div>
    <div class="package-description">${esc(m.description)}
      <ul class="package-metadata"><li><strong>Author:</strong> <span class="author">${esc(m.author)}</span></li>${deps}</ul></div>
  </li>`;
}

function foundryListHtml() {
  const mods = MODULES.filter((m) => isEditable() || S.saved.has(m.id)).sort((a, b) => a.title.localeCompare(b.title));
  return mods.length ? mods.map(foundryRow).join("") : `<p class="hint">No Modules are available within this World.</p>`;
}

function foundrySearchRowHtml() {
  const count = { all: MODULES.length, active: S.saved.size, inactive: MODULES.length - S.saved.size };
  const label = { all: "All Modules", active: "Active Modules", inactive: "Inactive Modules" };
  const filters = isEditable()
    ? ["all", "active", "inactive"].map((f) => `<a class="filter${S.filter === f ? " active" : ""}" data-action="changeFilter" data-filter="${f}">${label[f]} (${count[f]})</a>`).join("")
    : "";
  const tip = S.expanded ? "Collapse" : "Expand";
  const expand = `<button type="button" class="inline-control icon fa-solid fa-angle-double-${S.expanded ? "down" : "up"}" data-action="toggleExpanded" data-tooltip-text="${tip}" aria-label="${tip}"></button>`;
  return `${filters}${expand}`;
}

function foundryContentHtml() {
  const hint = isEditable()
    ? "Use this form to configure which Modules are active within your current World. Submitting changes to active modules will cause the current session to reload."
    : "The Modules listed below are currently active within this World.";
  const footer = isEditable()
    ? `<footer class="form-footer">
        <button type="submit"><i class="fa-regular fa-floppy-disk" inert></i><span>Save Module Settings</span></button>
        <button type="button" data-action="deactivateAll"><i class="fa-solid fa-ban" inert></i><span>Deactivate All Modules</span></button>
      </footer>`
    : "";
  return `<p class="hint">${hint}</p>
    <search class="flexrow" aria-label="Module Management Navigation">
      <input type="search" id="module-search" autocomplete="off" placeholder="Filter Modules" aria-label="Filter Modules" value="${esc(S.search)}">
      <span class="search-row" style="display: contents">${foundrySearchRowHtml()}</span>
    </search>
    <menu class="package-list scrollable${S.expanded ? " expanded" : ""}">${foundryListHtml()}</menu>
    ${footer}`;
}

// ---------- the window ----------

function windowHtml() {
  return `<form id="module-management" class="application${usesCards() ? " stagehand-cards" : ""}" autocomplete="off">
    <header class="window-header">
      <i class="window-icon fa-fw fa-solid fa-cube" inert></i>
      <h1 class="window-title">Module Management</h1>
      <button type="button" class="header-control icon fa-solid fa-ellipsis-vertical" data-tooltip-text="Toggle Controls" aria-label="Toggle Controls"></button>
      <button type="button" class="header-control icon fa-solid fa-xmark" data-tooltip-text="Close Window" aria-label="Close Window" data-action="close"></button>
    </header>
    <section class="window-content standard-form">${usesCards() ? cardsContentHtml() : foundryContentHtml()}</section>
  </form>`;
}

function render() {
  const win = document.getElementById("module-management");
  if (!win) return;
  if (usesCards()) { renderCards(win); return; }
  win.querySelector(".package-list").innerHTML = foundryListHtml();
  win.querySelector(".package-list").classList.toggle("expanded", S.expanded);
  win.querySelector(".search-row").innerHTML = foundrySearchRowHtml();
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
  changeFilter: (el) => { S.filter = el.dataset.filter; render(); },
  toggleExpanded: () => { S.expanded = !S.expanded; render(); },
  show: (el) => { S.show = el.dataset.id; render(); },
  toggleFolder: (el) => { toggleSet(S.collapsed, el.dataset.id); store("collapsed", [...S.collapsed]); render(); },
  openPanel: (el) => { S.selected = S.selected === el.dataset.id ? null : el.dataset.id; render(); },
  closePanel: () => { S.selected = null; render(); },
  ptab: (el) => { S.ptab = el.dataset.id; render(); },
  fixOn: (el) => { S.ticks.add(el.dataset.id); render(); },
  addPreset: () => openPicker(),
  review: () => openReview(),
  discard: () => { S.ticks = new Set(S.saved); S.fromPreset = new Map(); S.marked = []; render(); },
  deactivateAll: () => { S.ticks = new Set(usesCards() ? [STAGEHAND] : []); render(); },
};

function toggleSet(set, id) {
  if (set.has(id)) set.delete(id);
  else set.add(id);
}

function setTick(id, on) {
  if (on) S.ticks.add(id);
  else { S.ticks.delete(id); S.fromPreset.delete(id); }
}

function bindWindow(win) {
  win.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || !win.contains(el) || el.matches("input")) return;
    e.preventDefault();
    ACTIONS[el.dataset.action]?.(el);
  });
  win.addEventListener("keydown", (e) => {
    const el = e.target.closest?.(".stc-head, .stw-card");
    if (!el || e.target !== el || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    ACTIONS[el.dataset.action]?.(el);
  });
  win.addEventListener("change", (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (e.target.matches('select[name="groupBy"]')) { S.groupBy = e.target.value; store("groupBy", S.groupBy); render(); return; }
    if (!box) return;
    if (box.matches(".sts-switch")) { setTick(box.dataset.id, box.checked); render(); return; }
    setTick(box.name, box.checked);
  });
  win.querySelector("#module-search").addEventListener("input", (e) => { S.search = e.target.value; render(); });
  win.addEventListener("submit", (e) => { e.preventDefault(); save(); });
}

function save() {
  if (!isDirty()) { closeWindow(); return; }
  if (usesCards()) { openReview(); return; }
  S.saved = new Set(S.ticks);
  closeWindow();
  reloadWorld();
}
