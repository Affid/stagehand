// Setup's world page, Modules tab, inside Foundry's Module Management: folder
// sections of cards with a switch each, All / On / Changes, Apply preset, the
// module panel (Library and Package tabs). Same markup and classes as the
// Setup mockup (design/setup-page/src/_calm.js, _shell.js), read-only for the
// library: folders, tags and notes are organised on the Setup screen.

const UNFILED = { id: "__unfiled", name: "Unfiled", color: "" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isOn = (id) => S.ticks.has(id);
const wasOn = (id) => S.saved.has(id);
const changes = () => MODULES.filter((m) => isOn(m.id) !== wasOn(m.id));
const canAddPreset = () => S.role === "gm";

/** For each module, the modules switched on here that need it. */
function usersOn() {
  const out = new Map();
  MODULES.filter((m) => isOn(m.id)).forEach((m) => m.requires.forEach((r) => out.set(r, [...(out.get(r) ?? []), m.id])));
  return out;
}

/** The one line under a card's name: the most useful thing to know before flipping it (Setup's cardWhy). */
function cardWhy(m, users) {
  if (m.id === STAGEHAND) return { cls: "", icon: "fa-lock", html: "Always on: it lets this world report back" };
  const missing = isOn(m.id) ? m.requires.filter((r) => !isOn(r)) : [];
  if (missing.length) return { cls: "dep", icon: "fa-link-slash", html: `Needs ${esc(titleOf(missing[0]))}, which is off` };
  const need = users.get(m.id) ?? [];
  if (!isOn(m.id) && need.length) return { cls: "warn", icon: "fa-link-slash", html: `${plural(need.length, "module")} here need${need.length === 1 ? "s" : ""} it · <a data-action="fixOn" data-id="${esc(m.id)}">Turn it on</a>` };
  if (S.fromPreset.has(m.id) && isOn(m.id) && !wasOn(m.id)) return { cls: "", icon: "fa-layer-group", html: `From the preset ${esc(S.fromPreset.get(m.id))}` };
  if (need.length) return { cls: "", icon: "fa-link", html: `${plural(need.length, "module")} here need${need.length === 1 ? "s" : ""} it`, tip: need.map(titleOf).join(", ") };
  if (m.unverified) return { cls: "warn", icon: "fa-code-branch", html: "Not verified for Foundry 14" };
  if (NOTES[m.id]) return { cls: "note", icon: "fa-note-sticky", html: esc(NOTES[m.id]) };
  return { cls: "desc", icon: "", html: esc(m.description) };
}

function cardHtml(m, users) {
  const now = isOn(m.id);
  const delta = now === wasOn(m.id) ? "" : now ? "plus" : "minus";
  const why = cardWhy(m, users);
  const viewing = S.selected === m.id ? " viewing" : "";
  const locked = m.id === STAGEHAND;
  const sw = `<input type="checkbox" class="sts-switch" data-action="toggle" data-id="${esc(m.id)}"${now ? " checked" : ""}${locked ? " disabled" : ""}
    aria-label="${esc(m.title)} on in this world">`;
  const chip = delta ? `<span class="stw-delta">${now ? "turns on" : "turns off"}</span>` : "";
  const flags = `${why.cls === "warn" ? " prob" : ""}${why.cls === "dep" ? " dep" : ""}`;
  return `<li class="stw-card ${now ? "on" : "off"} ${delta}${flags}${viewing}" data-action="openPanel" data-id="${esc(m.id)}" tabindex="0">
    <div class="l1">${sw}<span class="t">${esc(m.title)}</span>${chip}</div>
    <div class="l2 ${why.cls}"${why.tip ? ` data-tooltip-text="${esc(why.tip)}"` : ""}>${why.icon ? `<i class="fa-solid ${why.icon}" inert></i>` : ""}<span>${why.html}</span></div>
  </li>`;
}

function keepsCard(m) {
  if (S.show === "on" && !isOn(m.id)) return false;
  if (S.show === "changes" && isOn(m.id) === wasOn(m.id)) return false;
  const q = S.search.trim().toLowerCase();
  if (!q) return true;
  return [m.title, m.id, ...tagsOf(m.id).map((t) => t.name), NOTES[m.id] ?? ""].some((x) => x.toLowerCase().includes(q));
}

// ---------- groups: Setup's Group by (model/library-groups.ts) ----------

const GROUP_BYS = [["folder", "Folder"], ["tag", "Tag"], ["author", "Author"], ["smart", "Smart group"]];
const having = (test) => MODULES.filter(test);

/** Smart groups a world can work out from its own manifests; "Unused in known worlds" needs the other worlds. */
function smartGroups() {
  const systems = [...new Set(MODULES.map((m) => m.system).filter(Boolean))];
  return [
    { key: "smart:library", name: "Libraries", mods: having((m) => m.library) },
    { key: "smart:content", name: "Content packs", mods: having((m) => m.contentOnly) },
    ...systems.map((s) => ({ key: `smart:system:${s}`, name: `System: ${s}`, mods: having((m) => m.system === s) })),
    { key: "smart:unverified", name: "Not verified for this core version", mods: having((m) => m.unverified) },
  ];
}

function groups() {
  if (S.groupBy === "tag") {
    const tagged = (m) => (TAGS_OF[m.id] ?? []).length > 0;
    return [...TAGS.map((t) => ({ key: `tag:${t.id}`, name: t.name, color: t.color, mods: having((m) => (TAGS_OF[m.id] ?? []).includes(t.id)) })),
      { key: "untagged", name: "Untagged", mods: having((m) => !tagged(m)) }];
  }
  if (S.groupBy === "author") {
    return [...new Set(MODULES.map((m) => m.author))].sort((a, b) => a.localeCompare(b))
      .map((a) => ({ key: `author:${a}`, name: a, mods: having((m) => m.author === a) }));
  }
  if (S.groupBy === "smart") return smartGroups();
  return [...FOLDERS, UNFILED].map((f) => ({ key: f.id, name: f.name, color: f.color, mods: having((m) => (FOLDER_OF[m.id] ?? UNFILED.id) === f.id) }));
}

function sectionHtml(g, users) {
  const all = [...g.mods].sort((a, b) => a.title.localeCompare(b.title));
  const shown = all.filter(keepsCard);
  if (!shown.length) return "";
  const on = all.filter((m) => isOn(m.id)).length;
  const folded = S.collapsed.has(g.key) && S.search.trim() === "";
  const c = g.color || "var(--color-cool-3)";
  return `<li class="stc-sec" data-group="${esc(g.key)}" style="--c:${c}">
    <header class="stc-head" data-action="toggleFolder" data-id="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${!folded}">
      <i class="fa-solid fa-chevron-${folded ? "right" : "down"} fa-fw" inert></i><span class="name">${esc(g.name)}</span><span class="count">${on} of ${all.length} on</span>
    </header>
    ${folded ? "" : `<ol class="stw-grid">${shown.map((m) => cardHtml(m, users)).join("")}</ol>`}
  </li>`;
}

function sectionsHtml() {
  const users = usersOn();
  const html = groups().map((g) => sectionHtml(g, users)).join("");
  const empty = S.show === "changes" ? "Nothing changed yet." : S.show === "on" ? "No modules on." : "No modules match.";
  return html || `<li class="stc-empty">${empty}</li>`;
}

// ---------- tools row, pending strip, footer ----------

function toolsHtml() {
  const n = changes().length;
  const seg = (id, label) => `<button type="button" data-action="show" data-id="${id}" aria-pressed="${S.show === id}">${label}</button>`;
  const add = canAddPreset() ? `<button type="button" data-action="addPreset"><i class="fa-solid fa-layer-group" inert></i>Apply preset…</button>` : "";
  return `<div class="stc-tools">
    <input type="search" id="module-search" autocomplete="off" placeholder="Filter modules" aria-label="Filter modules" value="${esc(S.search)}">
    <span class="st-seg2" role="group" aria-label="Show">${seg("all", `All ${MODULES.length}`)}${seg("on", `On ${S.ticks.size}`)}${seg("changes", `Changes${n ? ` ${n}` : ""}`)}</span>
    ${add}${groupByHtml()}
  </div>`;
}

/** Setup's Group by, as on its Library's toolbar. */
function groupByHtml() {
  const options = GROUP_BYS.map(([id, label]) => `<option value="${id}"${S.groupBy === id ? " selected" : ""}>${label}</option>`).join("");
  return `<label class="stc-group"><span>Group by</span><select name="groupBy" aria-label="Group by">${options}</select></label>`;
}

function problemsCount() {
  return MODULES.filter((m) => isOn(m.id) && m.requires.some((r) => !isOn(r))).length;
}

function pendingHtml() {
  const n = changes().length;
  if (!n) return "";
  const probs = problemsCount();
  return `<div class="stc-pending${probs ? " warn" : ""}"><i class="fa-solid ${probs ? "fa-triangle-exclamation" : "fa-clock-rotate-left"}" inert></i>
    <span>${plural(n, "change")} not saved yet${probs ? ` · ${plural(probs, "problem")}` : ""}</span>
    <a data-action="review">Review</a><a data-action="discard">Discard</a></div>`;
}

function cardsFooterHtml() {
  const n = changes().length;
  return `<footer class="form-footer">
    <button type="submit"><i class="fa-regular fa-floppy-disk" inert></i><span>Save Module Settings</span>${n ? `<span class="stc-badge" aria-label="${plural(n, "change")}">${n}</span>` : ""}</button>
    <button type="button" data-action="deactivateAll"><i class="fa-solid fa-ban" inert></i><span>Deactivate All Modules</span></button>
  </footer>`;
}

// ---------- the module panel ----------

function libraryTab(m) {
  const folder = FOLDERS.find((f) => f.id === FOLDER_OF[m.id])?.name ?? "Unfiled";
  const tags = tagsOf(m.id).map((t) => `<span class="st-chip"><i class="st-dot" style="--st-c:${t.color}"></i>${esc(t.name)}</span>`).join("") || '<span class="st-muted">None</span>';
  const chip = (p) => presetState(p, S.ticks).active
    ? `<span class="st-chip active" data-tooltip-text="Active: all its modules are on in this world"><i class="fa-solid fa-check" inert></i>${esc(p.name)}</span>`
    : `<span class="st-chip"><i class="fa-solid fa-layer-group" inert></i>${esc(p.name)}</span>`;
  const presets = PRESETS.filter((p) => p.modules.includes(m.id)).map(chip).join("") || '<span class="st-muted">None</span>';
  const now = isOn(m.id);
  const d = now === wasOn(m.id) ? "<span></span>" : `<span class="d ${now ? "plus" : "minus"}">${now ? "turns on" : "turns off"}</span>`;
  return `<div class="sts-kv"><span>Folder</span><span class="v">${esc(folder)}</span>
      <span>Tags</span><div class="chips">${tags}</div>
      <span>Note</span>${NOTES[m.id] ? `<span class="note">${esc(NOTES[m.id])}</span>` : '<span class="st-muted">None</span>'}
      <span>Presets</span><div class="chips">${presets}</div></div>
    <div class="sts-chg"><h4><span>This world</span></h4><ul class="sts-wlist">
      <li><span>Curse of Strahd</span>${d}<input type="checkbox" class="sts-switch" data-action="toggle" data-id="${esc(m.id)}"${now ? " checked" : ""}${m.id === STAGEHAND ? " disabled" : ""} aria-label="On in Curse of Strahd"></li></ul></div>
    <p class="stagehand-source">Folders, tags, notes and presets come from this server's Stagehand library and are organised on the Setup screen.</p>`;
}

function packageTab(m) {
  const badge = m.unverified ? '<span class="sts-badge warn"><i class="fa-solid fa-code-branch" inert></i>not verified for 14</span>' : '<span class="sts-badge ok"><i class="fa-solid fa-code-branch" inert></i>verified for 14.370</span>';
  const needs = m.requires.map((r) => `<li><span class="s"><i class="fa-solid fa-link" inert></i></span><span>Needs ${esc(titleOf(r))}</span><span class="x">${isOn(r) ? "on" : "off"}</span></li>`);
  const users = MODULES.filter((x) => x.requires.includes(m.id)).map((x) => `<li><span class="s"><i class="fa-solid fa-link" inert></i></span><span>Needed by ${esc(x.title)}</span><span class="x">${isOn(x.id) ? "on" : "off"}</span></li>`);
  const rels = [...needs, ...users].join("");
  return `<div class="sts-kv"><span>Version</span><span class="v">${esc(m.version)} ${badge}</span>
      <span>Authors</span><span class="v">${esc(m.author)}</span></div>
    <p class="stagehand-about">${esc(m.description)}</p>
    ${rels ? `<div class="sts-chg"><h4><span>Relationships</span></h4><ul>${rels}</ul></div>` : ""}
    <div class="sts-chg"><h4><span>Contents</span></h4><ul>
      <li><span class="s"><i class="fa-solid fa-book" inert></i></span><span>${m.packs ? "Compendium packs" : "No compendium packs"}</span><span></span></li></ul></div>`;
}

function panelHtml() {
  const m = MODULE_BY_ID[S.selected];
  if (!m) return "";
  const t = (id, icon, label) => `<a class="${S.ptab === id ? "active" : ""}" data-action="ptab" data-id="${id}"><i class="fa-solid ${icon}" inert></i>${label}</a>`;
  return `<aside class="sts-panel" aria-label="Module">
    <h2 class="divider">Module</h2>
    <button type="button" class="icon sts-close" data-action="closePanel" aria-label="Close" data-tooltip-text="Close"><i class="fa-solid fa-xmark" inert></i></button>
    <div class="scroll">
      <div class="sts-modhead"><h3>${esc(m.title)}</h3><div class="sub">${esc(m.id)} · v${esc(m.version)} · ${esc(m.author)}</div></div>
      <nav class="sts-subtabs">${t("library", "fa-books", "Library")}${t("package", "fa-box-open", "Package")}</nav>
      ${S.ptab === "package" ? packageTab(m) : libraryTab(m)}
    </div>
  </aside>`;
}

/** The window's content in the Cards layout. */
function cardsContentHtml() {
  return `${toolsHtml()}<div class="stagehand-pending-slot">${pendingHtml()}</div>
    <div class="stagehand-body"><ol class="stc-sections">${sectionsHtml()}</ol>${panelHtml()}</div>
    <div class="stagehand-footer-slot">${cardsFooterHtml()}</div>`;
}

/** Redraw what changes with state, keeping the search box (and its focus) in place. */
function renderCards(win) {
  const seg = win.querySelector(".st-seg2");
  const tools = document.createElement("div");
  tools.innerHTML = toolsHtml();
  seg.replaceWith(tools.querySelector(".st-seg2"));
  win.querySelector(".stagehand-pending-slot").innerHTML = pendingHtml();
  const body = win.querySelector(".stagehand-body");
  const scroll = body.querySelector(".stc-sections").scrollTop;
  body.innerHTML = `<ol class="stc-sections">${sectionsHtml()}</ol>${panelHtml()}`;
  body.querySelector(".stc-sections").scrollTop = scroll;
  win.querySelector(".stagehand-footer-slot").innerHTML = cardsFooterHtml();
}
