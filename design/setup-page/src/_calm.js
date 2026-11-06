// ---------- "?calm=1": a quieter world page for the review-at-launch variant ----------
// One line per module instead of Foundry's install cards, one change marker instead of two,
// pending changes in the banner, and the controls folded into the tab row.
const CALM = Q.get("calm") === "1";
if (CALM) document.body.classList.add("mls-calm");
ST.layout = "cards";

function calmBanner(w) {
  const n = w.noCompanion ? 0 : diff(w.id).length, probs = w.noCompanion ? [] : problems(w.id);
  const safe = ST.safeMode?.has(w.id) ? '<span class="mlc-safe"><i class="fa-solid fa-shield"></i>Next launch in safe mode</span>' : "";
  const pending = n || probs.length
    ? `<div class="mlc-pending${probs.length ? " warn" : ""}"><i class="fa-solid ${probs.length ? "fa-triangle-exclamation" : "fa-clock-rotate-left"}"></i>
        <span>${n ? `${plural(n, "change")} wait${n === 1 ? "s" : ""} for the next launch` : ""}${probs.length ? `${n ? " · " : ""}${plural(probs.length, "problem")}` : ""}</span>
        <a data-act="launch">Review</a><a data-act="discard">Discard</a></div>` : "";
  const flags = safe ? `<div class="mlc-flags">${safe}</div>` : "";
  const fav = ST.wfav.has(w.id), locked = ST.wlock.has(w.id);
  const star = `<button type="button" class="mlw-star${fav ? " on" : ""}" data-act="wfav" aria-pressed="${fav}" aria-label="Favourite" data-tooltip="${fav ? "Favourite: shown first in the worlds list. Click to remove." : "Mark as favourite: shown first in the worlds list"}"><i class="fa-${fav ? "solid" : "regular"} fa-star"></i></button>`;
  const lockTag = locked ? '<span class="mlw-locktag" data-tooltip="Locked in Foundry: it can\'t be launched, edited, updated or deleted. Unlock it on the About tab."><i class="fa-solid fa-lock"></i>Locked</span>' : "";
  const block = ST.backupJob?.wid === w.id ? "Waiting for the backup to finish" : locked ? "Locked: unlock it on the About tab to launch" : "";
  return `<div class="mls-banner" style="--img:url(${IMG[w.img]});--pos:${w.pos}"><div><h2>${esc(w.title)}${star}${lockTag}</h2>
    <div class="meta"><span><i class="fa-solid fa-dice-d20"></i>${esc(w.system)}</span><span><i class="fa-solid fa-clock"></i>Last played ${w.last}</span><span><i class="fa-solid fa-plug"></i>${w.noCompanion ? "Modules unknown" : `${onCount(w.id, baseOn)} modules on now`}</span></div>${pending}${flags}</div>
    <div class="acts"><button type="button" class="icon" data-act="wtab" data-id="about" data-tooltip="Edit the world's details" aria-label="Edit the world's details"><i class="fa-solid fa-pen"></i></button>
    ${block ? `<span class="mlw-tipwrap" data-tooltip="${block}">` : ""}<button type="button" class="bright mls-launch" data-act="launch"${block ? " disabled" : ""}><i class="fa-solid fa-play"></i>Launch${n ? `<span class="mlc-badge" aria-label="${plural(n, "change")} to review">${n}</span>` : ""}</button>${block ? "</span>" : ""}</div></div>`;
}

function calmTabs(w, tabs) {
  if (ST.wtab !== "modules" || w.noCompanion) return tabs;
  const n = diff(w.id).length;
  const seg = (id, l) => `<span class="${ST.show === id ? "on" : ""}" data-act="show" data-id="${id}">${l}</span>`;
  const tools = `<div class="mlc-tools"><input type="search" data-filter="cards" value="${esc(ST.q)}" placeholder="Filter modules" aria-label="Filter modules">
    <span class="ml-seg2">${seg("all", "All")}${seg("on", "On")}${seg("changes", `Changes${n ? ` ${n}` : ""}`)}</span>
    <button type="button" data-act="addmenu"><i class="fa-solid fa-plus"></i>Add<i class="fa-solid fa-caret-down"></i></button>
    <button type="button" class="icon" data-act="viewpop" data-tooltip="View options" aria-label="View options"><i class="fa-solid fa-sliders"></i></button></div>`;
  return tabs.replace(/<\/nav>$/, `${tools}</nav>`);
}

function calmRow(w, m, probs) {
  const now = desired(w.id, m.id), was = baseOn(w.id, m.id);
  const delta = now === was ? "" : now ? "plus" : "minus";
  const prob = probs.get(m.id);
  const companion = m.id === "module-library";
  const viewing = ST.panel?.kind === "module" && ST.panel.id === m.id;
  const dots = tagsOf(m.id).slice(0, 3).map((t) => `<i class="ml-dot" style="--ml-c:${t.color}"></i>`).join("");
  const tip = tagsOf(m.id).map((t) => t.name).join(", ");
  const sw = `<input type="checkbox" class="mls-switch" data-act="toggle" data-id="${m.id}" ${now ? "checked" : ""}${companion ? " disabled" : ""} aria-label="${esc(m.title)} on in ${esc(w.title)}" data-tooltip="${companion ? "Always on: it lets the world report back" : now ? "On" : "Off"}">`;
  return `<li class="mlc-row ${now ? "on" : "off"} ${delta}${prob ? " prob" : ""}${viewing ? " viewing" : ""}" data-act="calmrow" data-id="${m.id}"${prob ? ` data-tooltip="${esc(prob)}"` : ""}>
    ${sw}<span class="t">${esc(m.title)}</span>
    ${m.unverified ? '<i class="fa-solid fa-code-branch mlc-warn" data-tooltip="Not verified for this Foundry version"></i>' : ""}
    ${NOTES[m.id] ? `<i class="fa-solid fa-note-sticky mlc-note" data-tooltip="${esc(NOTES[m.id])}"></i>` : ""}
    ${dots ? `<span class="dots" data-tooltip="Tags: ${esc(tip)}">${dots}</span>` : ""}
    ${delta ? `<span class="d">${now ? "turns on" : "turns off"}</span>` : ""}</li>`;
}

/** For each module, the modules switched on in this world that need it. */
function neededBy(w) {
  const out = new Map();
  ALL_MODULES.filter((m) => desired(w.id, m.id)).forEach((m) => pkgOf(m).req.forEach((r) => out.set(r, [...(out.get(r) ?? []), m.id])));
  return out;
}

/** The one line under a card's name: the most useful thing to know before flipping it. */
function cardWhy(w, m, needs) {
  const on = desired(w.id, m.id), p = pkgOf(m);
  const missing = on ? p.req.filter((r) => !desired(w.id, r)) : [];
  if (missing.length) return { cls: "dep", icon: "fa-link-slash", html: `Needs ${short(missing[0])}, which is off` };
  const clash = on ? p.conf.filter((c) => desired(w.id, c)) : [];
  if (clash.length) return { cls: "warn", icon: "fa-ban", html: `Conflicts with ${short(clash[0])} · <a data-act="fix" data-id="${m.id}" data-on="false">Turn this off</a>` };
  const users = needs.get(m.id) ?? [];
  if (!on && users.length) return { cls: "warn", icon: "fa-link-slash", html: `${plural(users.length, "module")} here need${users.length === 1 ? "s" : ""} it · <a data-act="fix" data-id="${m.id}" data-on="true">Turn it on</a>` };
  const viaPreset = on && !baseOn(w.id, m.id) && !ST.changes.has(`${w.id}:${m.id}`) ? (ST.presetQueue[w.id] ?? []).map((pid) => PRESETS.find((x) => x.id === pid)).find((pr) => pr?.modules.includes(m.id)) : null;
  if (viaPreset) return { cls: "", icon: "fa-layer-group", html: `From the preset ${esc(viaPreset.name)}` };
  if (users.length) return { cls: "", icon: "fa-link", html: `${plural(users.length, "module")} here need${users.length === 1 ? "s" : ""} it`, tip: users.map(short).join(", ") };
  if (m.unverified) return { cls: "warn", icon: "fa-code-branch", html: "Not verified for Foundry 14" };
  if (NOTES[m.id]) return { cls: "note", icon: "fa-note-sticky", html: esc(NOTES[m.id]) };
  return { cls: "desc", icon: "", html: esc(m.shortDesc || m.description || "").replace(/<[^>]*>/g, "") };
}

function calmCard(w, m, needs) {
  const now = desired(w.id, m.id), was = baseOn(w.id, m.id);
  const delta = now === was ? "" : now ? "plus" : "minus";
  const companion = m.id === "module-library";
  const viewing = ST.panel?.kind === "module" && ST.panel.id === m.id;
  const why = companion ? { cls: "", icon: "fa-lock", html: "Always on: it lets this world report back" } : cardWhy(w, m, needs);
  const sw = `<input type="checkbox" class="mls-switch" data-act="toggle" data-id="${m.id}" ${now ? "checked" : ""}${companion ? " disabled" : ""} aria-label="${esc(m.title)} on in ${esc(w.title)}">`;
  const chip = delta ? `<span class="mlw-delta">${now ? "turns on" : "turns off"}</span>` : "";
  return `<li class="mlw-card ${now ? "on" : "off"} ${delta}${why.cls === "warn" ? " prob" : ""}${why.cls === "dep" ? " dep" : ""}${viewing ? " viewing" : ""}" data-act="calmrow" data-id="${m.id}">
    <div class="l1">${sw}<span class="t">${esc(m.title)}</span>${chip}</div>
    <div class="l2 ${why.cls}"${why.tip ? ` data-tooltip="${esc(why.tip)}"` : ""}>${why.icon ? `<i class="fa-solid ${why.icon}"></i>` : ""}<span>${why.html}</span></div></li>`;
}

function calmSections(w) {
  const probs = new Map(problems(w.id).map((p) => [p.id, p.text]));
  const needs = neededBy(w);
  const keep = (m) => ST.show === "all" || (ST.show === "on" ? desired(w.id, m.id) : desired(w.id, m.id) !== baseOn(w.id, m.id));
  return groupsFor(ST.group, ALL_MODULES).map((g) => {
    const mods = g.modules.filter(keep);
    if (!mods.length) return ST.show === "all" ? "" : "";
    const on = g.modules.filter((m) => desired(w.id, m.id)).length;
    const collapsed = ST.collapsed.has(g.key);
    const c = g.color ?? "var(--color-cool-3)";
    return `<li class="mlc-sec ml-section" data-group="${esc(g.key)}" style="--c:${c}"><header class="mlc-head" data-act="collapse" data-id="${esc(g.key)}" aria-expanded="${!collapsed}">
      <i class="fa-solid fa-chevron-${collapsed ? "right" : "down"} fa-fw"></i><span class="name">${esc(g.name)}</span><span class="count">${on} of ${g.modules.length} on</span>
      <button type="button" class="ml-hbtn" data-act="gmenu" data-id="${esc(g.key)}" aria-label="${esc(g.name)}: actions" data-tooltip="Turn all on or off"><i class="fa-solid fa-ellipsis-vertical"></i></button></header>
      ${collapsed ? "" : ST.layout === "cards" ? `<ol class="mlw-grid">${mods.map((m) => calmCard(w, m, needs)).join("")}</ol>` : `<ol class="mlc-list">${mods.map((m) => calmRow(w, m, probs)).join("")}</ol>`}</li>`;
  }).join("") || `<li class="mlc-empty">${ST.show === "changes" ? "Nothing queued for this world." : "No modules on."}</li>`;
}

/** The Backups tab shows the world's real backup count, or none. */
const backupCount = (w, tabs) => tabs.replace(/(Backups) <span class="c">\d+<\/span>/, (m0, h) => (backupsOf(w.id).length ? `${h} <span class="c">${backupsOf(w.id).length}</span>` : h));

function calmWorld(w, parts) {
  const banner = calmBanner(w);
  const tabs = backupCount(w, calmTabs(w, parts.tabs));
  if (ST.wtab === "about") return { banner, tabs, body: calmAbout(w) };
  if (ST.wtab === "backups") return { banner, tabs, body: calmBackups(w) };
  if (w.noCompanion) return { banner, tabs, body: companionMissing(w) };
  const body = ST.layout === "foundry"
    ? `<ol class="ml-sections scrollable mls-world-cards">${worldSections(w)}</ol>`
    : `<ol class="ml-sections scrollable mlc-sections">${calmSections(w)}</ol>`;
  return { banner, tabs, body };
}

function calmPop(p, x, y) {
  if (p.kind === "addmenu") return menu(x - 120, y, [[["fa-layer-group", "From a preset…", "presetpop"], ["fa-copy", "Copy from another world…", "copyfrom"]]]);
  if (p.kind === "viewpop") {
    const lay = (id, icon, l) => `<span class="${ST.layout === id ? "on" : ""}" data-act="layout" data-id="${id}"><i class="fa-solid ${icon}"></i> ${l}</span>`;
    return pop(x - 240, y, "View", `<div class="mlc-viewpop"><span class="ml-label">Group by</span>${groupSelect().replace(/<span class="ml-label">Group by<\/span>/, "")}
      <span class="ml-label">Layout</span><span class="ml-seg2">${lay("cards", "fa-grid-2", "Cards")}${lay("list", "fa-list", "List")}${lay("foundry", "fa-grid-horizontal", "Foundry's")}</span></div>`, 320);
  }
  return "";
}
A.addmenu = (_id, el) => { openPop("addmenu", el); render(); };
A.viewpop = (_id, el) => { openPop("viewpop", el); render(); };
A.layout = (id) => { ST.layout = id; ST.view = "tiles"; render(); };
A.calmrow = (id) => { ST.panel = ST.panel?.id === id ? null : { kind: "module", id }; ST.mtab = "library"; render(); };

// ---------- the same card everywhere: Library modules and systems ----------
const UPDATES = { "modular-av": "0.12.0", "modular-av-dock": "0.12.0" };
const foundryCard = card;
// eslint-disable-next-line no-func-assign
card = function (m, o = {}) { return CALM && ST.page === "library" && ST.layout !== "foundry" ? libCard(m, o) : foundryCard(m, o); };

function libWhy(m, isSystem) {
  if (isSystem) return { cls: m.used === "no world" ? "desc" : "", icon: "fa-globe", html: m.used === "no world" ? "In no world · safe to uninstall" : `Used by ${esc(m.used)}` };
  if (m.unverified) return { cls: "warn", icon: "fa-code-branch", html: "Not verified for Foundry 14" };
  if (NOTES[m.id]) return { cls: "note", icon: "fa-note-sticky", html: esc(NOTES[m.id]) };
  return { cls: "desc", icon: "", html: esc(m.shortDesc || m.description || "").replace(/<[^>]*>/g, "") };
}

function libCard(m, o = {}) {
  const isSystem = m.used !== undefined;
  const why = libWhy(m, isSystem);
  const upd = UPDATES[m.id] && !ST.lock.has(m.id) ? `<button type="button" class="mlw-upd" data-act="pkgupdate" data-id="${m.id}" data-tooltip="Update from ${m.version ?? "0.11.0"}"><i class="fa-solid fa-arrow-up"></i>${UPDATES[m.id]}</button>` : "";
  const icons = `${ST.fav.has(m.id) ? '<i class="fa-solid fa-star mlw-fav" data-tooltip="Favourite"></i>' : ""}${ST.lock.has(m.id) ? '<i class="fa-solid fa-lock mlw-lock" data-tooltip="Updates locked"></i>' : ""}`;
  const check = o.check ? `<input type="checkbox" class="mlw-check" tabindex="-1" ${o.selected ? "checked" : ""} aria-label="Select ${esc(m.title)}">` : "";
  const fresh = ST.fresh?.has(m.id) ? '<span class="mls-newtag">New</span>' : "";
  const tags = isSystem ? "" : tagsOf(m.id);
  const chips = tags ? tags.slice(0, 3).map((t) => `<span class="mlw-tag" style="--ml-c:${t.color}"><i class="ml-dot"></i>${esc(t.name)}</span>`).join("") + (tags.length > 3 ? `<span class="mlw-tag" data-tooltip="${esc(tags.slice(3).map((t) => t.name).join(", "))}">+${tags.length - 3}</span>` : "") : "";
  const n = isSystem ? 0 : WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, m.id)).length;
  const where = isSystem ? esc(m.author) : n ? `on in ${plural(n, "world")}` : '<span class="none">in no world</span>';
  const ver = `<span class="${m.unverified ? "uv" : ""}" data-tooltip="${m.unverified ? "Not verified for this Foundry version" : "Verified for Foundry 14"}">v${m.version ?? "0.11.0"}</span>`;
  const sel = o.selected ? (o.check ? " selected" : " viewing") : "";
  return `<li class="mlw-card mlw-lib${sel}${m.unverified ? " uvc" : ""}" data-package-id="${m.id}">
    <div class="l1">${check}<span class="t">${esc(m.title)}</span>${fresh}${icons}${upd}</div>
    <div class="l2 ${why.cls}">${why.icon ? `<i class="fa-solid ${why.icon}"></i>` : ""}<span>${why.html}</span></div>
    <div class="l3"><span class="tg">${chips}</span><span class="meta">${ver} · ${where}</span></div></li>`;
}

/** Library markup in the new cards: our grid instead of Foundry's package list, and a layout switch for view modes. */
function calmLibrary(html) {
  if (!CALM) return html;
  const lay = (id, icon, l) => `<button type="button" class="${ST.layout === id || (id === "cards" && ST.layout !== "foundry") ? "ml-on" : ""}" data-act="layout" data-id="${id}"><i class="fa-solid ${icon}"></i>${l}</button>`;
  const seg = `<div class="mlw-layout">${lay("cards", "fa-grid-2", "Cards")}${lay("foundry", "fa-grid-horizontal", "Foundry's")}</div>`;
  html = html.replace(/<span class="ml-count">(\d+)<\/span>/g, (m0, n) => `<span class="ml-count">${plural(Number(n), "module")}</span>`);
  if (ST.layout === "foundry") return html.replace(/<div class="view-modes">/, `${seg}<div class="view-modes">`);
  return html.replace(/<div class="view-modes">[\s\S]*?<\/div><\/header>/, `${seg}</header>`)
    .replace(/class="package-list \w+ ml-cards"/g, 'class="mlw-grid ml-cards"')
    .replace(/class="package-list \w+ scrollable" style="height:auto"/, 'class="mlw-grid scrollable mlw-sysgrid"');
}
A.pkgupdate = (id) => notify(`Mockup: this runs Foundry's own update for ${short(id)} (${UPDATES[id]}). It installs at once, as in Foundry today.`);

// ---------- header bar: a Foundry chip (version, update, news, help) and fewer, clearer buttons ----------
const NEXT_BUILD = "14.371";
const foundryTopBar = topBar;
// eslint-disable-next-line no-func-assign
topBar = function () { return CALM ? calmTopBar() : foundryTopBar(); };
function calmTopBar() {
  const open = ST.pop?.kind === "fmenu";
  const chip = `<button type="button" class="mlh-ver${open ? " ml-on" : ""}" data-act="fmenu" aria-expanded="${open}" aria-label="Foundry: version, update and help">
    <span class="v">Version 14 · 370</span><span class="upd"><i class="fa-solid fa-arrow-up"></i>update</span><i class="fa-solid fa-caret-down"></i></button>`;
  const btn = (act, what, icon, label) => `<button type="button" data-act="${act}" data-what="${what}"><i class="fa-solid ${icon}"></i>${label}</button>`;
  return `<header class="mls-top mlh"><span class="logo" aria-hidden="true"></span><h1>Foundry Virtual Tabletop</h1><span class="mlh-chipwrap">${chip}${newsCallout()}</span><span class="ml-spacer"></span>
    <div class="mlh-acts">${btn("foundry", "Backups", "fa-floppy-disks", "Backups")}${btn("foundry", "Configuration", "fa-gears", "Configuration")}
      <button type="button" class="icon${ST.pop?.kind === "pmenu" ? " ml-on" : ""}" data-act="pmenu" aria-label="Log out or shut down" data-tooltip="Log out or shut down"><i class="fa-solid fa-power-off"></i></button></div></header>`;
}
function foundryMenu(x, y) {
  const body = `<div class="mlh-fm">
    <section class="mlh-upd"><div><strong>Foundry 14 · build 370</strong><span class="ml-muted">Stable channel</span></div>
      <div class="avail"><i class="fa-solid fa-arrow-up"></i><span><b>${NEXT_BUILD}</b> is available</span><a data-act="foundry" data-what="Release notes for ${NEXT_BUILD}">Release notes</a>
      <button type="button" class="bright" data-act="foundry" data-what="Update Foundry">Update…</button></div></section>
    <h4>Help</h4><ul class="mls-pick">
      <li data-act="foundry" data-what="Support & Issues"><i class="fa-solid fa-life-ring"></i><span>Support &amp; issues</span><span class="ml-muted">1 module warning</span></li>
      <li data-act="foundry" data-what="Knowledge Base (opens foundryvtt.com)"><i class="fa-solid fa-book-open"></i><span>Knowledge base</span><span class="ml-muted"><i class="fa-solid fa-arrow-up-right-from-square"></i></span></li></ul></div>`;
  return pop(x, y, "Foundry Virtual Tabletop", body, 400);
}
const calmOverlayPop = calmPop;
// eslint-disable-next-line no-func-assign
calmPop = function (p, x, y) {
  if (p.kind === "fmenu") return foundryMenu(p.x, p.y);
  if (p.kind === "pmenu") return menu(p.x - 170, p.y, [[["fa-door-open", "Log out", "foundry", "Log Out"]], [["fa-power-off", "Shut down the server", "foundry", "Shut Down"]]]);
  return calmOverlayPop(p, x, y);
};
A.fmenu = (_id, el) => {
  if (ST.pop?.kind === "fmenu") { ST.pop = null; render(); return; }
  openPop("fmenu", el || document.querySelector(".mlh-ver"));
  render();
};
A.pmenu = (_id, el) => { openPop("pmenu", el); render(); };
const plainNewsAct = A.news;
A.news = (...a) => (CALM ? A.newsstep(1) : plainNewsAct(...a));

/** A world without the companion: we can't see its modules, so say so and show the one-time setup. */
function companionMissing(w) {
  return `<div class="mlw-empty"><i class="fa-solid fa-puzzle-piece"></i>
    <h3>Module Library isn't set up in ${esc(w.title)} yet</h3>
    <p>Until its companion module is on, we can't see or change this world's modules. It takes one launch:</p>
    <ol><li>Launch ${esc(w.title)}.</li><li>Open <b>Manage Modules</b>, turn on <b>Module Library</b> and save.</li><li>Come back here: its modules show up, ready to change.</li></ol>
    <button type="button" class="bright" data-act="launch"><i class="fa-solid fa-play"></i>Launch to set it up</button>
    <p class="ml-muted">Its About and Backups tabs work already.</p></div>`;
}

// A new article points at the chip it lives under, instead of a page-wide notification.
function newsCallout() {
  if (!ST.newsCallout || ST.newsSeen || ST.pop?.kind === "fmenu") return "";
  const n = NEWS_ITEMS.find((x) => x.isNew);
  return `<div class="mlh-callout" role="status"><img src="fvtt/news/${n.img}" alt="">
    <div class="nb" data-act="fmenu"><span class="k">New on foundryvtt.com</span><strong>${esc(n.title)}</strong></div>
    <a data-act="foundry" data-what="Open “${esc(n.title)}” on foundryvtt.com">Read</a>
    <button type="button" class="icon" data-act="newsdismiss" aria-label="Dismiss" data-tooltip="Dismiss"><i class="fa-solid fa-xmark"></i></button></div>`;
}
A.newsdismiss = () => { ST.newsCallout = false; render(); };
const plainShowNews = showNews;
// eslint-disable-next-line no-func-assign
showNews = function (which) {
  if (!CALM) return plainShowNews(which);
  // The news card at the foot of the worlds list shows "New"; nothing pops up.
};

// ---------- news: a quiet card at the foot of the worlds list ----------
const foundryRail = rail;
// eslint-disable-next-line no-func-assign
rail = function () { return CALM ? foundryRail().replace(/<\/aside>\s*$/, `${railNews()}</aside>`) : foundryRail(); };
/** Warm the cache for every banner once, so folding and unfolding never waits on an image. */
function preloadNews() {
  if (ST.newsPreloaded) return;
  ST.newsPreloaded = true;
  NEWS_ITEMS.forEach((x) => { const img = new Image(); img.decoding = "async"; img.src = `fvtt/news/${x.img}`; });
}
// Foundry's own two sections, under its own names: News, and Featured Content.
const newsSet = () => NEWS_ITEMS.filter((x) => !x.featured);
/** News is open while something is unread, folded otherwise; an explicit open or fold wins. */
const newsFolded = () => ST.newsFoldUser ?? !!ST.newsSeen;
function railNews() {
  preloadNews();
  const folded = newsFolded();
  const list = newsSet(), i = Math.min(ST.newsIdx ?? 0, list.length - 1), fresh = !ST.newsSeen;
  const latest = list[0];
  const head = `<header data-act="newsfold"><button type="button" class="icon" data-act="newsfold" aria-expanded="${!folded}" aria-label="${folded ? "Show" : "Hide"} news"><i class="fa-solid fa-chevron-${folded ? "right" : "down"}"></i></button>
    <span data-tooltip="From foundryvtt.com">News</span>${fresh ? '<span class="new">New</span>' : ""}${folded ? `<span class="latest">${esc(latest.title)}</span>` : ""}</header>`;
  const slide = (x, k) => `<a class="banner" data-act="newsopen" data-what="Open “${esc(x.title)}” on foundryvtt.com"${k === i ? "" : " inert"} aria-label="${esc(x.title)}"><img src="fvtt/news/${x.img}" alt="" decoding="async">
      <span class="cap"><strong>${esc(x.title)}</strong>${x.isNew && fresh ? '<span class="k new">New</span>' : ""}<i class="fa-solid fa-arrow-up-right-from-square"></i></span></a>`;
  const nav = list.length > 1 ? `<div class="navs"><button type="button" data-act="newsstep" data-id="-1" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="c" aria-live="polite">${i + 1} / ${list.length}</span><button type="button" data-act="newsstep" data-id="1" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button></div>` : "";
  const body = folded ? "" : `<div class="viewport"><div class="track" style="transform:translateX(-${i * 100}%)">${list.map(slide).join("")}</div>${nav}</div>`;
  const f = NEWS_ITEMS.find((x) => x.featured);
  const feat = f ? `<section class="mlr-feat" aria-label="Featured Content"><span class="lbl">Featured Content</span><a class="banner" data-act="newsopen" data-what="Open “${esc(f.title)}” on foundryvtt.com"><img src="fvtt/news/${f.img}" alt="" decoding="async">
      <span class="cap"><strong>${esc(f.title)}</strong><i class="fa-solid fa-arrow-up-right-from-square"></i></span></a></section>` : "";
  return `<section class="mlr-news${folded ? " folded" : ""}" aria-label="News from foundryvtt.com">${head}${body}</section>${feat}`;
}
function newsListPop(x, y) {
  const rows = NEWS_ITEMS.map((n) => `<li data-act="newsopen" data-what="Open “${esc(n.title)}” on foundryvtt.com"><img src="fvtt/news/${n.img}" alt=""><span>${esc(n.title)}</span>${n.featured ? '<span class="k">Featured</span>' : n.isNew && !ST.newsSeen ? '<span class="k new">New</span>' : ""}</li>`).join("");
  return pop(x, Math.max(80, y - 262), "News from foundryvtt.com", `<ul class="mlh-news">${rows}</ul>`, 360);
}
A.newsfold = () => { ST.newsFoldUser = !newsFolded(); render(); };
A.newsstep = (d) => {
  const n = newsSet().length;
  ST.newsIdx = ((ST.newsIdx ?? 0) + Number(d) + n) % n;
  const track = document.querySelector(".mlr-news .track");
  if (newsFolded() || !track) { ST.newsFoldUser = false; render(); return; }
  // Slide in place rather than re-rendering, so the transition runs.
  track.style.transform = `translateX(-${ST.newsIdx * 100}%)`;
  track.querySelectorAll(".banner").forEach((b, k) => { b.inert = k !== ST.newsIdx; });
  const c = document.querySelector(".mlr-news .navs .c");
  if (c) c.textContent = `${ST.newsIdx + 1} / ${n}`;
};


A.newsopen = (_id, el) => { ST.newsSeen = true; render(); notify(`Mockup: ${esc(el.dataset.what)}.`); };
const calmPop2 = calmPop;
// eslint-disable-next-line no-func-assign
calmPop = function (p, x, y) { return p.kind === "newslist" ? newsListPop(p.x, p.y) : calmPop2(p, x, y); };

// ---------- a world's About and Backups tabs ----------
const WORLD_INFO = {
  strahd: { next: "Tue 10 Nov, 19:00", nextRel: "in 4 days", core: "14.369", saved: "14.369", playtime: "61 hours" },
  mltest: { core: "14.369", saved: "14.370", playtime: "3 hours" },
  heist: { core: "13.351", saved: "13.351", playtime: "38 hours" },
  vaults: { core: "14.369", saved: "14.369", playtime: "22 hours" },
  oneshot: { core: "14.369", saved: "14.369", playtime: "4 hours" },
  avtest: { core: "14.369", saved: "14.369", playtime: "6 hours" },
};
const BACKUPS = {
  strahd: [
    { id: "s31", name: "Session 31", date: "3 Nov 2026", time: "23:12", rel: "3 days ago", core: "14.369", size: "441 MB" },
    { id: "s23", name: "", date: "2 Oct 2026", time: "03:00", rel: "5 weeks ago", core: "14.369", size: "430 MB", snapshot: true },
    { id: "v14", name: "Before V14 migration", date: "14 Mar 2026", time: "18:40", rel: "8 months ago", core: "13.351", size: "412 MB" },
  ],
  heist: [{ id: "h12", name: "Session 12", date: "2 Oct 2026", time: "23:55", rel: "5 weeks ago", core: "13.351", size: "509 MB" }],
  vaults: [
    { id: "a4", name: "Before floor 4", date: "16 Oct 2026", time: "17:20", rel: "3 weeks ago", core: "14.369", size: "1.2 GB" },
    { id: "a1", name: "Campaign start", date: "8 Feb 2026", time: "20:05", rel: "9 months ago", core: "14.369", size: "880 MB" },
  ],
  avtest: [{ id: "t1", name: "Clean test state", date: "1 Sep 2026", time: "11:30", rel: "2 months ago", core: "14.369", size: "52 MB" }],
};
const CORE_NOW = "14.370";
const backupsOf = (wid) => BACKUPS[wid] ?? [];

// Every field is edited here and saved with Foundry's own "editWorld" request (validated first, like its window does).
const JOIN_THEMES = { default: "Default", minimal: "Minimal" };
ST.safeMode = new Set();
const sysShort = (sys) => ({ dnd5e: "D&D 5e", pf2e: "Pathfinder 2e", swade: "SWADE" })[sys.id];
function fmtSession(v) {
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return null;
  const days = Math.round((new Date(d.toDateString()) - new Date("2026-11-06")) / 864e5);
  const when = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { next: when, nextRel: days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : `${-days} days ago`, iso: v };
}
/** A value with an Edit link, or, while editing, the input with Save and Cancel. */
function editable(field, view, input, { label = "Edit" } = {}) {
  if (ST.aboutEdit !== field) return `${view}`;
  const err = ST.aboutErr ? `<p class="err" role="alert"><i class="fa-solid fa-circle-exclamation"></i>${esc(ST.aboutErr)}</p>` : "";
  return `<div class="mlw-edit" data-field="${field}">${input}${err}<div class="bar"><button type="button" class="bright" data-act="asave" data-id="${field}">Save</button><button type="button" data-act="acancel">Cancel</button></div></div>`;
}
const savedMark = (field) => (ST.justSaved === field ? '<span class="mlw-saved" role="status"><i class="fa-solid fa-check"></i>Saved</span>' : "");
const editLink = (field, label = "Edit") => (ST.aboutEdit === field ? "" : ST.wlock.has(ST.world) ? "" : `${savedMark(field)}<a data-act="aedit" data-id="${field}">${label}</a>`);
function flashSaved(field) {
  ST.justSaved = field; render();
  clearTimeout(ST.savedTimer);
  ST.savedTimer = setTimeout(() => { if (ST.justSaved === field) { ST.justSaved = null; render(); } }, 2200);
}

function calmAbout(w) {
  const info = WORLD_INFO[w.id] ?? {};
  const old = info.saved && !info.saved.startsWith("14");
  const row = (k, v, link = "") => `<dt>${k}</dt><dd><span class="v">${v}</span>${link}</dd>`;
  const toolbar = `<div class="pm-bar" aria-hidden="true"><i class="fa-solid fa-bold"></i><i class="fa-solid fa-italic"></i><i class="fa-solid fa-list-ul"></i><i class="fa-solid fa-link"></i><i class="fa-solid fa-image"></i><span>Foundry's text editor</span></div>`;
  const desc = editable("desc", `<p class="desc">${esc(w.desc) || '<span class="ml-muted">No description yet.</span>'}</p>`,
    `${toolbar}<textarea id="mlw-input" rows="5">${esc(w.desc)}</textarea>`);
  const nextView = info.next
    ? `<div class="mlw-next"><i class="fa-solid fa-calendar-day"></i><div><strong>${esc(info.next)}</strong><span>${esc(info.nextRel)} · players see it on the join screen</span></div></div>`
    : `<div class="mlw-next none"><i class="fa-solid fa-calendar-plus"></i><div><span>No next session set. Players see it on the join screen.</span></div></div>`;
  const next = editable("next", nextView, `<input id="mlw-input" type="datetime-local" value="${info.iso ?? "2026-11-10T19:00"}">${info.next ? '<button type="button" class="mlw-clear" data-act="aclear" data-id="next">No next session</button>' : ""}`);
  const sysOpts = SYSTEMS.map((x) => `<option value="${x.id}"${w.sysFull.startsWith(x.title) ? " selected" : ""}>${esc(x.title)} ${x.version}</option>`).join("");
  const migrate = old
    ? `<li class="warn info"><div><strong>Migrates on the next launch</strong><span>Last saved with Foundry ${info.saved}. When it launches, Foundry asks before updating it to ${CORE_NOW} and offers a backup first. It can't be undone.</span></div><i class="fa-solid fa-circle-info"></i></li>`
    : `<li class="ok"><div><strong>Data</strong><span>Up to date for Foundry 14. Nothing to migrate.</span></div><i class="fa-solid fa-circle-check"></i></li>`;
  const reset = ST.aboutEdit === "reset"
    ? `<li class="confirm"><div><strong>Reset every player's password?</strong><span>They each set a new one the next time they join. You can't undo this.</span></div><button type="button" data-act="acancel">Cancel</button><button type="button" class="del" data-act="asave" data-id="reset">Reset passwords</button></li>`
    : `<li><div><strong>Reset user passwords</strong><span>Clears every player's password, so each sets a new one when they next join.</span></div>${ST.wlock.has(w.id) ? '<span class="mlw-tipwrap" data-tooltip="Locked: unlock it first"><button type="button" disabled>Reset…</button></span>' : '<button type="button" data-act="aedit" data-id="reset">Reset…</button>'}</li>`;
  const safe = ST.safeMode.has(w.id);
  return `<div class="mlw-about">
    <div class="col">
      <section class="mlw-box"><h4><span>Description</span>${editLink("desc")}</h4>${desc}</section>
      ${sessionBox(w)}
      <section class="mlw-box"><h4><span>Details</span></h4><dl>
        ${row("Title", editable("title", esc(w.title), `<input id="mlw-input" type="text" value="${esc(ST.aboutDraft ?? w.title)}">`), editLink("title", "Rename"))}
        ${row("Game system", editable("system", esc(w.sysFull), `<select id="mlw-input">${sysOpts}</select><p class="warnline"><i class="fa-solid fa-triangle-exclamation"></i>A world's data belongs to its system. Switching usually breaks actors and items; back it up first.</p>`), editLink("system", "Change"))}
        ${row("Join screen", editable("theme", JOIN_THEMES[w.joinTheme ?? "default"], `<select id="mlw-input">${Object.entries(JOIN_THEMES).map(([k, v]) => `<option value="${k}"${(w.joinTheme ?? "default") === k ? " selected" : ""}>${v}</option>`).join("")}</select>`), editLink("theme", "Change"))}
        ${row("Made for", info.core ? `Foundry ${info.core.split(".")[0]} · checked with build ${info.core.split(".")[1]}` : "unknown")}
        ${row("Last saved with", info.saved ? `Foundry ${info.saved}${old ? ' <span class="mlw-pill warn">older</span>' : ""}` : "unknown")}
        ${row("Played for", info.playtime ?? "unknown")}
        ${row("Size", backupsOf(w.id)[0] ? `about ${backupsOf(w.id)[0].size} <span class="ml-muted">at the last backup</span>` : '<span class="ml-muted">known after the first backup</span>')}
        ${row("Folder", `<code>worlds/${w.id}</code> <a class="cp" data-act="copypath" data-id="worlds/${w.id}" data-tooltip="Copy the path"><i class="fa-regular fa-copy"></i></a>`)}
        ${row("Last played", w.last)}</dl></section>
    </div>
    <div class="col">
      <section class="mlw-box"><h4><span>Background</span>${ST.wlock.has(w.id) ? "" : '<a data-act="abg">Change</a>'}</h4>
        <div class="mlw-bg" style="--img:url(${IMG[w.img]});background-position:${w.pos}"></div><p class="hint">Shown behind this page's title and on the screen players join from.</p></section>
      <section class="mlw-box"><h4><span>Maintenance</span></h4><ul class="mlw-acts">
        ${migrate}
        <li><div><strong>Safe mode for the next launch</strong><span>${safe ? "On: the next launch runs with every module off. It turns itself off afterwards." : "Runs the next launch with every module off, to find one that breaks the world."}</span></div>${ST.wlock.has(w.id) ? `<span class="mlw-tipwrap" data-tooltip="Locked: unlock it first"><input type="checkbox" class="mls-switch" disabled ${safe ? "checked" : ""} aria-label="Safe mode for the next launch (locked)"></span>` : `<input type="checkbox" class="mls-switch" data-act="asafe" ${safe ? "checked" : ""} aria-label="Safe mode for the next launch">`}</li>
        ${reset}
        <li><div><strong>Lock this world</strong><span>${ST.wlock.has(w.id) ? "Locked: Foundry won't launch, edit, update or delete it until you unlock it." : "Stops it being launched, edited, updated or deleted by mistake, for example a finished campaign."}</span></div><input type="checkbox" class="mls-switch" data-act="wlockt" ${ST.wlock.has(w.id) ? "checked" : ""} aria-label="Lock this world"></li></ul></section>
      <section class="mlw-box danger"><h4><span>Danger zone</span></h4><ul class="mlw-acts">
        <li><div><strong>Delete this world</strong><span>Removes the world folder for good${backupsOf(w.id).length ? "" : ", and it has no backups"}.</span></div>${ST.wlock.has(w.id) ? '<span class="mlw-tipwrap" data-tooltip="Locked: unlock it first, under Maintenance"><button type="button" class="del" disabled>Delete…</button></span>' : '<button type="button" class="del" data-act="foundry" data-what="Delete World (Foundry asks you to type a code)">Delete…</button>'}</li></ul></section>
      <p class="hint">Settings kept inside the world (module settings, users, permissions) change only in the world itself.</p>
    </div></div>`;
}

A.aedit = (field) => { ST.aboutEdit = field; ST.aboutErr = null; ST.aboutDraft = null; render(); const el = document.getElementById("mlw-input"); el?.focus(); if (el?.select && el.type === "text") el.select(); };
A.acancel = () => { ST.aboutEdit = null; ST.aboutErr = null; ST.aboutDraft = null; render(); };
A.aclear = () => { const info = WORLD_INFO[ST.world]; delete info.next; delete info.nextRel; delete info.iso; ST.aboutEdit = null; flashSaved("next"); };
A.asave = (field) => {
  const w = world(), info = WORLD_INFO[w.id] ?? (WORLD_INFO[w.id] = {});
  const v = document.getElementById("mlw-input")?.value ?? "";
  if (field === "title" && !v.trim()) { ST.aboutErr = "A world needs a title. Foundry's own check stops an empty one before anything is saved."; ST.aboutDraft = v; render(); document.getElementById("mlw-input")?.focus(); return; }
  if (field === "desc") w.desc = v.trim();
  if (field === "title") w.title = v.trim();
  if (field === "theme") w.joinTheme = v;
  if (field === "system") { const sys = SYSTEMS.find((x) => x.id === v); w.sysFull = `${sys.title} ${sys.version}`; w.system = sysShort(sys); }
  if (field === "next") { const f = fmtSession(v); if (f) Object.assign(info, f); }
  ST.aboutEdit = null; ST.aboutErr = null; ST.aboutDraft = null;
  if (field === "reset") { render(); notify(`Mockup: passwords reset for ${esc(w.title)}. Each player sets a new one when they next join.`); return; }
  flashSaved(field);
};
A.asafe = () => { const id = ST.world; ST.safeMode.has(id) ? ST.safeMode.delete(id) : ST.safeMode.add(id); render(); };
A.abg = () => notify("Mockup: Foundry's own file picker opens here (it works on the Setup page). Pick or upload an image and it's saved as the background.");

const toMB = (sz) => { const [v, u] = String(sz).split(" "); return Number(v) * (u === "GB" ? 1024 : 1); };
const fmtSize = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
/** What is queued for a world right now; a backup taken for exactly this queue satisfies the nudge. */
const queueSig = (wid) => JSON.stringify(diff(wid));
const backedUpForQueue = (wid) => !!diff(wid).length && ST.queueBackup?.[wid] === queueSig(wid);

function calmBackups(w) {
  const list = backupsOf(w.id);
  const n = w.noCompanion ? 0 : diff(w.id).length;
  const job = ST.backupJob?.wid === w.id ? ST.backupJob : null;
  const nudge = !n ? ""
    : backedUpForQueue(w.id)
      ? `<div class="mlw-nudge done"><i class="fa-solid fa-circle-check"></i><span>Backed up ${esc(list[0]?.rel ?? "just now")}, before these ${plural(n, "change")}. If they go wrong, restore <b>${esc(list[0]?.name || list[0]?.date)}</b>.</span></div>`
      : `<div class="mlw-nudge"><i class="fa-solid fa-shield-halved"></i><span><b>${plural(n, "change")}</b> wait for the next launch. A backup now lets you undo all of them at once. You can also tick "Back up first" when you launch.</span><button type="button" class="bright" data-act="backupnow"${job ? " disabled" : ""}>Back up now</button></div>`;
  const progress = job ? `<li class="busy" role="status"><i class="fa-solid fa-spinner fa-spin-pulse"></i><div class="nm"><strong>Backing up ${esc(w.title)}…</strong><span>Restore, Delete and Launch wait until it's done.</span></div>
      <div class="bar"><span style="width:${job.pct}%"></span></div><span class="sz">${job.pct}%</span></li>` : "";
  if (!list.length && !job) {
    return `${nudge}<div class="mlw-empty"><i class="fa-solid fa-floppy-disks"></i><h3>No backups of ${esc(w.title)} yet</h3>
      <p>A backup is a full copy of the world folder you can restore from Foundry. Take one before big changes or updates.</p>
      <button type="button" class="bright" data-act="backupnow"><i class="fa-solid fa-floppy-disk"></i>Take the first backup</button></div>`;
  }
  const lock = job ? " disabled" : "";
  const sel = ST.bSel?.wid === w.id ? ST.bSel.ids : null;
  const rows = list.map((b, k) => {
    const oldCore = !b.core.startsWith("14");
    const label = b.name || b.date;
    const del = b.snapshot
      ? `<span class="nodel mlw-tipwrap" data-tooltip="Part of a server snapshot: it's deleted with the snapshot, from Foundry's backups in the top bar"><button type="button" class="icon" disabled aria-label="Can't delete alone: part of a snapshot"><i class="fa-solid fa-trash"></i></button></span>`
      : `<button type="button" class="icon" data-act="foundry" data-what="Delete backup “${esc(label)}” (Foundry asks to confirm)" aria-label="Delete ${esc(label)}" data-tooltip="Delete"${lock}><i class="fa-solid fa-trash"></i></button>`;
    const pick = sel
      ? (b.snapshot ? `<span class="nodel mlw-tipwrap" data-tooltip="Part of a server snapshot: it's deleted with the snapshot"><input type="checkbox" disabled aria-label="Can't select: part of a snapshot"></span>`
        : `<input type="checkbox" data-act="bpick" data-id="${b.id}" ${sel.has(b.id) ? "checked" : ""} aria-label="Select ${esc(label)}">`)
      : `<i class="fa-solid ${b.snapshot ? "fa-camera" : "fa-floppy-disk"}"></i>`;
    return `<li class="${k === 0 ? "latest" : ""}${sel?.has(b.id) ? " picked" : ""}">${pick}
      <div class="nm"><strong>${esc(label)}</strong><span>${esc(b.date)}${b.time ? `, ${esc(b.time)}` : ""} · ${esc(b.rel)}${b.snapshot ? " · part of a snapshot" : ""}${k === 0 ? ' <span class="mlw-pill">latest</span>' : ""}</span></div>
      <span class="core${oldCore ? " warn" : ""}" data-tooltip="${oldCore ? "Foundry's badge: this copy is verified for an older Foundry; restoring it brings back that data, which Foundry migrates on the next launch" : "Foundry's badge: verified for this Foundry version"}"><i class="fa-solid fa-code-branch"></i> ${esc(b.core)}</span>
      <span class="sz">${esc(b.size)}</span>
      ${sel ? "<span></span><span></span>" : `${job ? '<span class="mlw-tipwrap" data-tooltip="Wait for the backup to finish">' : ""}<button type="button" data-act="foundry" data-what="Restore “${esc(label)}” (Foundry asks you to type a code, and offers a backup first)"${lock}>Restore…</button>${job ? "</span>" : ""}
      ${del}`}</li>`;
  }).join("");
  const total = list.reduce((t, b) => t + toMB(b.size), 0);
  const restoreNote = n ? ` Restoring keeps your ${plural(n, "queued change")}; they're checked again against the restored world, and any that no longer apply are dropped.` : "";
  return `<div class="mlw-backups">${nudge}
    ${sel ? `<div class="mlw-bhead sel"><i class="fa-solid fa-square-check"></i><span><b>${sel.size ? `${plural(sel.size, "backup")} selected` : "Select backups to delete"}</b>${sel.size ? ` · deleting frees ${fmtSize(list.filter((b) => sel.has(b.id)).reduce((t, b) => t + toMB(b.size), 0))}` : ""}</span>
        <button type="button" data-act="bpickall">All</button><span class="ml-spacer"></span>
        <button type="button" class="del" data-act="bdelete"${sel.size ? "" : " disabled"}><i class="fa-solid fa-trash"></i>Delete${sel.size ? ` ${sel.size}` : ""}…</button><button type="button" data-act="bselect">Done</button></div>`
      : `<div class="mlw-bhead"><span><b>${plural(list.length, "backup")}</b>${list[0] ? ` · latest ${esc(list[0].rel)}` : ""} · ${fmtSize(total)} in all</span><span class="ml-spacer"></span>
      ${list.filter((b) => !b.snapshot).length > 1 ? `<button type="button" data-act="bselect"${lock}><i class="fa-solid fa-square-check"></i>Select</button>` : ""}${nudge ? "" : `<button type="button" class="bright" data-act="backupnow"${lock}><i class="fa-solid fa-floppy-disk"></i>Take a backup</button>`}</div>`}
    <ol class="mlw-blist">${progress}${rows}</ol>
    <p class="hint">These are Foundry's own backups. Restore asks you to type a code and offers to back up the current world first; Delete asks to confirm.${restoreNote}</p></div>`;
}

/** Foundry reports backup progress through ui.setupPackages.onProgress; we draw it here (the mockup fakes the timing). */
function runBackup(wid, { note, then } = {}) {
  if (ST.backupJob) return;
  const w = world(wid), size = backupsOf(wid)[0]?.size ?? "about 400 MB";
  ST.backupJob = { wid, pct: 0 }; render();
  const tick = setInterval(() => {
    ST.backupJob.pct = Math.min(100, ST.backupJob.pct + 12);
    if (ST.backupJob.pct < 100) { render(); return; }
    clearInterval(tick);
    BACKUPS[wid] = [{ id: `n${Date.now()}`, name: note ?? (diff(wid).length ? "Before queued changes" : "Manual backup"), date: "6 Nov 2026", time: "12:04", rel: "just now", core: CORE_NOW, size }, ...backupsOf(wid)];
    if (diff(wid).length) ST.queueBackup = { ...(ST.queueBackup ?? {}), [wid]: queueSig(wid) };
    ST.backupJob = null; render();
    if (then) then(); else notify(`Backed up ${esc(w.title)}. In Foundry, its dialog first asks for an optional note.`);
  }, 220);
}
A.backupnow = () => runBackup(ST.world);
A.bselect = () => { ST.bSel = ST.bSel?.wid === ST.world ? null : { wid: ST.world, ids: new Set() }; render(); };
A.bpick = (id) => { const ids = ST.bSel.ids; ids.has(id) ? ids.delete(id) : ids.add(id); render(); };
A.bpickall = () => { const ok = backupsOf(ST.world).filter((b) => !b.snapshot).map((b) => b.id); const ids = ST.bSel.ids; const all = ok.every((id) => ids.has(id)); ok.forEach((id) => (all ? ids.delete(id) : ids.add(id))); render(); };
A.bdelete = () => {
  const ids = ST.bSel.ids, n = ids.size;
  BACKUPS[ST.world] = backupsOf(ST.world).filter((b) => !ids.has(b.id));
  ST.bSel = null; render();
  notify(`Mockup: Foundry asks once to confirm, then deletes ${plural(n, "backup")} (game.deleteBackups).`);
};
A.copypath = (path) => notify(`Copied <code>${esc(path)}</code>.`);

// ---------- Favourite and Lock: Foundry's own world settings, from its card menu ----------
// Favourite is Foundry's core.setupPackageFavorites setting; Lock is game.post({action: "lockPackage"}).
ST.wfav = new Set(["strahd"]);
ST.wlock = new Set();
A.wfav = () => { ST.wfav.has(ST.world) ? ST.wfav.delete(ST.world) : ST.wfav.add(ST.world); render(); };
A.wlockt = () => { ST.wlock.has(ST.world) ? ST.wlock.delete(ST.world) : ST.wlock.add(ST.world); ST.aboutEdit = null; render(); };
