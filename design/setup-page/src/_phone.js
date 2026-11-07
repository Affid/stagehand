// ---------- "?phone=1": the Setup page on a phone (Android app, phase 1; the owner chose "tabs") ----------
// The desktop page is rendered as usual, then rearranged: one screen at a time instead of three
// columns, a bottom tab bar (Worlds, Library, Backups, Configuration), a world's queued changes and
// Launch in a bar at the bottom of its page, details and menus in bottom sheets. From 700 px wide
// (a tablet held upright) the worlds list stays on the left, as on the desktop.
const PHONE = Q.has("phone");
// A tablet held upright; a phone on its side stays a phone (too short for the side-by-side layout).
const phWide = () => innerWidth >= 700 && innerHeight >= 600;
const PH = { screen: Q.get("screen") || "home", from: null };

if (PHONE) {
  document.body.classList.add("mlp");
  if (Q.get("page")) PH.screen = "page";
  const go = (name) => {
    const orig = A[name];
    A[name] = (...a) => { PH.from = name === "updpage" ? { page: ST.page, screen: PH.screen } : null; PH.screen = "page"; orig(...a); phScrollTop(); };
  };
  ["world", "library", "srvbackups", "srvconfig", "updpage"].forEach(go);
  A.phback = () => {
    if (ST.dialog) { ST.dialog = null; render(); return; }
    if (ST.pop) { ST.pop = null; render(); return; }
    if (ST.panel) { ST.panel = null; render(); return; }
    if (PH.from) { ST.page = PH.from.page; PH.screen = PH.from.screen; PH.from = null; render(); return; }
    PH.screen = "home"; ST.page = "world"; render(); phScrollTop();
  };
  A.phtab = (id) => {
    ST.pop = null; ST.panel = null; PH.from = null;
    if (id === "worlds") { ST.page = "world"; PH.screen = "home"; render(); phScrollTop(); return; }
    ({ library: A.library, backups: A.srvbackups, config: A.srvconfig })[id]();
  };
  /** The world's queued changes, as the desktop's banner line and Review/Discard did: a sheet. */
  A.phqueue = () => { ST.pop = null; ST.panel = { kind: "queue" }; render(); };
  A.phlibmenu = (_id, el) => { openPop("phlib", el); render(); };
  A.phview = (_id, el) => { openPop("phview", el); render(); };
  A.phgrid = (_id, el) => { openPop("phgrid", el); render(); };
  const launchBefore = A.launch;
  A.launch = (...a) => { if (ST.panel?.kind === "queue") ST.panel = null; launchBefore(...a); };
  const popBefore = calmPop;
  // eslint-disable-next-line no-func-assign
  calmPop = function (p, x, y) {
    if (p.kind === "phgrid") return pop(x, y, "View", `<div class="mlc-viewpop mlp-gridview"></div>`, 320);
    if (p.kind === "phview") return pop(x, y, "View", `<div class="mlc-viewpop">${groupSelect()}</div>`, 320);
    if (p.kind !== "phlib") return popBefore(p, x, y);
    const updates = Object.keys(UPDATES).filter((id) => !ST.lock.has(id)).length;
    return menu(x, y, [
      [["fa-square-check", "Select modules", "select"], ["fa-download", "Install a module…", "foundry", "Install Module"], ...(updates ? [["fa-cloud-arrow-down", `Update all · ${updates}`, "foundry", "Update All"]] : [])],
      [["fa-tags", "Tags…", "panel", "tags"], ["fa-layer-group", "Presets…", "panel", "presets"], ["fa-folder-plus", "New folder", "newfolder"]],
      [["fa-angles-up", "Collapse or expand all", "collapseall"], ["fa-file-export", "Import and export", "foundry", "Import and export"]],
    ]);
  };
  addEventListener("resize", () => render());
  // Android's Back button: in the mockup, Escape stands in for it.
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.target.closest?.("input, textarea, select")) { e.stopImmediatePropagation(); A.phback(); } }, true);
}

/** Which tab the current page belongs to. */
function phTab() {
  if (["library", "backups", "config"].includes(ST.page)) return ST.page;
  if (ST.page === "update" && PH.from) return ["library", "backups", "config"].includes(PH.from.page) ? PH.from.page : "worlds";
  return "worlds";
}

/** What the top bar says on a page. */
function phTitle() {
  if (ST.page === "world") return esc(world().title);
  return { library: "Library", backups: "Backups", config: "Configuration", update: "What's new" }[ST.page] ?? "";
}

function phVersionChip() {
  const upd = UPD_STATES[ST.upd.state];
  const open = ST.pop?.kind === "fmenu";
  return `<button type="button" class="mlp-ver${open ? " ml-on" : ""}" data-act="fmenu" aria-expanded="${open}" aria-label="Foundry ${ST.upd.installed}${upd ? ", an update is available" : ""}">
    <span>${ST.upd.installed.replace(".", " · ")}</span>${upd ? '<i class="fa-solid fa-arrow-up"></i>' : ""}</button>`;
}

/** The top bar: logo, title, the version chip and ⏻ on Worlds; a tab's name on its page; Back on a world or What's new. */
function phTopBar() {
  const home = phWide() || (ST.page === "world" && PH.screen === "home");
  const tabRoot = !home && ["library", "backups", "config"].includes(ST.page) && !PH.from;
  const left = home || tabRoot
    ? `<span class="logo" aria-hidden="true"></span><h1>${home ? "Foundry VTT" : phTitle()}</h1>`
    : `<button type="button" class="mlp-back" data-act="phback" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button><h1 class="pt">${phTitle()}</h1>`;
  const right = home ? `${phVersionChip()}<button type="button" class="icon mlp-menu${ST.pop?.kind === "pmenu" ? " ml-on" : ""}" data-act="pmenu" aria-label="Log out or shut down"><i class="fa-solid fa-power-off"></i></button>` : "";
  return `<header class="mlp-top">${left}<span class="ml-spacer"></span>${right}</header>`;
}

/** Launch at the bottom of a world's page, where a thumb reaches it, with what will change. */
function phActionBar() {
  if (ST.page !== "world" || (PH.screen !== "page" && !phWide())) return "";
  const w = world();
  const n = w.noCompanion ? 0 : diff(w.id).length, probs = w.noCompanion ? [] : problems(w.id);
  const blocked = ST.wlock.has(w.id) || ST.backupJob?.wid === w.id || ST.serverJob || ST.upd?.job;
  const what = n || probs.length
    ? `<button type="button" class="mlp-what${probs.length ? " warn" : ""}" data-act="phqueue" aria-haspopup="dialog"><strong>${n ? plural(n, "change") : "No changes"}${probs.length ? ` · ${plural(probs.length, "problem")}` : ""}</strong><span>See or undo <i class="fa-solid fa-chevron-up"></i></span></button>`
    : `<span class="mlp-what"><strong>${w.noCompanion ? "Modules unknown" : "No changes"}</strong><span>${w.noCompanion ? "Set up on the first launch" : `${onCount(w.id, baseOn)} modules on`}</span></span>`;
  const launch = `<button type="button" class="bright mlp-launch" data-act="launch"${blocked ? " disabled" : ""}><i class="fa-solid fa-play"></i>Launch${n ? `<span class="mlc-badge" aria-label="${plural(n, "change")} to review">${n}</span>` : ""}</button>`;
  return `<div class="mlp-actbar">${what}${launch}</div>`;
}

function phTabBar() {
  const on = phTab();
  const t = (id, icon, label, badge = "") => `<button type="button" class="${on === id ? "on" : ""}" data-act="phtab" data-id="${id}" aria-current="${on === id ? "page" : "false"}"><i class="fa-solid ${icon}"></i><span>${label}</span>${badge}</button>`;
  const queued = WORLDS_X.filter((w) => !w.noCompanion && diff(w.id).length).length;
  return `<nav class="mlp-tabs" aria-label="Sections">${t("worlds", "fa-globe", "Worlds", queued ? `<b class="pip" aria-label="${plural(queued, "world")} with changes">${queued}</b>` : "")}${t("library", "fa-books", "Library", ST.fresh.size ? `<b class="pip" aria-label="${ST.fresh.size} new">${ST.fresh.size}</b>` : "")}${t("backups", "fa-floppy-disks", "Backups")}${t("config", "fa-gears", "Configuration")}</nav>`;
}

/** The queued-changes sheet: the desktop's "Next launch" panel, with its wording brought up to date. */
function phQueueSheet() {
  const w = world();
  const html = worldPanel(w);
  const box = Object.assign(document.createElement("div"), { innerHTML: html }).firstElementChild;
  const n = diff(w.id).length;
  box.querySelector(".lead").textContent = n ? `These ${plural(n, "change")} apply when ${w.title} next launches. Launch shows them once more before anything changes.` : `Nothing queued for ${w.title}.`;
  [...box.querySelectorAll(".mls-chg")].find((c) => c.querySelector("h4")?.textContent.trim() === "World")?.remove();
  box.querySelector("h2.divider").textContent = "Next launch";
  return box.outerHTML;
}

/** A sheet's bar: a handle to drag it down, its name and Close. */
function phPanelBar(panel) {
  const title = panel.querySelector("h2.divider")?.textContent ?? "";
  panel.insertAdjacentHTML("afterbegin", `<div class="mlp-sheetbar"><span class="grab" aria-hidden="true"></span><strong>${esc(title)}</strong><button type="button" class="icon" data-act="closepanel" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>`);
}

/** Drag a sheet down by its bar to close it, as on Android. */
function phSheetDrag(panel) {
  const bar = panel.querySelector(".mlp-sheetbar");
  if (!bar || phWide()) return;
  let y0 = null;
  bar.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; y0 = e.clientY; bar.setPointerCapture(e.pointerId); panel.style.transition = "none"; });
  bar.addEventListener("pointermove", (e) => { if (y0 !== null) panel.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  bar.addEventListener("pointerup", (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0; y0 = null; panel.style.transition = "";
    if (dy > 110) A.closepanel(); else panel.style.transform = "";
  });
}

/** Library: one row (filter, Group by, ⋮) instead of four; a short "new modules" line; selecting works from a bar above the tabs. */
function phLibrary() {
  if (ST.page !== "library") return;
  const head = document.querySelector(".mls-main header.controls");
  if (head && ST.lsub !== "grid") {
    head.querySelectorAll("button").forEach((el) => el.remove());
    const sys = ST.lsub === "systems";
    head.insertAdjacentHTML("beforeend", sys
      ? `<button type="button" class="icon mlp-iconbtn" data-act="foundry" data-id="Install System" aria-label="Install a system"><i class="fa-solid fa-plus"></i></button>`
      : `<button type="button" class="icon mlp-iconbtn${ST.pop?.kind === "phview" ? " ml-on" : ""}" data-act="phview" aria-label="Group by: ${esc(GROUPS[ST.group])}"><i class="fa-solid fa-sliders"></i></button>
         <button type="button" class="icon mlp-iconbtn mlp-more${ST.pop?.kind === "phlib" ? " ml-on" : ""}" data-act="phlibmenu" aria-label="Select, install, update, tags, presets, folders"><i class="fa-solid fa-ellipsis-vertical"></i></button>`);
    head.classList.add("mlp-libhead");
  }
  // By world: the filter and one View button; Group by and Show move into the View sheet.
  const grow = ST.lsub === "grid" && document.querySelector(".mls-main .ml-row");
  if (grow) {
    const search = grow.querySelector("input[type=search]"), view = document.querySelector(".mlp-gridview");
    const showing = grow.querySelector(".mls-showing");
    [...grow.children].filter((el) => el !== search && !(el === showing && showing.querySelector("a"))).forEach((el) => (view && !el.matches(".ml-spacer, .ml-muted") ? view.append(el) : el.remove()));
    grow.classList.add("mlp-gridrow");
    grow.insertAdjacentHTML("beforeend", `<button type="button" class="icon mlp-iconbtn${view ? " ml-on" : ""}" data-act="phgrid" aria-label="Group by and which worlds to show"><i class="fa-solid fa-sliders"></i></button>`);
  }
  const band = document.querySelector(".mls-main .mls-intake-band");
  if (band) band.innerHTML = `<i class="fa-solid fa-box-open"></i><span><b>${plural(ST.fresh.size, "new module")}</b> to sort</span><button type="button" class="bright" data-act="intake">Sort</button><button type="button" class="icon" data-act="intakelater" aria-label="Later: leave them in Unfiled"><i class="fa-solid fa-xmark"></i></button>`;
  const row = document.querySelector(".mls-main .ml-row:not(.mls-selbar)");
  if (row && ST.lsub === "modules") row.remove();
  const sel = document.querySelector(".mls-main .mls-selbar");
  sel?.querySelector('[data-act="bulk"][data-id="world"]')?.lastChild?.replaceWith("In a world…");
  if (sel) { const bar = Object.assign(document.createElement("div"), { className: "mlp-actbar mlp-selbar" }); bar.append(sel); document.querySelector(".mlp-tabs")?.before(bar); }
}

const phScrollers = () => [...document.querySelectorAll(".mls-rail, .mls-main, .mls-panel .scroll")];
function phScrollTop() { phScrollers().forEach((el) => { el.scrollTop = 0; }); }

if (PHONE) {
  const renderDesktop = render;
  // eslint-disable-next-line no-func-assign
  render = function () {
    const keep = phScrollers().map((el) => [el.className.split(" ").find((c) => c.startsWith("mls-")), el.scrollTop]);
    renderDesktop();
    const b = document.body;
    b.classList.toggle("mlp-wide", phWide());
    b.dataset.screen = phWide() ? "page" : PH.screen;
    b.dataset.page = ST.page;
    document.querySelector("header.mls-top")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: phTopBar() }).firstElementChild);
    document.getElementById("setup")?.insertAdjacentHTML("afterend", phActionBar() + phTabBar());
    if (ST.panel?.kind === "queue" && ST.page === "world") document.querySelector(".mls-main")?.insertAdjacentHTML("afterend", phQueueSheet());
    const panel = document.querySelector(".mls-panel");
    if (panel) { phPanelBar(panel); phSheetDrag(panel); panel.insertAdjacentHTML("beforebegin", `<div class="mlp-scrim" data-act="closepanel"></div>`); }
    if (ST.pop || document.querySelector("#context-menu.mls-menu-live")) b.insertAdjacentHTML("beforeend", `<div class="mlp-scrim pop" data-act="closepop"></div>`);
    phLibrary();
    // Configuration's "not saved" and "apply after a restart" bars sit above the tabs, where Save stays in reach.
    const cfgBar = ST.page === "config" && document.querySelector(".mls-main .mlc-pending, .mls-main .mlc-waiting");
    if (cfgBar) { const wrap = Object.assign(document.createElement("div"), { className: "mlp-actbar mlp-cfgbar" }); wrap.append(cfgBar); document.querySelector(".mlp-tabs")?.before(wrap); }
    keep.forEach(([cls, top]) => { const el = cls && document.querySelector(`.${cls}`); if (el && phScrollers().includes(el)) el.scrollTop = top; });
    // Only the tab row stays pinned while the page scrolls; the filter row scrolls away under it.
    const tools = document.querySelector(".mls-subtabs .mlc-tools");
    if (tools) tools.parentElement.after(tools);
    // "14 after launch" is too long for a phone's tab row: "11 → 14" says the same.
    const count = ST.page === "world" && document.querySelector('.mls-subtabs [data-id="modules"] .c');
    if (count && /after launch/.test(count.textContent)) count.textContent = `${onCount(ST.world, baseOn)} → ${onCount(ST.world)}`;
    // On a world's page the top bar lies over the banner and turns solid, with the name, once it scrolls away.
    const main = document.querySelector(".mls-main"), banner = main?.querySelector(".mls-banner");
    const scrolled = () => b.classList.toggle("mlp-scrolled", !!banner && main.scrollTop > banner.offsetHeight - 64);
    if (main) { scrolled(); main.addEventListener("scroll", scrolled, { passive: true }); }
  };
}
