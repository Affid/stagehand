// ---------- "?phone=a|b": the Setup page on a phone (Android app, phase 1) ----------
// The desktop page is rendered as usual, then rearranged: one screen at a time instead of three
// columns. Variant A ("stack"): the worlds list is home, everything else opens over it with a Back
// arrow, server pages sit in a menu, Launch is in the top bar, details open full screen.
// Variant B ("tabs"): a bottom tab bar (Worlds, Library, Backups, Configuration), Launch in a bar
// at the bottom of a world's page, details in a bottom sheet. From 700 px wide (a tablet held
// upright) both keep the worlds list on the left, as the desktop does.
const PHONE = ["a", "b"].includes(Q.get("phone")) ? Q.get("phone") : null;
const phWide = () => innerWidth >= 700;
const PH = { screen: Q.get("screen") || "home", from: null };

if (PHONE) {
  document.body.classList.add("mlp", `mlp-${PHONE}`);
  if (Q.get("page")) PH.screen = "page";
  const go = (name, screen) => {
    const orig = A[name];
    A[name] = (...a) => { PH.from = name === "updpage" ? { page: ST.page, screen: PH.screen } : null; PH.screen = screen; orig(...a); phScrollTop(); };
  };
  go("world", "page"); go("library", "page"); go("srvbackups", "page"); go("srvconfig", "page"); go("updpage", "page");
  A.phback = () => {
    if (ST.dialog) { ST.dialog = null; render(); return; }
    if (ST.pop) { ST.pop = null; render(); return; }
    if (ST.panel) { ST.panel = null; render(); return; }
    if (PH.from) { ST.page = PH.from.page; PH.screen = PH.from.screen; PH.from = null; render(); return; }
    PH.screen = "home"; ST.page = "world"; render(); phScrollTop();
  };
  A.phmenu = (_id, el) => { openPop("phmenu", el); render(); };
  A.phtab = (id) => {
    ST.pop = null; ST.panel = null; PH.from = null;
    if (id === "worlds") { ST.page = "world"; PH.screen = "home"; render(); phScrollTop(); return; }
    ({ library: A.library, backups: A.srvbackups, config: A.srvconfig })[id]();
  };
  const popBefore = calmPop;
  // eslint-disable-next-line no-func-assign
  calmPop = function (p, x, y) {
    if (p.kind !== "phmenu") return popBefore(p, x, y);
    const upd = UPD_STATES[ST.upd.state];
    return menu(x, y, [
      [["fa-floppy-disks", "Backups", "srvbackups"], ["fa-gears", "Configuration", "srvconfig"]],
      [["fa-arrow-up", upd ? `Update to ${upd.version}…` : "Update page", "updpage"], ["fa-life-ring", "Support & issues", "foundry", "Support & Issues"]],
      [["fa-door-open", "Log out", "foundry", "Log Out"], ["fa-power-off", "Shut down the server", "foundry", "Shut Down"]],
    ]);
  };
  addEventListener("resize", () => render());
}

/** Which tab of variant B the current page belongs to. */
function phTab() {
  if (ST.page === "library") return "library";
  if (ST.page === "backups") return "backups";
  if (ST.page === "config") return "config";
  if (ST.page === "update" && PH.from) return { library: "library", backups: "backups", config: "config" }[PH.from.page] ?? "worlds";
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

function phLaunchButton(compact) {
  const w = world();
  const n = w.noCompanion ? 0 : diff(w.id).length;
  const blocked = ST.wlock.has(w.id) || ST.backupJob?.wid === w.id || ST.serverJob || ST.upd?.job;
  return `<button type="button" class="bright mlp-launch${compact ? " compact" : ""}" data-act="launch"${blocked ? " disabled" : ""}><i class="fa-solid fa-play"></i>Launch${n ? `<span class="mlc-badge" aria-label="${plural(n, "change")} to review">${n}</span>` : ""}</button>`;
}

/** The top bar: logo and title at home, Back and the page's name elsewhere. */
function phTopBar() {
  const home = PH.screen === "home" && !phWide();
  const tabRoot = PHONE === "b" && ["library", "backups", "config"].includes(ST.page) && !PH.from;
  const left = home || phWide() || tabRoot
    ? `<span class="logo" aria-hidden="true"></span><h1>${home || phWide() ? "Foundry VTT" : phTitle()}</h1>`
    : `<button type="button" class="mlp-back" data-act="phback" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button><h1 class="pt">${phTitle()}</h1>`;
  const onWorld = ST.page === "world" && (PH.screen === "page" || phWide());
  let right = "";
  if (PHONE === "a") {
    right = `${home || phWide() ? phVersionChip() : ""}${onWorld && !phWide() ? phLaunchButton(true) : ""}
      <button type="button" class="icon mlp-menu${ST.pop?.kind === "phmenu" ? " ml-on" : ""}" data-act="phmenu" aria-label="Server menu"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
  } else {
    right = `${home || phWide() || tabRoot ? phVersionChip() : ""}${home || phWide() ? `<button type="button" class="icon mlp-menu${ST.pop?.kind === "pmenu" ? " ml-on" : ""}" data-act="pmenu" aria-label="Log out or shut down"><i class="fa-solid fa-power-off"></i></button>` : ""}`;
  }
  return `<header class="mlp-top">${left}<span class="ml-spacer"></span>${right}</header>`;
}

/** Variant B: Launch at the bottom of a world's page, where a thumb reaches it. */
function phActionBar() {
  if (PHONE !== "b" || ST.page !== "world" || (PH.screen !== "page" && !phWide())) return "";
  const w = world();
  const n = w.noCompanion ? 0 : diff(w.id).length, probs = w.noCompanion ? [] : problems(w.id);
  const what = n || probs.length
    ? `<a class="mlp-what${probs.length ? " warn" : ""}" data-act="launch"><strong>${n ? plural(n, "change") : "No changes"}</strong><span>${probs.length ? plural(probs.length, "problem") : "Review at launch"}</span></a>`
    : `<span class="mlp-what"><strong>No changes</strong><span>${onCount(w.id, baseOn)} modules on</span></span>`;
  return `<div class="mlp-actbar">${what}${phLaunchButton(false)}</div>`;
}

function phTabBar() {
  if (PHONE !== "b") return "";
  const on = phTab();
  const t = (id, icon, label, badge = "") => `<button type="button" class="${on === id ? "on" : ""}" data-act="phtab" data-id="${id}" aria-current="${on === id ? "page" : "false"}"><i class="fa-solid ${icon}"></i><span>${label}</span>${badge}</button>`;
  const queued = WORLDS_X.filter((w) => !w.noCompanion && diff(w.id).length).length;
  return `<nav class="mlp-tabs" aria-label="Sections">${t("worlds", "fa-globe", "Worlds", queued ? `<b class="pip">${queued}</b>` : "")}${t("library", "fa-books", "Library", ST.fresh.size ? `<b class="pip">${ST.fresh.size}</b>` : "")}${t("backups", "fa-floppy-disks", "Backups")}${t("config", "fa-gears", "Configuration")}</nav>`;
}

/** The details panel's own bar: Back (full screen) or a handle and Close (bottom sheet). */
function phPanelBar(panel) {
  const title = panel.querySelector("h2.divider")?.textContent ?? "";
  const sheet = PHONE === "b" || phWide();
  const html = sheet
    ? `<div class="mlp-sheetbar"><span class="grab" aria-hidden="true"></span><strong>${esc(title)}</strong><button type="button" class="icon" data-act="closepanel" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>`
    : `<div class="mlp-sheetbar full"><button type="button" class="mlp-back" data-act="closepanel" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button><strong>${esc(title)}</strong></div>`;
  panel.insertAdjacentHTML("afterbegin", html);
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
    b.classList.toggle("mlp-sheet-open", !!document.querySelector(".mls-panel"));
    document.querySelector("header.mls-top")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: phTopBar() }).firstElementChild);
    document.getElementById("setup")?.insertAdjacentHTML("afterend", phActionBar() + phTabBar());
    const panel = document.querySelector(".mls-panel");
    if (panel) { phPanelBar(panel); panel.insertAdjacentHTML("beforebegin", `<div class="mlp-scrim" data-act="closepanel"></div>`); }
    if (ST.pop || document.querySelector("#context-menu.mls-menu-live")) b.insertAdjacentHTML("beforeend", `<div class="mlp-scrim pop" data-act="closepop"></div>`);
    keep.forEach(([cls, top]) => { const el = cls && document.querySelector(`.${cls}`); if (el && phScrollers().includes(el)) el.scrollTop = top; });
    // Only the tab row stays pinned while the page scrolls; the filter row scrolls away under it.
    const tools = document.querySelector(".mls-subtabs .mlc-tools");
    if (tools) tools.parentElement.after(tools);
    // "14 after launch" is too long for a phone's tab row: "11 → 14" says the same next to the banner's line.
    const count = ST.page === "world" && document.querySelector('.mls-subtabs [data-id="modules"] .c');
    if (count && /after launch/.test(count.textContent)) count.textContent = `${onCount(ST.world, baseOn)} → ${onCount(ST.world)}`;
    const main = document.querySelector(".mls-main"), banner = main?.querySelector(".mls-banner");
    const scrolled = () => b.classList.toggle("mlp-scrolled", !!banner && main.scrollTop > banner.offsetHeight - 40);
    if (main) { scrolled(); main.addEventListener("scroll", scrolled, { passive: true }); }
  };
}
