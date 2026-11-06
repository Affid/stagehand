
// ---------- Server backups: our page in place of Foundry's Backup Manager window ----------
// Foundry's categories and order (Snapshots, Worlds, Modules, Systems), all through its public calls:
// game.listBackups, createSnapshot, restoreSnapshot, deleteSnapshots, restoreBackup, deleteBackups.
// World backups are the same data as each world's Backups tab (BACKUPS).

const PKG_BACKUPS = {
  module: {
    "modular-av": [
      { id: "m-av-2", name: "Before 0.11", date: "28 Oct 2026", time: "21:10", rel: "9 days ago", core: "14.369", ver: "0.10.4", size: "6 MB" },
      { id: "m-av-1", name: "", date: "2 Oct 2026", time: "03:00", rel: "5 weeks ago", core: "14.369", ver: "0.10.1", size: "6 MB", snapshot: true },
    ],
    "modular-av-livekit": [{ id: "m-lk-1", name: "", date: "2 Oct 2026", time: "03:00", rel: "5 weeks ago", core: "14.369", ver: "0.10.1", size: "11 MB", snapshot: true }],
    "token-hud-wildcard": [{ id: "m-th-1", name: "Before uninstalling", date: "20 Aug 2026", time: "16:45", rel: "11 weeks ago", core: "13.351", ver: "2.4.1", size: "3 MB", title: "Token HUD Wildcard", gone: true }],
  },
  system: {
    dnd5e: [
      { id: "s-dnd-2", name: "", date: "2 Oct 2026", time: "03:00", rel: "5 weeks ago", core: "14.369", ver: "5.1.2", size: "212 MB", snapshot: true },
      { id: "s-dnd-1", name: "Before 5.0", date: "14 Mar 2026", time: "18:30", rel: "8 months ago", core: "13.351", ver: "4.3.9", size: "188 MB" },
    ],
    pf2e: [{ id: "s-pf-1", name: "", date: "2 Oct 2026", time: "03:00", rel: "5 weeks ago", core: "14.369", ver: "7.1.0", size: "431 MB", snapshot: true }],
  },
};
const SNAPSHOTS = [
  { id: "snap-2", note: "Before the 14.369 update", date: "Friday 2 October 2026", time: "03:00", rel: "5 weeks ago", build: "14.369", size: "3.1 GB", packages: 31 },
  { id: "snap-1", note: "Before moving to V14", date: "Saturday 14 March 2026", time: "18:30", rel: "8 months ago", build: "13.351", size: "2.4 GB", packages: 27 },
];
const busyTip = () => (ST.serverJob ? "Wait for the snapshot to finish" : "Wait for the running backup to finish");
const SB_TABS = [["snapshots", "fa-camera-retro", "Snapshots"], ["world", "fa-globe", "Worlds"], ["module", "fa-plug", "Modules"], ["system", "fa-dice", "Systems"]];

/** Backups of one category as { id, title, list, gone, type }. */
function sbPackages(type) {
  const src = type === "world" ? BACKUPS : PKG_BACKUPS[type];
  return Object.entries(src).filter(([, list]) => list.length).map(([id, list]) => {
    const title = type === "world" ? world(id)?.title : type === "system" ? SYSTEMS.find((s) => s.id === id)?.title : MOD[id]?.title;
    return { id, type, list, title: title ?? list[0].title ?? id, gone: !title };
  });
}
const sumMB = (list) => list.reduce((t, b) => t + toMB(b.size), 0);
const sbTotal = (type) => sbPackages(type).reduce((t, p) => t + sumMB(p.list), 0);
const sbCount = (type) => (type === "snapshots" ? SNAPSHOTS.length : sbPackages(type).reduce((t, p) => t + p.list.length, 0));

/** Foundry's version tag: same generation safe, older a warning, newer can't be restored. */
function sbVersion(build, kind) {
  const gen = Number(build.split(".")[0]);
  if (gen === 14) return { cls: "", tip: `${kind} with Foundry ${build}: safe to restore`, ok: true };
  if (gen < 14) return { cls: "warn", tip: `${kind} with Foundry ${build}. Restoring brings back V${gen} data; worlds migrate again when they launch, and some packages may not work in V14.`, ok: true };
  return { cls: "bad", tip: `${kind} with a newer Foundry (${build}); it can't be restored here.`, ok: false };
}

function serverBackupsPage() {
  const tab = ST.sbTab ?? "snapshots";
  const job = ST.serverJob;
  const lock = job || ST.backupJob ? " disabled" : "";
  const pkgMB = ["world", "module", "system"].reduce((t, k) => t + sbTotal(k), 0);
  const tabs = SB_TABS.map(([id, icon, label]) => {
    const size = id === "snapshots" ? "" : ` · ${fmtSize(sbTotal(id))}`;
    return `<a class="${tab === id ? "active" : ""}" data-act="sbtab" data-id="${id}"><i class="fa-solid ${icon}"></i>${label} <span class="c">${sbCount(id)}${size}</span></a>`;
  }).join("");
  const create = job ? sbProgress(job) : `${lock ? `<span class="mlw-tipwrap" data-tooltip="${busyTip()}">` : ""}<button type="button" class="bright" data-act="snapnew"${lock}><i class="fa-solid fa-camera-retro"></i>Create a snapshot</button>${lock ? "</span>" : ""}`;
  const head = `<div class="mlb-head"><div><h2>Backups</h2><p>${fmtSize(pkgMB)} of backups on this server · ${plural(SNAPSHOTS.length, "snapshot")} · 48 GB of disk free</p></div><span class="ml-spacer"></span>${create}</div>`;
  const progress = "";
  const body = tab === "snapshots" ? sbSnapshots(lock) : sbPackageList(tab, lock);
  return `<section id="setup-packages" class="application framed mls-main mlb-page"><div class="mls-body-main">${head}${progress}
    <nav class="mls-subtabs">${tabs}</nav>${body}</div></section>`;
}

function sbProgress(job) {
  // Foundry's own order, seen live on 14.370: modules, then systems, then worlds.
  const steps = [["module", "Modules"], ["system", "Systems"], ["world", "Worlds"]].map(([k, l], i) =>
    `<li class="${i < job.step ? "done" : i === job.step ? "now" : ""}"><i class="fa-solid ${i < job.step ? "fa-check" : i === job.step ? "fa-spinner fa-spin-pulse" : "fa-circle"}"></i>${l}</li>`).join("");
  return `<div class="mlb-job" role="status" data-tooltip="A snapshot can't be interrupted. Launching, restoring and deleting wait until it's done."><div class="t"><strong>Creating a snapshot · ${job.pct}%</strong><span>${job.current ? `Backing up ${esc(job.current)}` : "Starting…"}</span></div>
    <ol>${steps}</ol><div class="bar"><span style="width:${job.pct}%"></span></div></div>`;
}

function sbSnapshots(lock) {
  if (!SNAPSHOTS.length) return `<div class="mlw-empty"><i class="fa-solid fa-camera-retro"></i><h3>No snapshots yet</h3><p>A snapshot backs up every world, module and system at once, so you can roll the whole server back, for example before updating Foundry.</p></div>`;
  const sel = ST.snapSel;
  const rows = SNAPSHOTS.map((s) => {
    const v = sbVersion(s.build, "Taken");
    const pick = sel ? `<input type="checkbox" data-act="snappick" data-id="${s.id}" ${sel.has(s.id) ? "checked" : ""} aria-label="Select the snapshot of ${esc(s.date)}">` : '<i class="fa-solid fa-camera-retro"></i>';
    const restore = !v.ok ? `<span class="mlw-tipwrap" data-tooltip="${esc(v.tip)}"><button type="button" disabled>Restore…</button></span>`
      : lock ? `<span class="mlw-tipwrap" data-tooltip="${busyTip()}"><button type="button" disabled>Restore…</button></span>`
      : `<button type="button" data-act="foundry" data-what="Restore the snapshot of ${esc(s.date)}: Foundry checks disk space, lists packages added since, and asks you to type a code">Restore…</button>`;
    const del = lock ? `<span class="mlw-tipwrap" data-tooltip="${busyTip()}"><button type="button" class="icon" disabled aria-label="Delete"><i class="fa-solid fa-trash"></i></button></span>`
      : `<button type="button" class="icon" data-act="snapdelone" data-id="${s.id}" aria-label="Delete the snapshot ${esc(s.note || s.date)}" data-tooltip="Delete this snapshot and the backups in it"><i class="fa-solid fa-trash"></i></button>`;
    return `<li class="${sel?.has(s.id) ? "picked" : ""}">${pick}<div class="nm"><strong>${esc(s.note || s.date)}</strong><span>${s.note ? `${esc(s.date)}, ` : ""}${esc(s.time)} · ${esc(s.rel)} · ${plural(s.packages, "package")}</span></div>
      <span class="core ${v.cls}" data-tooltip="${esc(v.tip)}"><i class="fa-solid ${v.cls ? "fa-triangle-exclamation" : "fa-code-branch"}"></i> ${esc(s.build)}</span><span class="sz">${esc(s.size)}</span>${sel ? "<span></span><span></span>" : `${restore}${del}`}</li>`;
  }).join("");
  const bar = sel
    ? `<div class="mlw-bhead sel"><i class="fa-solid fa-square-check"></i><span><b>${sel.size ? `${plural(sel.size, "snapshot")} selected` : "Select snapshots to delete"}</b></span><span class="ml-spacer"></span>
        <button type="button" class="del" data-act="snapdel"${sel.size ? "" : " disabled"}><i class="fa-solid fa-trash"></i>Delete${sel.size ? ` ${sel.size}` : ""}…</button><button type="button" data-act="snapselect">Done</button></div>`
    : `<div class="mlw-bhead"><span>A snapshot holds a backup of every package; restoring it rolls the whole server back. Its backups are counted under Worlds, Modules and Systems.</span><span class="ml-spacer"></span>
        ${SNAPSHOTS.length > 1 && !lock ? '<button type="button" data-act="snapselect"><i class="fa-solid fa-square-check"></i>Select</button>' : ""}</div>`;
  return `<div class="mlb-scroll">${bar}<ol class="mlw-blist mlb-snaps">${rows}</ol></div>`;
}

function sbPackageList(type, lock) {
  const q = (ST.sbq ?? "").trim().toLowerCase();
  const sort = ST.sbSort ?? "name";
  const pkgs = sbPackages(type).filter((p) => !q || p.title.toLowerCase().includes(q))
    .sort((a, b) => (sort === "size" ? sumMB(b.list) - sumMB(a.list) : sort === "latest" ? BACKUP_AGE(a) - BACKUP_AGE(b) : a.title.localeCompare(b.title)));
  const noun = { world: "world", module: "module", system: "system" }[type];
  const tools = `<div class="ml-row mlb-tools"><input type="search" data-filter="sb" value="${esc(ST.sbq ?? "")}" placeholder="Filter ${noun}s" aria-label="Filter ${noun}s">
    <span class="ml-label">Sort by</span><select data-change="sbsort" aria-label="Sort by">${[["name", "Name"], ["size", "Size"], ["latest", "Latest backup"]].map(([k, l]) => `<option value="${k}"${k === sort ? " selected" : ""}>${l}</option>`).join("")}</select>
    <span class="ml-spacer"></span><span class="ml-muted">${plural(sbCount(type), "backup")} of ${plural(sbPackages(type).length, noun)} · ${fmtSize(sbTotal(type))}</span></div>`;
  if (!pkgs.length) return `${tools}<p class="ml-muted" style="padding:12px 2px">${q ? `No ${noun} matches.` : `No ${noun} backups yet.`}</p>`;
  const rows = pkgs.map((p) => {
    const open = ST.sbOpen?.has(`${type}:${p.id}`);
    const latest = p.list[0], v = sbVersion(latest.core, "Made");
    const ver = latest.ver ? `v${esc(latest.ver)} · ` : "";
    const gone = p.gone ? `<span class="mlw-pill" data-tooltip="No longer installed. Restoring a backup installs it again.">not installed</span>` : "";
    const restoreLatest = lock ? `<span class="mlw-tipwrap" data-tooltip="${busyTip()}"><button type="button" disabled>Restore latest…</button></span>`
      : `<button type="button" data-act="foundry" data-what="Restore the latest backup of ${esc(p.title)} (Foundry asks you to type a code and offers a backup of the current state first)">Restore latest…</button>`;
    const inner = open ? `<ol class="mlb-inner">${p.list.map((b, k) => {
      const bv = sbVersion(b.core, "Made");
      const del = b.snapshot ? `<span class="mlw-tipwrap" data-tooltip="Part of a snapshot: it's deleted with the snapshot"><button type="button" class="icon" disabled aria-label="Can't delete alone: part of a snapshot"><i class="fa-solid fa-trash"></i></button></span>`
        : `<button type="button" class="icon" data-act="sbdel" data-id="${type}|${p.id}|${b.id}" aria-label="Delete this backup" data-tooltip="Delete"${lock}><i class="fa-solid fa-trash"></i></button>`;
      return `<li><i class="fa-solid ${b.snapshot ? "fa-camera" : "fa-floppy-disk"}"></i><div class="nm"><strong>${esc(b.name || b.date)}</strong><span>${esc(b.date)}${b.time ? `, ${esc(b.time)}` : ""} · ${esc(b.rel)}${b.snapshot ? " · part of a snapshot" : ""}${k === 0 ? ' <span class="mlw-pill">latest</span>' : ""}</span></div>
        <span class="core ${bv.cls}" data-tooltip="${esc(bv.tip)}"><i class="fa-solid fa-code-branch"></i> ${b.ver ? `v${esc(b.ver)}` : esc(b.core)}</span><span class="sz">${esc(b.size)}</span>
        ${lock ? `<span class="mlw-tipwrap" data-tooltip="${busyTip()}"><button type="button" disabled>Restore…</button></span>` : `<button type="button" data-act="foundry" data-what="Restore “${esc(b.name || b.date)}” of ${esc(p.title)} (Foundry asks you to type a code)">Restore…</button>`}${del}</li>`;
    }).join("")}</ol>${type === "world" && !p.gone ? `<a class="mlb-open" data-act="sbworld" data-id="${p.id}">Open ${esc(p.title)}'s Backups tab</a>` : ""}` : "";
    return `<li class="mlb-pkg${open ? " open" : ""}"><div class="row">
      <button type="button" class="icon tog" data-act="sbopen" data-id="${type}:${p.id}" aria-expanded="${!!open}" aria-label="${open ? "Hide" : "Show"} the backups of ${esc(p.title)}"><i class="fa-solid fa-chevron-${open ? "down" : "right"}"></i></button>
      <div class="nm" data-act="sbopen" data-id="${type}:${p.id}"><strong>${esc(p.title)} ${gone}</strong><span>${plural(p.list.length, "backup")} · latest ${esc(latest.rel)}</span></div>
      <span class="core ${v.cls}" data-tooltip="${esc(v.tip)}"><i class="fa-solid fa-code-branch"></i> ${ver}${esc(latest.core)}</span><span class="sz">${fmtSize(sumMB(p.list))}</span>${restoreLatest}</div>${inner}</li>`;
  }).join("");
  return `${tools}<div class="mlb-scroll"><ol class="mlb-pkgs">${rows}</ol></div>`;
}
const AGE_DAYS = { "just now": 0, "3 days ago": 3, "9 days ago": 9, "3 weeks ago": 21, "5 weeks ago": 35, "2 months ago": 60, "11 weeks ago": 77, "8 months ago": 240, "9 months ago": 270 };
const BACKUP_AGE = (p) => AGE_DAYS[p.list[0].rel] ?? 999;

function snapshotDialog() {
  if (ST.dialog !== "snapshot") return "";
  const counts = `${plural(WORLDS_X.length, "world")}, ${plural(ALL_MODULES.length, "module")} and ${plural(SYSTEMS.length, "system")}`;
  const body = `<div class="mls-launch-body">
    <p>A snapshot backs up every installed world, module and system, so you can later roll the whole server back to this moment.</p>
    <div class="mlb-facts"><span><i class="fa-solid fa-box-archive"></i>${counts}</span><span><i class="fa-solid fa-hard-drive"></i>About 3.4 GB needed · 48 GB free</span><span class="ml-muted" style="font-size:12px">Needed is the size before compression; the snapshot itself is usually smaller.</span></div>
    <label class="mlb-note"><span>Note</span><input type="text" id="snapnote" placeholder="Optional, for example: Before updating Foundry" maxlength="200"></label>
    <div class="mls-check warn"><i class="fa-solid fa-triangle-exclamation"></i><span>It can take a while and can't be interrupted. Launching, restoring and deleting wait until it's done.</span></div></div>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button><button type="button" class="bright" data-act="snapgo"><i class="fa-solid fa-camera-retro"></i>Create the snapshot</button>`;
  const x = Math.round(innerWidth / 2 - 260), y = Math.max(80, Math.round(innerHeight / 2 - 220));
  return `<div class="mls-backdrop" data-act="closedialog"></div>${fwindow({ title: "Create a snapshot", icon: "fa-solid fa-camera-retro", x, y, w: 520, body, footer, cls: "mls-dialog" })}`;
}

A.srvbackups = () => { ST.page = "backups"; ST.pop = null; ST.panel = null; ST.select = false; ST.snapSel = null; render(); };
A.sbtab = (id) => { ST.sbTab = id; ST.snapSel = null; render(); };
A.sbopen = (key) => { ST.sbOpen ??= new Set(); ST.sbOpen.has(key) ? ST.sbOpen.delete(key) : ST.sbOpen.add(key); render(); };
A.sbworld = (id) => { A.world(id); ST.wtab = "backups"; render(); };
A.sbdel = (key) => {
  const [type, pid, bid] = key.split("|");
  const src = type === "world" ? BACKUPS : PKG_BACKUPS[type];
  src[pid] = src[pid].filter((b) => b.id !== bid);
  render(); notify("Mockup: Foundry asks to confirm, then deletes the backup (game.deleteBackups).");
};
A.snapselect = () => { ST.snapSel = ST.snapSel ? null : new Set(); render(); };
A.snappick = (id) => { ST.snapSel.has(id) ? ST.snapSel.delete(id) : ST.snapSel.add(id); render(); };
A.snapdelone = (id) => { ST.snapSel = new Set([id]); A.snapdel(); };
A.snapdel = () => {
  const n = ST.snapSel.size, gone = ST.snapSel;
  // Deleting a snapshot deletes the package backups taken with it.
  SNAPSHOTS.splice(0, SNAPSHOTS.length, ...SNAPSHOTS.filter((s) => !gone.has(s.id)));
  [BACKUPS, ...Object.values(PKG_BACKUPS)].forEach((src) => Object.keys(src).forEach((k) => { src[k] = src[k].filter((b) => !gone.has(b.snap)); }));
  ST.snapSel = null; render();
  notify(`Mockup: Foundry asks you to type a code, then deletes ${plural(n, "snapshot")} and the backups in ${n === 1 ? "it" : "them"} (game.deleteSnapshots).`);
};
A.snapnew = () => { ST.dialog = "snapshot"; render(); document.getElementById("snapnote")?.focus(); };
A.snapgo = () => {
  const note = document.getElementById("snapnote")?.value.trim() ?? "";
  ST.dialog = null; ST.serverJob = { pct: 0, step: 0, note }; ST.sbTab = "snapshots"; render();
  const tick = setInterval(() => {
    const j = ST.serverJob; j.pct = Math.min(100, j.pct + 7); j.step = j.pct < 55 ? 0 : j.pct < 70 ? 1 : 2;
    // Foundry reports each package as it goes (createBackup progress, with the package title).
    const stage = [ALL_MODULES.map((m) => m.title), SYSTEMS.map((x) => x.title), WORLDS_X.map((w) => w.title)][j.step];
    j.current = stage[Math.floor(((j.pct - [0, 55, 70][j.step]) / [55, 15, 30][j.step]) * stage.length) % stage.length];
    if (j.pct < 100) { render(); return; }
    clearInterval(tick);
    const id = `snap-${Date.now()}`;
    // A snapshot is one backup of every package; worlds show theirs on their Backups tab.
    WORLDS_X.forEach((w) => { BACKUPS[w.id] = [{ id: `${id}-${w.id}`, name: "", date: "6 Nov 2026", time: "12:10", rel: "just now", core: CORE_NOW, size: backupsOf(w.id)[0]?.size ?? "120 MB", snapshot: true, snap: id }, ...backupsOf(w.id)]; });
    Object.values(PKG_BACKUPS).forEach((src) => Object.keys(src).forEach((k) => { if (src[k][0] && !src[k][0].title) src[k] = [{ ...src[k][0], id: `${id}-${k}`, name: "", date: "6 Nov 2026", time: "12:10", rel: "just now", core: CORE_NOW, snapshot: true, snap: id }, ...src[k]]; }));
    SNAPSHOTS.unshift({ id, note, date: "Friday 6 November 2026", time: "12:10", rel: "just now", build: "14.370", size: "3.4 GB", packages: WORLDS_X.length + ALL_MODULES.length + SYSTEMS.length });
    ST.serverJob = null; render(); notify("Snapshot created.");
  }, 260);
};
// The world page's Launch waits for a running snapshot too.
const launchBeforeServer = A.launch;
A.launch = (...a) => (ST.serverJob ? notify("A snapshot is being created. Launch when it's done.", "warning") : launchBeforeServer(...a));
document.addEventListener("input", (e) => {
  if (e.target.dataset?.filter !== "sb") return;
  ST.sbq = e.target.value; const pos = e.target.selectionStart; render();
  const inp = document.querySelector('[data-filter="sb"]'); inp?.focus(); inp?.setSelectionRange(pos, pos);
});
document.addEventListener("change", (e) => { if (e.target.dataset?.change === "sbsort") { ST.sbSort = e.target.value; render(); } });

// Backups taken with the 2 October snapshot belong to it.
[BACKUPS, ...Object.values(PKG_BACKUPS)].forEach((src) => Object.values(src).forEach((list) => list.forEach((b) => { if (b.snapshot && !b.snap) b.snap = "snap-2"; })));
