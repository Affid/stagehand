
// ---------- Update: release notes and the update itself, in place of Foundry's /update page ----------
// Foundry's flow: check for an update on a channel (game.post({action: "updateCheck"})), show the release
// notes (ReleaseData.notes, HTML from foundryvtt.com), optionally preview compatibility and take a snapshot,
// then download (Downloading, Extracting, Cleaning, Installing). A server then exits "for manual restart";
// the desktop app relaunches itself. Releases flagged requires_full_reinstall (or a new generation) can't
// be installed from Setup; --noupdate disables updating.
// The notes below are a made-up sample with the structure of Foundry's real notes (14.370 had 107 entries).

const UPD_STATES = {
  available: { version: "14.371", label: "Version 14 Stable 13", date: "5 November 2026", gen: 14 },
  manual: { version: "15.301", label: "Version 15 Stable 1", date: "4 November 2026", gen: 15, manual: "Version 15 is a new generation. It can't be installed from here: download it from your foundryvtt.com account and install it beside your current version." },
  disabled: { version: "14.371", label: "Version 14 Stable 13", date: "5 November 2026", gen: 14, disabled: true },
  none: null,
};
const CHANNELS = {
  stable: ["Stable", "Carefully tested; recommended for live games."],
  testing: ["Testing", "New features for the community to test. Expect bugs."],
  development: ["Development", "API changes for module and system developers to try. Not for games."],
};
const I = (t, n) => ({ t, n });
const UPD_NOTES = [
  { h: "Breaking Changes", kind: "breaking", items: [I("TokenDocument#getBarAttribute now returns null instead of undefined when the attribute is missing.", 15012)] },
  { h: "New Features", kind: "user", sub: [
    { h: "Applications and User Interface", items: [I("The Combat Tracker can be undocked into its own window.", 14988), I("Added a search field to the Playlist directory.", 14971), I("Scene thumbnails regenerate in the background after the scene is saved.", 15003)] },
    { h: "The Game Canvas", items: [I("Region behaviours can now fire when a token stops moving inside the region.", 14959), I("Added a measured-distance label to ruler waypoints.", 14977)] },
  ] },
  { h: "API Improvements", kind: "dev", sub: [
    { h: "Documents and Data", items: [I("Added the preCreateRegionBehavior hook.", 14990), I("DataModel#updateSource now accepts a recursive option for nested arrays.", 15007)] },
    { h: "Applications and User Interface", items: [I("ApplicationV2#bringToFront returns the application, so calls can be chained.", 14995), I("Added HandlebarsApplicationMixin#refreshPart for re-rendering one part without its context.", 15016)] },
  ] },
  { h: "Bug Fixes", kind: "mixed", sub: [
    { h: "Applications and User Interface", items: [I("Fixed the Setup page losing its scroll position after installing a package.", 14980), I("Fixed tooltips staying visible after a window closed.", 14984), I("Fixed the Journal sheet's page list jumping when a page was renamed.", 14999)] },
    { h: "The Game Canvas", items: [I("Fixed vision flickering when a token moved between levels.", 14966), I("Fixed walls drawn with snapping off occasionally snapping on release.", 14970)] },
    { h: "Package Development", kind: "dev", items: [I("Fixed hot reload not picking up changed language files in modules.", 14963), I("Fixed module styles loading twice when a module was enabled and disabled in one session.", 15010)] },
    { h: "Dice and Cards", items: [I("Fixed dice roll messages not respecting the roll mode chosen in chat.", 14987)] },
  ] },
  { h: "Documentation Improvements", kind: "dev", items: [I("Documented the RegionBehaviorType event list.", 14992)] },
];
ST.upd = { state: "available", channel: "stable", open: new Set(["Breaking Changes", "New Features", "Bug Fixes"]), q: "", devNotes: true, snapFirst: true, force: false, job: null, done: false, installed: "14.370" };

const JUMP_LABEL = {
  "Breaking Changes": ["breaking change", "breaking changes"], "New Features": ["new feature", "new features"],
  "API Improvements": ["API improvement", "API improvements"], "Bug Fixes": ["bug fix", "bug fixes"],
  "Documentation Improvements": ["documentation change", "documentation changes"],
};
const isDevSection = (s, parent) => (s.kind ?? parent?.kind) === "dev";
function updItems(sec, parent) {
  const q = ST.upd.q.trim().toLowerCase();
  if (!ST.upd.devNotes && isDevSection(sec, parent)) return [];
  return (sec.items ?? []).filter((i) => !q || i.t.toLowerCase().includes(q) || String(i.n).includes(q));
}
const secCount = (s) => (s.items ? updItems(s) : (s.sub ?? []).flatMap((x) => updItems(x, s))).length;
const issue = (n) => `<a class="mlu-issue" data-act="foundry" data-what="Open issue #${n} on GitHub" data-tooltip="Issue #${n} on GitHub">#${n}</a>`;
const itemList = (items) => `<ul>${items.map((i) => `<li>${esc(i.t)} ${issue(i.n)}</li>`).join("")}</ul>`;

function updNotes(rel) {
  const sections = UPD_NOTES.filter((s) => ST.upd.devNotes || s.kind !== "dev");
  const jump = sections.map((s) => { const n = secCount(s); return n ? `<a data-act="updjump" data-id="${esc(s.h)}" class="${s.kind === "breaking" ? "brk" : ""}"><b>${n}</b> ${esc(JUMP_LABEL[s.h][n === 1 ? 0 : 1])}</a>` : ""; }).join("");
  const body = sections.map((s) => {
    const n = secCount(s);
    if (!n) return "";
    const open = ST.upd.open.has(s.h) || !!ST.upd.q.trim();
    const inner = !open ? "" : s.items ? itemList(updItems(s)) : (s.sub ?? []).map((x) => { const it = updItems(x, s); return it.length ? `<h4>${esc(x.h)}${isDevSection(x, s) && s.kind !== "dev" ? ' <span class="mlw-pill">developers</span>' : ""}</h4>${itemList(it)}` : ""; }).join("");
    return `<section class="mlu-sec ${s.kind}" id="upd-${esc(s.h).replace(/\W+/g, "-")}"><h3 data-act="updsec" data-id="${esc(s.h)}" aria-expanded="${open}"><i class="fa-solid fa-chevron-${open ? "down" : "right"}"></i>${s.kind === "breaking" ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ""}${esc(s.h)} <span class="c">${n}</span>${s.kind === "dev" ? ' <span class="mlw-pill">developers</span>' : ""}</h3>${inner}</section>`;
  }).join("") || '<p class="ml-muted">Nothing matches.</p>';
  return `<div class="mlu-notes"><div class="mlu-nhead"><div><h3>Release notes: ${esc(rel.label)}</h3><span>Foundry ${esc(rel.version)} · ${esc(rel.date)} · <a data-act="foundry" data-what="Open the full list of release notes on foundryvtt.com">All release notes</a></span></div></div>
    <div class="mlu-tools"><input type="search" data-filter="updq" value="${esc(ST.upd.q)}" placeholder="Search the notes" aria-label="Search the notes">
      <label><input type="checkbox" data-act="upddev" ${ST.upd.devNotes ? "checked" : ""}>Developer notes</label><span class="ml-spacer"></span><a data-act="updall">${ST.upd.open.size >= UPD_NOTES.length ? "Collapse all" : "Expand all"}</a></div>
    <nav class="mlu-jump">${jump}</nav><div class="mlu-body">${body}</div></div>`;
}

/** Your packages against the new version: Foundry's compatibility preview plus which of your worlds use them. */
function updCompat(rel) {
  const newGen = rel.gen > 14;
  const mods = ALL_MODULES.map((m) => ({ m, st: newGen ? (["module-library"].includes(m.id) ? "ok" : m.unverified ? "bad" : "unv") : m.unverified ? "unv" : "ok" }));
  const syss = SYSTEMS.map((s) => ({ s, st: newGen ? (s.id === "dnd5e" ? "ok" : "unv") : s.unverified ? "unv" : "ok" }));
  const cnt = (list, st) => list.filter((x) => x.st === st).length;
  const usedIn = (id) => WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, id));
  // Incompatible first, then the ones your worlds use most.
  const rank = (x) => (x.st === "bad" ? 1000 : 0) + usedIn(x.m.id).length;
  const flagged = mods.filter((x) => x.st !== "ok").sort((a, b) => rank(b) - rank(a)).slice(0, 6).map(({ m, st }) => {
    const ws = usedIn(m.id);
    return `<li class="${st}"><span class="t" data-act="updmod" data-id="${m.id}">${esc(m.title)}</span><span class="w">${ws.length ? `on in ${plural(ws.length, "world")}` : "in no world"}</span></li>`;
  }).join("");
  const more = mods.filter((x) => x.st !== "ok").length - 6;
  const tag = (n, st, label) => (n ? `<span class="mlu-tag ${st}">${n} ${label}</span>` : "");
  return `<section class="mlw-box"><h4><span>Your packages on ${esc(rel.version)}</span><a data-act="foundry" data-what="Preview Compatibility: Foundry's full list for ${esc(rel.version)}">Full list</a></h4>
    <div class="mlu-tags"><span class="k">Modules</span>${tag(cnt(mods, "ok"), "ok", "compatible")}${tag(cnt(mods, "unv"), "unv", "not verified")}${tag(cnt(mods, "bad"), "bad", "incompatible")}</div>
    <div class="mlu-tags"><span class="k">Systems</span>${tag(cnt(syss, "ok"), "ok", "compatible")}${tag(cnt(syss, "unv"), "unv", "not verified")}</div>
    ${flagged ? `<ul class="mlu-flag">${flagged}${more > 0 ? `<li class="more">and ${more} more</li>` : ""}</ul>` : '<p class="ml-muted" style="margin:0">Every installed package is verified for this version.</p>'}
    <p class="hint">Not verified usually still works; incompatible won't load. Foundry checks this from each package's manifest.</p></section>`;
}

function updAction(rel) {
  const u = ST.upd, last = SNAPSHOTS[0];
  if (u.done) return `<section class="mlw-box mlu-act"><div class="mlu-done"><i class="fa-solid fa-circle-check"></i><div><strong>Installed Foundry ${esc(rel.version)}</strong>
      <span>Foundry is shutting down so the new version can start. If a service, Docker or your host restarts it, this page comes back by itself; otherwise start Foundry again the way you started it.</span></div></div>
      <a class="mlw-mock" data-act="updrestarted">Mockup: Foundry restarted</a></section>`;
  if (u.job) {
    const steps = ["Downloading", "Extracting", "Cleaning up", "Installing"].map((l, i) => `<li class="${i < u.job.step ? "done" : i === u.job.step ? "now" : ""}"><i class="fa-solid ${i < u.job.step ? "fa-check" : i === u.job.step ? "fa-spinner fa-spin-pulse" : "fa-circle"}"></i>${l}</li>`).join("");
    return `<section class="mlw-box mlu-act" role="status"><h4><span>${u.job.snap ? "Taking a snapshot first" : `Updating to ${esc(rel.version)}`}</span><span>${u.job.pct}%</span></h4>
      ${u.job.snap ? `<p class="mlu-sub">Backing up ${esc(u.job.current ?? "")}</p>` : `<ol class="mlu-steps">${steps}</ol>`}<div class="mlu-bar"><span style="width:${u.job.pct}%"></span></div>
      <p class="hint">Setup is locked until it's done. Don't close Foundry.</p></section>`;
  }
  const snap = `<label class="mls-bfirst"><input type="checkbox" data-act="updsnap" ${u.snapFirst ? "checked" : ""}><span><b>Take a snapshot first</b><br><span class="ml-muted">${last ? `The latest is from ${esc(last.rel)}.` : "You have no snapshot yet."} If the update goes wrong, restore it from Backups.</span></span></label>`;
  const chan = `<div class="mlu-chan"><span class="k">Channel</span><select data-change="updchan" aria-label="Update channel">${Object.entries(CHANNELS).map(([k, [l]]) => `<option value="${k}"${k === u.channel ? " selected" : ""}>${l}</option>`).join("")}</select><span class="hint">${CHANNELS[u.channel][1]}</span></div>`;
  let button;
  if (rel.manual) button = `<button type="button" class="bright mlu-go" disabled aria-describedby="upd-why"><i class="fa-solid fa-hand"></i>Manual installation required</button>
      <p class="mlu-why" id="upd-why"><i class="fa-solid fa-circle-info"></i>${esc(rel.manual)} <a data-act="foundry" data-what="Open your foundryvtt.com account's download page">Download page</a></p>`;
  else if (rel.disabled) button = `<button type="button" class="bright mlu-go" disabled aria-describedby="upd-why"><i class="fa-solid fa-ban"></i>Updates disabled</button>
      <p class="mlu-why" id="upd-why"><i class="fa-solid fa-circle-info"></i>Started with <code>--noupdate</code>: whoever runs this server updates it, for example by pulling a new Docker image.</p>`;
  else button = `<button type="button" class="bright mlu-go" data-act="updgo"><i class="fa-solid fa-cloud-arrow-down"></i>${u.snapFirst ? "Snapshot, then update" : "Download and install"} ${esc(rel.version)}</button>
      <p class="hint">Downloads, installs, then ${CFG_ENV.electron ? "restarts Foundry" : "shuts Foundry down so it can start the new version"}. Worlds migrate when they next launch.</p>`;
  const adv = u.adv ? `<label class="mlu-force"><input type="checkbox" data-act="updforce" ${u.force ? "checked" : ""}><span><b>Force update</b><br><span class="ml-muted">Reinstalls the latest version on this channel over your current one. Only to repair a broken install.</span></span></label><a class="mlc-more" data-act="updadv">Fewer options</a>` : '<a class="mlc-more" data-act="updadv">Advanced: force update</a>';
  return `<section class="mlw-box mlu-act"><h4><span>Update</span></h4>${rel.manual || rel.disabled ? "" : snap}${button}${chan}${adv}</section>`;
}

function updatePage() {
  const rel = UPD_STATES[ST.upd.state];
  const st = (id, l) => `<a class="${ST.upd.state === id ? "on" : ""}" data-act="updstate" data-id="${id}">${l}</a>`;
  const mock = `<div class="mlu-mock"><span>Mockup, show:</span>${st("available", "update available")}${st("manual", "manual install")}${st("disabled", "updates disabled")}${st("none", "up to date")}</div>`;
  const head = `<div class="mlb-head"><div><h2>Update Foundry</h2><p>You're on Foundry ${esc(ST.upd.installed)} (${CHANNELS[ST.upd.channel][0]}).${rel ? ` <b>${esc(rel.version)}</b> is available.` : " You have the latest version."}</p></div><span class="ml-spacer"></span>${mock}</div>`;
  if (!rel) {
    return `<section id="setup-packages" class="application framed mls-main mlb-page"><div class="mls-body-main">${head}
      <div class="mlw-empty"><i class="fa-solid fa-circle-check"></i><h3>Foundry is up to date</h3><p>Foundry ${esc(ST.upd.installed)} is the latest ${CHANNELS[ST.upd.channel][0]} version.</p>
      <button type="button" data-act="updcheck"><i class="fa-solid fa-rotate"></i>Check again</button><p class="ml-muted">Foundry checks by itself when Setup opens.</p></div></div></section>`;
  }
  return `<section id="setup-packages" class="application framed mls-main mlb-page mlu-page"><div class="mls-body-main">${head}
    <div class="mlu-cols">${updNotes(rel)}<div class="mlu-side">${updAction(rel)}${updCompat(rel)}</div></div></div></section>`;
}

A.updpage = (id) => { ST.page = "update"; ST.pop = null; ST.panel = null; render(); if (id === "notes") document.querySelector(".mlu-notes")?.scrollIntoView({ block: "start" }); };
A.updstate = (id) => { ST.upd.state = id; ST.upd.done = false; ST.upd.job = null; render(); };
A.updsec = (h) => { const o = ST.upd.open; o.has(h) ? o.delete(h) : o.add(h); render(); };
A.updall = () => { ST.upd.open = ST.upd.open.size >= UPD_NOTES.length ? new Set() : new Set(UPD_NOTES.map((s) => s.h)); render(); };
A.updjump = (h) => { ST.upd.open.add(h); render(); document.getElementById(`upd-${h.replace(/\W+/g, "-")}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); };
A.upddev = () => { ST.upd.devNotes = !ST.upd.devNotes; render(); };
A.updsnap = () => { ST.upd.snapFirst = !ST.upd.snapFirst; render(); };
A.updforce = () => { ST.upd.force = !ST.upd.force; render(); };
A.updadv = () => { ST.upd.adv = !ST.upd.adv; render(); };
A.updmod = (id) => { A.library(); ST.panel = { kind: "module", id }; ST.mtab = "package"; render(); };
A.updcheck = () => notify("Mockup: Foundry asks foundryvtt.com for the latest version on this channel.");
A.updrestarted = () => { ST.upd.installed = UPD_STATES[ST.upd.state].version; ST.upd.state = "none"; ST.upd.done = false; CFG_ENV.build = ST.upd.installed; render(); };
A.updgo = () => {
  const u = ST.upd, rel = UPD_STATES[u.state];
  const names = [...ALL_MODULES.map((m) => m.title), ...SYSTEMS.map((x) => x.title), ...WORLDS_X.map((w) => w.title)];
  u.job = { pct: 0, step: 0, snap: u.snapFirst }; render();
  const tick = setInterval(() => {
    const j = u.job; j.pct = Math.min(100, j.pct + (j.snap ? 9 : 6));
    if (j.snap) j.current = names[Math.floor((j.pct / 100) * (names.length - 1))];
    else j.step = j.pct < 45 ? 0 : j.pct < 70 ? 1 : j.pct < 80 ? 2 : 3;
    if (j.pct < 100) { render(); return; }
    if (j.snap) {
      SNAPSHOTS.unshift({ id: `snap-${Date.now()}`, note: `Before updating to ${rel.version}`, date: "Friday 6 November 2026", time: "12:30", rel: "just now", build: u.installed, size: "3.4 GB", packages: names.length });
      u.job = { pct: 0, step: 0, snap: false }; render(); return;
    }
    clearInterval(tick); u.job = null; u.done = true; render();
  }, 200);
};
// While updating, Launch waits too.
const launchBeforeUpdate = A.launch;
A.launch = (...a) => (ST.upd.job ? notify("Foundry is updating. Launch when it's done.", "warning") : launchBeforeUpdate(...a));
document.addEventListener("input", (e) => {
  if (e.target.dataset?.filter !== "updq") return;
  ST.upd.q = e.target.value; const pos = e.target.selectionStart; render();
  const inp = document.querySelector('[data-filter="updq"]'); inp?.focus(); inp?.setSelectionRange(pos, pos);
});
document.addEventListener("change", (e) => { if (e.target.dataset?.change === "updchan") { ST.upd.channel = e.target.value; render(); } });
