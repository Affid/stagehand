
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
/** The sample above, written as Foundry writes its notes (header, h2 sections, h3 areas, lists, issue links). */
function sampleNotesHtml(rel) {
  const link = (n) => `<a href="https://github.com/foundryvtt/foundryvtt/issues/${n}" rel="nofollow" target="_blank">(${n})</a>`;
  const ul = (items) => `<ul>${items.map((i) => `<li>${esc(i.t).replace(/(\b[A-Z][A-Za-z]+#[A-Za-z]+\b|\bpreCreateRegionBehavior\b)/g, "<code>$1</code>")} ${link(i.n)}</li>`).join("")}</ul>`;
  const [brk, ...rest] = UPD_NOTES;
  return `<header id="update-header"><h2 class="border" id="update-title">Foundry Virtual Tabletop - ${esc(rel.label.replace("Version ", "Version ").replace(" Stable ", " - Stable "))} Release Notes</h2>
    <p>This is a sample: a small update fixing several issues reported since the last release, with a few community requests.</p>
    <h3>${brk.h}</h3><p>Check these if you maintain a module or system.</p>${ul(brk.items)}</header>
    ${rest.map((sec) => `<h2>${sec.h}</h2>${sec.items ? ul(sec.items) : sec.sub.map((x) => `<h3>${x.h}</h3>${ul(x.items)}`).join("")}`).join("")}`;
}

/**
 * Read Foundry's release-notes HTML into { title, banner, intro, sections }. Sections are h2 (or an h3 that comes
 * before the first section, like Breaking Changes); areas are h3; entries are list items. Each entry's GitHub issue
 * link becomes its number. Everything is cleaned like a world description (no scripts, http(s) links only).
 */
const NOTE_KIND = (h) => (/breaking/i.test(h) ? "breaking" : /^(api|documentation)\b/i.test(h) ? "dev" : "user");
const SUB_KIND = (h) => (/package development/i.test(h) ? "dev" : undefined);
function parseNotes(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const out = { title: "", banner: null, intro: [], sections: [] };
  const blocks = [...doc.body.querySelectorAll("h2, h3, ul, ol, p, figure")].filter((el) => !el.parentElement.closest("li, figure, p"));
  let sec = null, sub = null;
  const entry = (li) => {
    let n = null;
    li.querySelectorAll('a[href*="/issues/"]').forEach((a) => { const m = a.getAttribute("href").match(/\/issues\/(\d+)/); if (m) { n = Number(m[1]); a.remove(); } });
    const html2 = cleanDesc(li.innerHTML).replace(/<\/?p>/g, "").replace(/\s*\(\s*\)\s*$/, "").trim();
    return { html: html2, n, text: li.textContent.replace(/\s+/g, " ").trim() };
  };
  for (const el of blocks) {
    const tag = el.tagName, text = el.textContent.replace(/\s+/g, " ").trim();
    if (tag === "H2" && !out.title && /release notes/i.test(text)) { out.title = text.replace(/\s*release notes$/i, "").replace(/^Foundry Virtual Tabletop\s*-\s*/i, ""); continue; }
    if (tag === "FIGURE" && !sec) {
      const img = el.querySelector("img"), src = img?.getAttribute("src") ?? "";
      if (/^https:\/\//.test(src)) out.banner = { src, alt: img.getAttribute("alt") ?? "", caption: cleanDesc(el.querySelector("figcaption")?.innerHTML ?? "").replace(/<\/?p>/g, "") };
      continue;
    }
    if (tag === "H2" || (tag === "H3" && !sec)) { sec = { h: text, kind: NOTE_KIND(text), intro: [], items: [], sub: [] }; sub = null; out.sections.push(sec); continue; }
    if (tag === "H3") { sub = { h: text, kind: SUB_KIND(text), intro: [], items: [] }; sec.sub.push(sub); continue; }
    if (tag === "P") { const c = cleanDesc(el.outerHTML); if (c) (sub ?? sec ?? out).intro.push(c); continue; }
    if ((tag === "UL" || tag === "OL") && sec) (sub ?? sec).items.push(...[...el.children].filter((x) => x.tagName === "LI").map(entry));
  }
  // An h3 section like Breaking Changes is followed by the first h2; empty shells are dropped.
  out.sections = out.sections.filter((x) => x.items.length || x.sub.some((y) => y.items.length));
  out.sections.forEach((x) => { if (!x.sub.length) delete x.sub; else if (!x.items.length) delete x.items; });
  return out;
}
const notesFor = (rel) => (rel._notes ??= parseNotes(rel.notesHtml ?? sampleNotesHtml(rel)));

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
  return (sec.items ?? []).filter((i) => !q || i.text.toLowerCase().includes(q) || String(i.n ?? "").includes(q));
}
const secCount = (s) => (s.items ? updItems(s) : (s.sub ?? []).flatMap((x) => updItems(x, s))).length;
const issue = (n) => `<a class="mlu-issue" data-act="foundry" data-what="Open issue #${n} on GitHub" data-tooltip="Issue #${n} on GitHub">#${n}</a>`;
const itemList = (items) => `<ul>${items.map((i) => `<li>${i.html}${i.n ? ` ${issue(i.n)}` : ""}</li>`).join("")}</ul>`;
const intro = (ps) => (ST.upd.q.trim() ? "" : ps.map((p) => p.replace("<p>", '<p class="mlu-p">')).join(""));

function updNotes(rel) {
  const notes = notesFor(rel);
  const sections = notes.sections.filter((s) => ST.upd.devNotes || s.kind !== "dev");
  const jump = sections.map((s) => { const n = secCount(s); return n ? `<a data-act="updjump" data-id="${esc(s.h)}" class="${s.kind === "breaking" ? "brk" : ""}"><b>${n}</b> ${esc(JUMP_LABEL[s.h]?.[n === 1 ? 0 : 1] ?? s.h)}</a>` : ""; }).join("");
  const body = sections.map((s) => {
    const n = secCount(s);
    if (!n) return "";
    const open = ST.upd.open.has(s.h) || !!ST.upd.q.trim();
    const inner = !open ? "" : intro(s.intro ?? []) + (s.items ? itemList(updItems(s)) : (s.sub ?? []).map((x) => { const it = updItems(x, s); return it.length ? `<h4>${esc(x.h)}${isDevSection(x, s) && s.kind !== "dev" ? ' <span class="mlw-pill">developers</span>' : ""}</h4>${intro(x.intro ?? [])}${itemList(it)}` : ""; }).join(""));
    return `<section class="mlu-sec ${s.kind}" id="upd-${esc(s.h).replace(/\W+/g, "-")}"><h3 data-act="updsec" data-id="${esc(s.h)}" aria-expanded="${open}"><i class="fa-solid fa-chevron-${open ? "down" : "right"}"></i>${s.kind === "breaking" ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ""}${esc(s.h)} <span class="c">${n}</span>${s.kind === "dev" ? ' <span class="mlw-pill">developers</span>' : ""}</h3>${inner}</section>`;
  }).join("") || '<p class="ml-muted">Nothing matches.</p>';
  const banner = notes.banner && !ST.upd.q.trim() ? `<figure class="mlu-banner"><img src="${esc(notes.banner.src)}" alt="${esc(notes.banner.alt)}" loading="lazy">${notes.banner.caption ? `<figcaption>${notes.banner.caption}</figcaption>` : ""}</figure>` : "";
  return `<div class="mlu-notes"><div class="mlu-nhead"><div><h3>Release notes: ${esc(notes.title || rel.label)}</h3><span>Foundry ${esc(rel.version)} · ${esc(rel.date)} · <a data-act="updview" data-id="history">All release notes</a></span></div></div>
    <div class="mlu-tools"><input type="search" data-filter="updq" value="${esc(ST.upd.q)}" placeholder="Search the notes" aria-label="Search the notes">
      <label><input type="checkbox" data-act="upddev" ${ST.upd.devNotes ? "checked" : ""}>Developer notes</label><span class="ml-spacer"></span><a data-act="updall">${notes.sections.every((x) => ST.upd.open.has(x.h)) ? "Collapse all" : "Expand all"}</a></div>
    <nav class="mlu-jump">${jump}</nav>${banner}${intro(notes.intro)}<div class="mlu-body">${body}</div></div>`;
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
  return `<section class="mlw-box"><h4><span>Your packages on ${esc(rel.version)}</span><a data-act="updview" data-id="compat">Full list</a></h4>
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
    <div class="mlu-cols">${updLeft(rel)}<div class="mlu-side">${updAction(rel)}${(ST.upd.view ?? "notes") === "compat" ? "" : updCompat(rel)}</div></div></div></section>`;
}

A.updpage = () => { ST.page = "update"; ST.pop = null; ST.panel = null; render(); };
A.updstate = (id) => { ST.upd.state = id; ST.upd.done = false; ST.upd.job = null; ST.upd.hist = null; render(); };
A.updsec = (h) => { const o = ST.upd.open; o.has(h) ? o.delete(h) : o.add(h); render(); };
A.updall = () => { const all = notesFor(UPD_STATES[ST.upd.state]).sections.map((s) => s.h); ST.upd.open = all.every((h) => ST.upd.open.has(h)) ? new Set() : new Set(all); render(); };
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

// ---------- Your packages (Foundry's compatibility preview) and Release history ----------
/** Status of every package for a release. Foundry's preview gives compatible / unverified / incompatible per package;
 *  the mockup derives it from the sample data. We add where each one is used. */
function compatData(rel) {
  const newGen = rel.gen > 14;
  const verified = (unv) => (unv ? "13.351" : "14.369");
  const mods = ALL_MODULES.map((m) => {
    const st = newGen ? (m.id === "module-library" ? "ok" : m.unverified ? "bad" : "unv") : m.unverified ? "unv" : "ok";
    const why = st === "ok" ? `Verified for ${newGen ? `Foundry ${rel.gen}` : `14 (build ${verified(m.unverified).split(".")[1]})`}`
      : st === "bad" ? `Made for Foundry 13 at most; it won't load on ${rel.gen}`
      : newGen ? `Verified for 14, not yet for ${rel.gen}` : `Last verified for ${verified(m.unverified)}`;
    return { kind: "module", id: m.id, title: m.title, ver: m.version ?? "0.11.0", st, why, worlds: WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, m.id)) };
  });
  const syss = SYSTEMS.map((s) => {
    const st = newGen ? (s.id === "dnd5e" ? "ok" : "unv") : s.unverified ? "unv" : "ok";
    const short = { dnd5e: "D&D 5e", pf2e: "Pathfinder 2e", swade: "SWADE" }[s.id];
    return { kind: "system", id: s.id, title: s.title, ver: s.version, st, why: st === "ok" ? `Verified for Foundry ${rel.gen}` : newGen ? `Verified for 14, not yet for ${rel.gen}` : "Last verified for 13.351", worlds: WORLDS_X.filter((w) => w.system === short) };
  });
  const worlds = WORLDS_X.map((w) => {
    const sys = syss.find((x) => x.worlds.includes(w));
    const mine = w.noCompanion ? [] : mods.filter((m) => m.worlds.includes(w));
    const bad = mine.filter((m) => m.st === "bad").length, unv = mine.filter((m) => m.st === "unv").length;
    // Unknown modules (no companion) are something to check, never "compatible".
    const st = bad || sys?.st === "bad" ? "bad" : unv || sys?.st === "unv" || w.noCompanion ? "unv" : "ok";
    const parts = [sys?.st === "ok" ? "System verified" : `System ${sys?.st === "bad" ? "incompatible" : "not verified"}`];
    if (w.noCompanion) parts.push("modules unknown (no companion)");
    else parts.push(bad || unv ? [bad ? `${bad} incompatible` : "", unv ? `${unv} not verified` : ""].filter(Boolean).join(", ") + ` of ${mine.length} modules` : `all ${mine.length} modules verified`);
    return { kind: "world", id: w.id, title: w.title, ver: `migrates to ${rel.version}`, st, why: parts.join(" · "), worlds: [] };
  });
  return { world: worlds, system: syss, module: mods };
}
const ST_LABEL = { ok: "Compatible", unv: "Not verified", bad: "Incompatible" };

function updCompatView(rel) {
  const data = compatData(rel), cat = ST.upd.ccat ?? "module", f = ST.upd.cfilter ?? "all", q = (ST.upd.cq ?? "").trim().toLowerCase();
  const tabs = [["world", "Worlds"], ["system", "Systems"], ["module", "Modules"]].map(([k, l]) => {
    const bad = data[k].filter((x) => x.st !== "ok").length;
    return `<a class="${cat === k ? "active" : ""}" data-act="updccat" data-id="${k}">${l} <span class="c">${data[k].length}${bad ? ` · <b class="w">${bad} to check</b>` : ""}</span></a>`;
  }).join("");
  const list = data[cat];
  const chip = (id, label) => { const n = id === "all" ? list.length : list.filter((x) => x.st === id).length; return `<a class="${f === id ? "on" : ""} ${id}" data-act="updcfilter" data-id="${id}">${label} <b>${n}</b></a>`; };
  const shown = list.filter((x) => (f === "all" || x.st === f) && (!q || x.title.toLowerCase().includes(q)))
    .sort((a, b) => ({ bad: 0, unv: 1, ok: 2 })[a.st] - ({ bad: 0, unv: 1, ok: 2 })[b.st] || b.worlds.length - a.worlds.length || a.title.localeCompare(b.title));
  const rows = shown.map((x) => {
    const where = x.kind === "world" ? `<a data-act="world" data-id="${x.id}">Open</a>`
      : x.worlds.length ? `<span data-tooltip="${esc(x.worlds.map((w) => w.title).join(", "))}">on in ${plural(x.worlds.length, "world")}</span>` : '<span class="none">in no world</span>';
    const open = x.kind === "module" ? `data-act="updmod" data-id="${x.id}"` : x.kind === "system" ? `data-act="updsys" data-id="${x.id}"` : "";
    return `<li class="${x.st}"><span class="st" data-tooltip="${ST_LABEL[x.st]}"><i class="fa-solid ${x.st === "ok" ? "fa-circle-check" : x.st === "bad" ? "fa-circle-xmark" : "fa-circle-question"}"></i></span>
      <div class="nm"><strong ${open}>${esc(x.title)}</strong><span>${esc(x.why)}</span></div><span class="v">${x.kind === "world" ? esc(x.ver) : `v${esc(x.ver)}`}</span><span class="u">${where}</span></li>`;
  }).join("") || '<li class="empty">Nothing matches.</li>';
  return `<div class="mlu-notes mlu-compat"><div class="mlu-nhead"><div><h3>Your packages on Foundry ${esc(rel.version)}</h3><span>Foundry's compatibility preview, from each package's manifest, with where you use them.</span></div></div>
    <nav class="mls-subtabs">${tabs}</nav>
    <div class="mlu-tools"><input type="search" data-filter="updcq" value="${esc(ST.upd.cq ?? "")}" placeholder="Filter ${cat}s" aria-label="Filter"><div class="mlu-chips">${chip("all", "All")}${chip("ok", "Compatible")}${chip("unv", "Not verified")}${chip("bad", "Incompatible")}</div></div>
    <ol class="mlu-clist">${rows}</ol>
    <p class="hint">Not verified usually still works: the author hasn't confirmed this version yet. Incompatible won't load. ${rel.gen > 14 ? "Check for package updates after updating Foundry; authors often release versions for the new generation." : ""}</p></div>`;
}

const RELEASES = [
  { version: "15.301", label: "Version 15 Stable 1", channel: "stable", date: "4 November 2026", manual: true, onlyIn: "manual" },
  { version: "15.300", label: "Version 15 Testing 1", channel: "testing", date: "28 October 2026" },
  { version: "14.371", label: "Version 14 Stable 13", channel: "stable", date: "5 November 2026" },
  { version: "14.370", label: "Version 14 Stable 12", channel: "stable", date: "29 October 2026", manual: true },
  { version: "14.369", label: "Version 14 Stable 11", channel: "stable", date: "8 October 2026" },
  { version: "14.368", label: "Version 14 Testing 4", channel: "testing", date: "1 October 2026" },
  { version: "14.367", label: "Version 14 Stable 10", channel: "stable", date: "17 September 2026" },
  { version: "14.366", label: "Version 14 Stable 9", channel: "stable", date: "3 September 2026" },
];
/** Short sample notes for older releases, in Foundry's format. */
function olderNotesHtml(r) {
  const link = (n) => `<a href="https://github.com/foundryvtt/foundryvtt/issues/${n}">(${n})</a>`;
  const base = Number(r.version.split(".")[1]) * 40;
  return `<header><h2>Foundry Virtual Tabletop - ${r.label.replace(" Stable ", " - Stable ").replace(" Testing ", " - Testing ")} Release Notes</h2>
    <p>Sample notes for ${esc(r.version)}.${r.manual ? " This release has to be installed by hand." : ""}</p></header>
    <h2>Bug Fixes</h2><h3>Applications and User Interface</h3><ul><li>Fixed a sample interface issue in ${esc(r.version)}. ${link(base)}</li><li>Fixed another sample issue. ${link(base + 1)}</li></ul>
    <h3>The Game Canvas</h3><ul><li>Fixed a sample canvas issue. ${link(base + 2)}</li></ul>`;
}
const newer = (a, b) => { const [g1, b1] = a.split(".").map(Number), [g2, b2] = b.split(".").map(Number); return g1 !== g2 ? g1 > g2 : b1 > b2; };

function updHistoryView() {
  const all = ST.upd.histAll, inst = ST.upd.installed;
  // The sample's Version 15 stable release only exists in the "manual install" state.
  const list = RELEASES.filter((r) => (!r.onlyIn || r.onlyIn === ST.upd.state) && (all || r.channel === ST.upd.channel));
  const sel = RELEASES.find((r) => r.version === ST.upd.hist) ?? list.find((r) => newer(r.version, inst)) ?? list[0];
  const since = list.filter((r) => newer(r.version, inst)).length;
  const rows = list.map((r) => {
    const tags = `${r.version === inst ? '<span class="mlw-pill">installed</span>' : ""}${newer(r.version, inst) ? '<span class="mlw-pill ok">new</span>' : ""}${r.manual ? '<span class="mlw-pill warn" data-tooltip="Installed by hand, not from Setup">manual</span>' : ""}${r.channel !== "stable" ? `<span class="mlw-pill">${CHANNELS[r.channel][0].toLowerCase()}</span>` : ""}`;
    return `<li class="${r === sel ? "on" : ""}${newer(r.version, inst) ? " newer" : ""}" data-act="updhist" data-id="${r.version}"><strong>${esc(r.version)}</strong><span>${esc(r.date)}</span><span class="tg">${tags}</span></li>`;
  }).join("");
  const known = Object.values(UPD_STATES).find((x) => x?.version === sel.version);
  const rel = known ?? { ...sel, notesHtml: olderNotesHtml(sel), gen: Number(sel.version.split(".")[0]) };
  const n = notesFor(rel);
  const items = n.sections.flatMap((s) => [...(s.items ?? []), ...(s.sub ?? []).flatMap((x) => x.items)]);
  const notes = `${n.intro.map((p) => p.replace("<p>", '<p class="mlu-p">')).join("")}${n.sections.map((s) => `<section class="mlu-sec ${s.kind}"><h3>${esc(s.h)} <span class="c">${(s.items ?? []).length + (s.sub ?? []).reduce((t, x) => t + x.items.length, 0)}</span></h3>${(s.sub ?? []).map((x) => `<h4>${esc(x.h)}</h4>${itemList(x.items)}`).join("")}${s.items ? itemList(s.items) : ""}</section>`).join("")}`;
  return `<div class="mlu-notes mlu-hist"><div class="mlu-nhead"><div><h3>Release history</h3><span>${since ? `${plural(since, "release")} since your ${esc(inst)}` : `You have the latest ${CHANNELS[ST.upd.channel][0]} release`} · <a data-act="foundry" data-what="Open foundryvtt.com/releases">foundryvtt.com/releases</a></span></div></div>
    <div class="mlu-tools"><label><input type="checkbox" data-act="updhistall" ${all ? "checked" : ""}>Include testing and development</label></div>
    <div class="mlu-hcols"><ol class="mlu-rels">${rows}</ol><div class="mlu-hnotes"><div class="mlu-hhead"><strong>${esc(n.title || sel.label)}</strong><span>${esc(sel.date)} · ${plural(items.length, "change")} · <a data-act="foundry" data-what="Open the ${esc(sel.version)} notes on foundryvtt.com">On foundryvtt.com</a></span></div>${notes}</div></div>
    <p class="hint">From Foundry's public list at foundryvtt.com/releases and each release's page (Foundry's own update check only returns the newest). Reading them needs one extra permission for foundryvtt.com, asked the first time you open this tab; without it, releases open there in a new tab.</p></div>`;
}

function updLeft(rel) {
  const v = ST.upd.view ?? "notes";
  const t = (id, icon, label) => `<a class="${v === id ? "active" : ""}" data-act="updview" data-id="${id}"><i class="fa-solid ${icon}"></i>${label}</a>`;
  const bad = (() => { const d = compatData(rel); return [...d.module, ...d.system].filter((x) => x.st !== "ok").length; })();
  const tabs = `<nav class="mls-subtabs mlu-tabs">${t("notes", "fa-newspaper", "What's new")}${t("compat", "fa-puzzle-piece", `Your packages${bad ? ` <span class="c w">${bad}</span>` : ""}`)}${t("history", "fa-clock-rotate-left", "Release history")}</nav>`;
  return `<div class="mlu-left">${tabs}${v === "compat" ? updCompatView(rel) : v === "history" ? updHistoryView() : updNotes(rel)}</div>`;
}

A.updview = (id) => { ST.upd.view = id; render(); document.querySelector(".mlu-left .mlu-notes")?.scrollTo(0, 0); };
A.updccat = (id) => { ST.upd.ccat = id; ST.upd.cfilter = "all"; render(); };
A.updcfilter = (id) => { ST.upd.cfilter = id; render(); };
A.updsys = (id) => { A.library(); ST.lsub = "systems"; ST.panel = { kind: "system", id }; ST.mtab = "package"; render(); };
A.updhist = (v) => { ST.upd.hist = v; render(); };
A.updhistall = () => { ST.upd.histAll = !ST.upd.histAll; render(); };
document.addEventListener("input", (e) => {
  if (e.target.dataset?.filter !== "updcq") return;
  ST.upd.cq = e.target.value; const pos = e.target.selectionStart; render();
  const inp = document.querySelector('[data-filter="updcq"]'); inp?.focus(); inp?.setSelectionRange(pos, pos);
});
