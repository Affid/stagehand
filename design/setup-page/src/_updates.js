// ---------- Library > Updates: check, review, update (docs/UPDATES-PLAN.md) ----------
// The check asks Foundry's checkPackage for every unlocked package; nothing installs. The tab
// lists what came back in sections, with warnings worked out before anything installs; Update
// installs only the ticked packages, after Foundry's own backup, with progress everywhere the
// package shows. "?upd=current" (nothing to update) and "?upd=offline" (no manifest answers).

const UPD_SCENE = Q.get("upd") || "typical";
const CORE = () => ST.upd?.installed ?? "14.369";
const HOUR = 3600_000;

/** What Foundry's checkPackage answers for the sample server. Everything not listed is current. */
const UPD_ANSWERS = [
  { id: "modular-av", to: "0.12.0" },
  { id: "modular-av-dock", to: "0.12.0", needs: [{ id: "modular-av", min: "0.12.0" }] },
  { id: "sequencer", to: "4.10.0" },
  { id: "simple-calendar", to: "3.11.0", unverified: true },
  { id: "chat-portrait", to: "4.10.0", refuseDownload: true },
  { id: "dnd5e", to: "5.2.0", impact: [{ id: "tidy5e-sheet", max: "5.1" }, { id: "dnd5e-srd-maps", max: "5.1" }] },
  { id: "tidy5e-sheet", to: "1.9.0", sys: { id: "dnd5e", min: "5.2.0" } },
  { id: "modular-av-p2p", to: "1.0.0", core: "14.372" },
  { id: "monks-tokenbar", to: "4.2.0", missing: "Monk's Common Display" },
  { id: "tavern-tunes", to: "2.0.0", premium: true },
  { id: "dungeon-draw", manifestRefused: true, later: "1.5.0" },
  { id: "health-estimate", error: true, later: "2.8.0" },
];

const SECTIONS = [
  ["updated", "Updated just now"],
  ["ready", "Ready"],
  ["attention", "Needs attention"],
  ["blocked", "Can't update here"],
  ["noaccess", "Not available to you"],
  ["error", "Couldn't check"],
];

const sysOf = (id) => SYSTEMS.find((s) => s.id === id);
const upPkg = (id) => MOD[id] ?? sysOf(id);
const upIsSystem = (id) => !!sysOf(id);
const verOf = (id) => upPkg(id)?.version ?? "0.11.0";
const titleOf = (id) => esc(upPkg(id)?.title ?? id);
/** A name short enough for a button: the systems as the worlds list shortens them. */
const SHORT_SYSTEM = { dnd5e: "D&D 5e", pf2e: "Pathfinder 2e", swade: "SWADE" };
const shortOf = (id) => esc(SHORT_SYSTEM[id] ?? short(id));
const checkable = () => [...ALL_MODULES, ...SYSTEMS].filter((p) => !ST.lock.has(p.id));
const upNewer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); } return false; };
const atLeast = (a, b) => !upNewer(b, a);
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${plural(m, "minute")} ago` : `${plural(Math.round(m / 60), "hour")} ago`; };

ST.uc = {
  checkedAt: Date.now() - 2 * HOUR, checking: null, results: new Map(), ticked: new Set(),
  backup: true, job: null, summary: null, refused: new Map(), single: new Set(), checkedOne: new Map(), fresh: new Set(), pending: null, outOfRange: new Map(),
  open: new Set(SECTIONS.map(([k]) => k)),
};

// ---------- the check ----------
function answersFor(scene) {
  if (scene === "current") return [];
  if (scene === "offline") return checkable().map((p) => ({ id: p.id, error: "Foundry couldn't reach the manifest. Is the server online?" }));
  return UPD_ANSWERS.filter((a) => upPkg(a.id) && !ST.lock.has(a.id));
}

/** One package's section, judged as if every Ready update were ticked (so a row doesn't move when you tick). */
function sectionOf(a, readyIds) {
  if (a.error) return "error";
  if (a.premium || a.manifestRefused) return "noaccess";
  if (a.to && ST.uc.refused.get(a.id) === a.to) return "noaccess";
  if (a.core || a.missing) return "blocked";
  return warnings(a, readyIds).length ? "attention" : "ready";
}

/**
 * Sections for a fresh check: Ready grows until it settles, so a row whose need another Ready
 * row meets (the Dock and Modular A/V) is Ready too. Ready rows start ticked.
 */
function applyCheck(answers) {
  ST.uc.results = new Map(answers.map((a) => [a.id, { ...a, from: verOf(a.id) }]));
  ST.uc.ticked = new Set();
  let ready = new Set();
  for (let pass = 0; pass < 5; pass++) {
    const next = new Set([...ST.uc.results.values()].filter((r) => sectionOf(r, ready) === "ready").map((r) => r.id));
    if (next.size === ready.size) break;
    ready = next;
  }
  for (const r of ST.uc.results.values()) r.section = sectionOf(r, ready);
  ST.uc.ticked = new Set(ready);
  if ([...ST.uc.results.values()].filter((r) => r.section === "error").length > 5) ST.uc.open.delete("error");
  syncMarks();
}

function finishCheck() {
  applyCheck(answersFor(UPD_SCENE));
  ST.uc.checkedAt = Date.now();
  ST.uc.checkedOne.clear();
  ST.uc.checking = null;
}

/** The cards' arrow chips follow the check. */
function syncMarks() {
  Object.keys(UPDATES).forEach((k) => delete UPDATES[k]);
  for (const r of ST.uc.results.values()) if (["ready", "attention"].includes(r.section)) UPDATES[r.id] = r.to;
}

function startCheck() {
  if (ST.uc.checking || ST.uc.job) return;
  const list = checkable();
  ST.uc.checking = { done: 0, total: list.length, current: list[0]?.title ?? "" };
  ST.uc.summary = null;
  render();
  const step = () => {
    const c = ST.uc.checking;
    if (!c) return;
    c.done = Math.min(c.total, c.done + 2);
    c.current = list[Math.min(c.done, list.length - 1)]?.title ?? "";
    if (c.done < c.total) { renderSoon(); setTimeout(step, 70); return; }
    finishCheck();
    render();
  };
  setTimeout(step, 70);
}

// ---------- warnings, worked out before anything installs ----------
const tickedOrReady = (id, readyIds) => ST.uc.ticked.has(id) || readyIds?.has(id);
/** The version a package will have after this run: the update's when it is ticked. */
function willHave(id, readyIds) {
  const r = ST.uc.results.get(id);
  return r?.to && tickedOrReady(id, readyIds) ? r.to : verOf(id);
}

function warnings(a, readyIds) {
  const out = [];
  for (const n of a.needs ?? []) {
    if (atLeast(willHave(n.id, readyIds), n.min)) continue;
    const fix = ST.uc.results.get(n.id)?.to;
    out.push({ text: `Needs ${titleOf(n.id)} ${n.min} or newer (you have ${verOf(n.id)}).`, fixes: fix && atLeast(fix, n.min) ? [{ id: n.id, label: `Tick ${shortOf(n.id)} too` }] : [] });
  }
  if (a.sys && !atLeast(willHave(a.sys.id, readyIds), a.sys.min)) {
    const to = ST.uc.results.get(a.sys.id)?.to;
    out.push({ text: `Fits ${titleOf(a.sys.id)} ${a.sys.min} or newer; you have ${verOf(a.sys.id)}${to ? `, and ${to} is available` : ""}.`, fixes: to ? [{ id: a.sys.id, label: `Tick ${shortOf(a.sys.id)} too` }] : [] });
  }
  const left = (a.impact ?? []).filter((d) => !(ST.uc.results.get(d.id)?.sys && tickedOrReady(d.id, readyIds)));
  if (left.length) {
    const fits = left.filter((d) => ST.uc.results.get(d.id)?.to);
    const names = left.map((d) => (ST.uc.results.get(d.id)?.to ? `${titleOf(d.id)} (an update fits ${a.to})` : `${titleOf(d.id)} (no update yet)`));
    out.push({ text: `${plural(left.length, "module")} ${left.length === 1 ? "declares" : "declare"} ${titleOf(a.id)} up to ${left[0].max}: ${names.join(", ")}. ${left.length === 1 ? "It" : "They"} may stop working.`, fixes: fits.map((d) => ({ id: d.id, label: `Tick ${shortOf(d.id)} too` })) });
  }
  return out;
}

function upNotes(a) {
  const out = [];
  for (const n of a.needs ?? []) if (ST.uc.ticked.has(n.id) && !atLeast(verOf(n.id), n.min)) out.push(`Needs ${titleOf(n.id)} ${n.min}: ticked too, and it updates first.`);
  if (a.sys && ST.uc.ticked.has(a.sys.id) && !atLeast(verOf(a.sys.id), a.sys.min)) out.push(`Fits ${titleOf(a.sys.id)} ${a.sys.min}: ticked too, and it updates first.`);
  return out;
}

const isRefused = (a) => !!a.to && ST.uc.refused.get(a.id) === a.to;

/** Why a row can't be updated. Links only go somewhere (a page); doing something is blockAction's button. */
function blockText(a) {
  if (a.core) return `Needs Foundry ${a.core} or newer; you have ${CORE()}. See <a data-act="updpage">Foundry's update</a>.`;
  if (a.missing) return `Needs ${esc(a.missing)}, which isn't installed.`;
  if (a.premium) return "Premium content on foundryvtt.com: your Foundry account doesn't have it. After you buy or renew it, Foundry can take up to 5 minutes to see that.";
  if (a.manifestRefused) return "Its manifest refused access (403). A Patreon or other membership may have ended.";
  if (a.error && (a.tries ?? 1) > 1) return `Still no answer after ${a.tries} tries. Its site may be down: try later, or open its <a data-act="foundry" data-what="Project page (opens the package's own page)">project page</a>.`;
  if (a.error) return "Its manifest didn't answer (Foundry waits 5 seconds).";
  if (isRefused(a)) return "The download was refused (403), so it isn't ticked for you any more.";
  return "";
}

/** The row's own action, as a button: what the owner does about the reason. */
function blockAction(a) {
  if (a.missing) return { act: "foundry", what: "Install Module", icon: "fa-download", label: "Install…", tip: `Opens Foundry's installer for ${esc(a.missing)}` };
  if (a.premium || a.manifestRefused) return { act: "urecheck", icon: "fa-rotate", label: "Check again", tip: "After renewing or buying it: checks this package again" };
  if (a.error) return { act: "uretry", icon: "fa-rotate", label: "Try again", tip: "Checks this package again" };
  if (isRefused(a)) return { act: "uagain", icon: "fa-cloud-arrow-down", label: "Try again", tip: "After renewing your access: installs it now", off: ST.uc.job ? "Waits for the updates running now" : "" };
  return null;
}

const actButton = (a, b) => (b ? `<button type="button" class="spu-act" data-act="${b.act}" data-id="${a.id}"${b.what ? ` data-what="${b.what}"` : ""} data-tooltip="${b.off || b.tip}"${b.off ? " disabled" : ""}><i class="fa-solid ${b.icon}"></i>${b.label}</button>` : "");
const warnLine = (w) => `<div class="spu-warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${w.text}</span></div>`;
/** A warning's fixes, as buttons where the row keeps its actions. */
const fixButtons = (ws) => ws.flatMap((w) => w.fixes ?? []).map((f) => actButton({ id: f.id }, { act: "ufix", icon: "fa-check", label: f.label, tip: "Ticks it as well; it updates first" })).join("");

// ---------- the tab ----------
const ucCount = () => [...ST.uc.results.values()].filter((r) => ["ready", "attention"].includes(r.section)).length;

function libTabs() {
  const t = (id, icon, label, c) => `<a class="${ST.lsub === id ? "active" : ""}" data-act="lsub" data-id="${id}"><i class="fa-solid ${icon}"></i>${label} <span class="c">${c}</span></a>`;
  return `<nav class="sts-subtabs">${t("modules", "fa-plug", "Modules", ALL_MODULES.length)}${t("systems", "fa-dice", "Systems", 3)}${t("grid", "fa-table-cells", "By world", WORLDS_X.length)}${updTab()}</nav>`;
}

function updTab() {
  const j = ST.uc.job, n = ucCount();
  const c = j ? `<span class="c spu-tabjob"><i class="fa-solid fa-spinner fa-spin"></i>${Math.min(j.done + 1, j.total)}/${j.total}</span>`
    : ST.uc.checking ? '<span class="c"><i class="fa-solid fa-spinner fa-spin"></i></span>'
      : `<span class="c">${n ? `<b class="w">${n}</b>` : 0}</span>`;
  return `<a class="${ST.lsub === "updates" ? "active" : ""}" data-act="lsub" data-id="updates"><i class="fa-solid fa-cloud-arrow-down"></i>Updates ${c}</a>`;
}

function updHead() {
  const c = ST.uc.checking;
  if (c) {
    const pct = Math.round((c.done / c.total) * 100);
    return `<div class="spu-head busy" role="status"><div class="t"><strong>Checking ${c.done} of ${c.total}</strong><span>${esc(c.current)}</span></div>
      <div class="spu-bar"><span style="width:${pct}%"></span></div><button type="button" data-act="ustop">Stop</button></div>`;
  }
  const n = ucCount(), total = checkable().length, others = [...ST.uc.results.values()].some((r) => r.section !== "updated");
  const lead = UPD_SCENE === "offline" ? '<i class="fa-solid fa-triangle-exclamation warn"></i><span><strong>Couldn\'t check</strong>' : n ? `<i class="fa-solid fa-cloud-arrow-down"></i><span><strong>${plural(n, "update")}</strong>` : others ? '<i class="fa-solid fa-circle-check ok"></i><span><strong>Nothing to install now</strong>' : '<i class="fa-solid fa-circle-check ok"></i><span><strong>Everything is up to date</strong>';
  return `<div class="spu-head"><div class="t">${lead} · checked ${ago(ST.uc.checkedAt)} · ${plural(total, "package")}</span></div>
    <button type="button" data-act="ucheck"${ST.uc.job ? " disabled" : ""}><i class="fa-solid fa-rotate"></i>Check again</button></div>`;
}

function updSummary() {
  const s = ST.uc.summary;
  if (!s) return "";
  const bits = [`${plural(s.ok.length, "package")} updated`, s.failed.length ? `${s.failed.length} failed` : ""].filter(Boolean).join(" · ");
  const bk = s.backups ? ` Backups of ${plural(s.ok.length + s.failed.length, "package")} are in <a data-act="srvbackups">Backups › Modules</a>.` : "";
  return `<div class="spu-sum ${s.failed.length ? "warn" : "ok"}" role="status"><i class="fa-solid ${s.failed.length ? "fa-triangle-exclamation" : "fa-circle-check"}"></i>
    <span><strong>${bits}.</strong>${bk}</span><button type="button" class="icon" data-act="usumclose" aria-label="Close" data-tooltip="Close"><i class="fa-solid fa-xmark"></i></button></div>`;
}

function rowState(id) {
  if (ST.uc.single.has(id)) return '<span class="spu-st"><i class="fa-solid fa-spinner fa-spin"></i>Checking…</span>';
  const s = ST.uc.job?.rows.get(id);
  if (!s) return "";
  if (s.state === "queued") return '<span class="spu-st q">Waiting</span>';
  if (s.state === "backup") return '<span class="spu-st"><i class="fa-solid fa-floppy-disk"></i>Backing up</span>';
  if (s.state === "install") return '<span class="spu-st"><i class="fa-solid fa-spinner fa-spin"></i>Installing</span>';
  if (s.state === "done") return '<span class="spu-st ok"><i class="fa-solid fa-circle-check"></i>Updated</span>';
  if (s.state === "failed") return `<span class="spu-st bad"><i class="fa-solid fa-circle-xmark"></i>${esc(s.error)}</span>`;
  return `<span class="spu-st dl"><span class="spu-bar"><span style="width:${s.pct}%"></span></span>Downloading ${s.pct}%</span>`;
}

function worldsLine(id) {
  if (upIsSystem(id)) return `Used by ${esc(sysOf(id).used)}`;
  const n = WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, id)).length;
  return n ? `On in ${plural(n, "world")}` : "In no world";
}

function updRow(r) {
  const job = ST.uc.job, canTick = ["ready", "attention"].includes(r.section) && !job;
  const tick = ["ready", "attention"].includes(r.section) ? `<input type="checkbox" class="spu-tick" data-act="utick" data-id="${r.id}" ${ST.uc.ticked.has(r.id) ? "checked" : ""}${canTick ? "" : " disabled"} aria-label="Update ${titleOf(r.id)}">` : "<span></span>";
  const ver = r.to ? `<span class="spu-ver">${r.from} <i class="fa-solid fa-arrow-right"></i> <b>${r.to}</b></span>` : `<span class="spu-ver">${r.from}</span>`;
  const badge = !r.to || ["blocked", "noaccess", "error"].includes(r.section) ? "" : r.unverified ? `<span class="sts-badge warn" data-tooltip="Foundry installs it; its author hasn't confirmed this build"><i class="fa-solid fa-code-branch"></i>not verified for ${CORE()}</span>` : `<span class="sts-badge ok"><i class="fa-solid fa-code-branch"></i>verified for ${CORE()}</span>`;
  const live = ["ready", "attention"].includes(r.section) && ST.uc.ticked.has(r.id) ? warnings(r) : r.section === "attention" ? warnings(r) : [];
  const warn = live.map(warnLine).join("");
  const note = ST.uc.ticked.has(r.id) ? upNotes(r).map((t) => `<div class="spu-note"><i class="fa-solid fa-link"></i><span>${t}</span></div>`).join("") : "";
  const why = ["blocked", "noaccess", "error"].includes(r.section) ? `<div class="spu-why ${r.section}"><i class="fa-solid ${r.section === "error" ? "fa-circle-exclamation" : r.section === "noaccess" ? "fa-lock" : "fa-ban"}"></i><span>${blockText(r)}</span></div>` : "";
  const cls = [ST.uc.ticked.has(r.id) && canTick ? "ticked" : "", ["blocked", "noaccess", "error"].includes(r.section) ? "muted" : "", ["backup", "download", "install"].includes(job?.rows.get(r.id)?.state) || ST.uc.single.has(r.id) ? "busy" : "", ST.uc.fresh.has(r.id) ? "fresh" : ""].filter(Boolean).join(" ");
  return `<li class="spu-row ${cls}" data-id="${r.id}">${tick}<i class="fa-solid ${upIsSystem(r.id) ? "fa-dice" : "fa-plug"} spu-kind" data-tooltip="${upIsSystem(r.id) ? "System" : "Module"}"></i>
    <div class="spu-main"><div class="l1"><a class="t" data-act="uopen" data-id="${r.id}">${titleOf(r.id)}</a>${ver}${badge}</div>
      <div class="l2">${worldsLine(r.id)}${r.to ? ` · <a data-act="foundry" data-what="Changelog (opens the package's own page)">Changelog</a>` : ""}</div>${warn}${note}${why}</div>
    <div class="spu-side">${r.section === "updated" ? '<span class="spu-st ok"><i class="fa-solid fa-circle-check"></i>Updated</span>' : rowState(r.id) || actButton(r, blockAction(r)) || (job ? "" : fixButtons(live))}</div></li>`;
}

function updSections() {
  const rows = [...ST.uc.results.values()];
  return SECTIONS.map(([key, label]) => {
    const list = rows.filter((r) => r.section === key);
    if (!list.length) return "";
    const open = ST.uc.open.has(key);
    const all = ["ready", "attention"].includes(key) && !ST.uc.job ? `<a data-act="utickall" data-id="${key}">${list.every((r) => ST.uc.ticked.has(r.id)) ? "Untick all" : "Tick all"}</a>` : "";
    return `<li class="spu-sec ${key}"><header class="spu-sh" data-act="ufold" data-id="${key}"><i class="fa-solid fa-angle-${open ? "down" : "right"}"></i><span>${label}</span><span class="c">${list.length}</span><span class="st-spacer"></span>${all}</header>
      ${open ? `<ul class="spu-rows">${list.map(updRow).join("")}</ul>` : ""}</li>`;
  }).join("");
}

function updFoot() {
  const j = ST.uc.job;
  if (j) {
    const pct = Math.round((j.progress / j.total) * 100);
    return `<footer class="spu-foot busy" role="status"><strong>${j.phase === "backup" ? `Backing up ${plural(j.total, "package")}` : `Updating ${Math.min(j.done + 1, j.total)} of ${j.total}`} · ${pct}%</strong>
      <div class="spu-bar"><span style="width:${pct}%"></span></div><span class="st-muted">Worlds wait until it's done.</span></footer>`;
  }
  const n = ST.uc.ticked.size;
  if (!ucCount()) return "";
  return `<footer class="spu-foot"><label class="spu-bfirst" data-tooltip="Foundry's own backup of each ticked package, restorable from Backups"><input type="checkbox" data-act="ubackup" ${ST.uc.backup ? "checked" : ""}>Back up first</label>
    <span class="st-spacer"></span><span class="st-muted">${n ? `${plural(n, "package")} ticked` : "Tick what to update"}</span>
    <button type="button" class="bright" data-act="ugo"${n ? "" : " disabled"}><i class="fa-solid fa-cloud-arrow-down"></i>Update${n ? ` ${n}` : ""}</button></footer>`;
}

function updatesBody() {
  const locked = [...ALL_MODULES, ...SYSTEMS].filter((p) => ST.lock.has(p.id));
  const lockLine = locked.length ? `<li class="spu-locked"><i class="fa-solid fa-lock"></i>${plural(locked.length, "locked package")} ${locked.length === 1 ? "isn't" : "aren't"} checked: ${locked.map((p) => esc(p.title)).join(", ")}. Foundry's lock keeps it as it is.</li>` : "";
  const empty = !ST.uc.results.size && !ST.uc.checking ? `<li class="spu-empty"><i class="fa-solid fa-mug-hot"></i><p>Nothing to update: every module and system has its newest version for Foundry ${CORE()}. Opening this tab checks again after an hour.</p></li>` : "";
  return `<div class="spu">${updHead()}${updSummary()}<ol class="spu-list scrollable">${updSections()}${empty}${lockLine}</ol>${updFoot()}</div>`;
}

// ---------- updating ----------
/** Systems and libraries first, then what needs them. */
function installOrder(ids) {
  const needed = new Set([...ids].flatMap((id) => { const r = ST.uc.results.get(id); return [...(r.needs ?? []).map((n) => n.id), r.sys?.id].filter(Boolean); }));
  const rank = (id) => (upIsSystem(id) ? 0 : needed.has(id) ? 1 : 2);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

function startUpdate(ids) {
  if (ST.uc.job || !ids.length) return;
  const queue = installOrder(ids);
  ST.uc.job = { total: queue.length, done: 0, progress: 0, phase: ST.uc.backup ? "backup" : "install", rows: new Map(queue.map((id) => [id, { state: ST.uc.backup ? "backup" : "queued", pct: 0 }])), queue, ok: [], failed: [] };
  ST.uc.summary = null;
  render();
  setTimeout(ST.uc.backup ? backupTick : installNext, 120);
}

function backupTick() {
  const j = ST.uc.job;
  j.progress = Math.min(j.total, j.progress + j.total / 8);
  if (j.progress < j.total) { renderSoon(); setTimeout(backupTick, 140); return; }
  j.phase = "install"; j.progress = 0;
  j.rows.forEach((s) => { s.state = "queued"; });
  renderSoon();
  setTimeout(installNext, 150);
}

function installNext() {
  const j = ST.uc.job;
  const id = j.queue[j.done];
  if (!id) { finishUpdate(); return; }
  const s = j.rows.get(id), r = ST.uc.results.get(id);
  s.state = "download";
  const tick = () => {
    s.pct = Math.min(100, s.pct + 9);
    j.progress = j.done + s.pct / 125;
    if (r.refuseDownload && s.pct >= 27) { s.state = "failed"; s.error = "Download refused (403)"; j.failed.push(id); ST.uc.refused.set(id, r.to); j.done++; j.progress = j.done; renderSoon(); setTimeout(installNext, 250); return; }
    if (s.pct < 100) { renderSoon(); setTimeout(tick, 80); return; }
    s.state = "install"; renderSoon();
    setTimeout(() => { s.state = "done"; j.ok.push(id); j.done++; j.progress = j.done; renderSoon(); setTimeout(installNext, 200); }, 450);
  };
  renderSoon();
  setTimeout(tick, 80);
}

function finishUpdate() {
  const j = ST.uc.job;
  for (const id of j.ok) {
    const r = ST.uc.results.get(id);
    upPkg(id).version = r.to;
    r.section = "updated";
    ST.uc.ticked.delete(id);
  }
  for (const id of j.failed) { ST.uc.results.get(id).section = "noaccess"; ST.uc.ticked.delete(id); }
  // A system or library that moved past what a module declares: Foundry marks that module with a warning.
  for (const id of j.ok) {
    for (const d of ST.uc.results.get(id).impact ?? []) {
      const fixed = j.ok.includes(d.id) && ST.uc.results.get(d.id)?.sys;
      if (!fixed) ST.uc.outOfRange.set(d.id, `Declares ${shortOf(id)} up to ${d.max}; you have ${upPkg(id).version}`);
    }
  }
  ST.uc.summary = { ok: j.ok, failed: j.failed, backups: ST.uc.backup };
  ST.uc.job = null;
  syncMarks();
  render();
  if (!(ST.page === "library" && ST.lsub === "updates")) notify(j.failed.length ? `${plural(j.ok.length, "package")} updated, ${j.failed.length} failed.` : `${plural(j.ok.length, "package")} updated.`, j.failed.length ? "warning" : "info");
}

// ---------- one package: the panel's Update box ----------
function updateBox(m) {
  const id = m.id, r = ST.uc.results.get(id), s = ST.uc.job?.rows.get(id);
  const when = ST.uc.checkedOne.get(id) ?? ST.uc.checkedAt;
  const head = (text, cls = "") => `<div class="spu-box ${cls}"><h4><span>Update</span>${!ST.uc.single.has(id) && !s ? `<span class="st-muted">checked ${ago(when)}</span>` : ""}</h4>${text}</div>`;
  if (ST.lock.has(id)) return head('<p><i class="fa-solid fa-lock"></i> Updates are locked: Foundry keeps it as it is. Turn off "Lock updates" below to check.</p>');
  if (s) return head(`<p><strong>${r.from} → ${r.to}</strong></p>${rowState(id)}`, "busy");
  if (ST.uc.single.has(id)) return head('<p><i class="fa-solid fa-spinner fa-spin"></i> Checking its manifest…</p>');
  const checkBtn = actButton(m, { act: "ucheckone", icon: "fa-rotate", label: "Check again", tip: "Checks this package's manifest" });
  if (!r || r.section === "updated") return head(`<div class="spu-boxacts"><p class="spu-uptodate"><i class="fa-solid fa-circle-check"></i> Up to date${r ? `: updated to ${r.to} just now` : ""}.</p>${checkBtn}</div>`);
  if (["blocked", "noaccess", "error"].includes(r.section)) return head(`<div class="spu-why ${r.section}"><i class="fa-solid ${r.section === "noaccess" ? "fa-lock" : r.section === "error" ? "fa-circle-exclamation" : "fa-ban"}"></i><span>${blockText(r)}</span></div><div class="spu-boxacts end">${actButton(r, blockAction(r)) || checkBtn}</div>`);
  // No tick buttons here: this box updates one package, so its confirmation offers the fix instead.
  const warn = warnings(r).map(warnLine).join("");
  return head(`<p><strong>${r.to}</strong> is available · you have ${r.from} · <a data-act="foundry" data-what="Changelog (opens the package's own page)">Changelog</a></p>${warn}
    <div class="spu-boxacts"><label class="spu-bfirst"><input type="checkbox" data-act="ubackup" ${ST.uc.backup ? "checked" : ""}>Back up first</label>
    <button type="button" class="bright" data-act="ugoone" data-id="${id}"${ST.uc.job ? " disabled" : ""}><i class="fa-solid fa-cloud-arrow-down"></i>Update to ${r.to}</button></div>`);
}

// ---------- hooks into the page ----------
// ---------- asking before an update that may break something ----------
/** The warnings each package in a run would leave, judged on that run alone. */
function risksOf(ids) {
  const keep = ST.uc.ticked;
  ST.uc.ticked = new Set(ids);
  const out = ids.map((id) => ({ id, ws: warnings(ST.uc.results.get(id)) })).filter((x) => x.ws.length);
  ST.uc.ticked = keep;
  return out;
}

function askOrStart(ids) {
  if (ST.uc.job || !ids.length) return;
  const risks = risksOf(ids);
  if (!risks.length) { startUpdate(ids); return; }
  ST.uc.pending = { ids, risky: risks.map((x) => x.id), risks };
  ST.uc.lastRisks = risks;
  ST.dialog = "updconfirm";
  render();
}

function confirmDialog() {
  if (ST.dialog !== "updconfirm" || !ST.uc.pending) return "";
  const { ids, risks } = ST.uc.pending, n = ids.length, others = n - risks.length;
  const affected = (r) => (ST.uc.results.get(r.id).impact ?? []).filter((d) => !(ids.includes(d.id) && ST.uc.results.get(d.id)?.sys));
  const where = (r) => affected(r).map((d) => { const k = WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, d.id)).length; return k ? `${shortOf(d.id)} is on in ${plural(k, "world")}.` : `${shortOf(d.id)} is in no world.`; }).join(" ");
  const list = risks.map((r) => `<div class="sts-check warn"><i class="fa-solid fa-triangle-exclamation"></i><span><strong>${titleOf(r.id)} ${ST.uc.results.get(r.id).to}</strong>: ${r.ws.map((w) => w.text).join(" ")} ${where(r)}</span></div>`).join("");
  const lead = n === 1 ? "It may break something:" : `${risks.length === 1 ? "One of them" : `${risks.length} of them`} may break something:`;
  const backup = ST.uc.backup ? "Back up first is on: each package can be restored from Backups." : "Back up first is off: there will be no copy to go back to.";
  const body = `<div class="sts-launch-body spu-confirm"><p>${lead}</p>${list}<p class="st-muted">${backup} Foundry marks a module outside its declared versions with a warning; it still loads.</p></div>`;
  const fixIds = [...new Set(risks.flatMap((r) => r.ws.flatMap((w) => (w.fixes ?? []).map((f) => f.id))))].filter((id) => !ids.includes(id));
  const allFixable = fixIds.length && risks.every((r) => r.ws.every((w) => w.fixes?.length));
  // The highlighted choice is the safest one that still updates: adding the fix, else leaving the risky
  // ones out; "anyway" is highlighted only when nothing safer exists.
  const btn = (id, label, bright) => `<button type="button"${bright ? ' class="bright"' : ""} data-act="uconfirm" data-id="${id}">${bright ? '<i class="fa-solid fa-cloud-arrow-down"></i>' : ""}${label}</button>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button>`
    + btn("all", others ? `Update all ${n} anyway` : "Update anyway", !allFixable && !others)
    + (others ? btn("others", `Update the other ${others}`, !allFixable) : "")
    + (allFixable ? btn("withfix", `Also update ${fixIds.map(shortOf).join(", ")}`, true) : "");
  const x = Math.round(innerWidth / 2 - 280), y = Math.max(80, Math.round(innerHeight / 2 - 200));
  return `<div class="sts-backdrop" data-act="closedialog"></div>${fwindow({ title: n === 1 ? `Update ${titleOf(ids[0])}?` : `Update ${plural(n, "package")}?`, icon: "fa-solid fa-cloud-arrow-down", x, y, w: 560, body, footer, cls: "sts-dialog" })}`;
}

// The page redraws on every change; the Updates list keeps its scroll, and a row that just became
// available is brought into view (at once: a smooth scroll wouldn't survive the next redraw).
const renderBase = render;
// eslint-disable-next-line no-func-assign
render = function () {
  const top = document.querySelector(".spu-list")?.scrollTop;
  renderBase();
  const list = document.querySelector(".spu-list");
  if (list && top !== undefined) list.scrollTop = top;
  if (ST.uc.reveal) { document.querySelector(`.spu-row[data-id="${ST.uc.reveal}"]`)?.scrollIntoView({ block: "nearest" }); ST.uc.reveal = null; }
  if (ST.dialog === "updconfirm") document.body.insertAdjacentHTML("beforeend", confirmDialog());
};

const libraryPageBase = libraryPage;
// eslint-disable-next-line no-func-assign
libraryPage = function () {
  if (ST.lsub === "updates") {
    if (!ST.uc.checking && !ST.uc.job && Date.now() - ST.uc.checkedAt > HOUR) setTimeout(startCheck, 0);
    return `<section id="setup-packages" class="application framed sts-main spu-page"><div class="sts-body-main">${libTabs()}${updatesBody()}</div></section>${libraryPanel()}`;
  }
  return libraryPageBase()
    .replace(/<nav class="sts-subtabs">[\s\S]*?<\/nav>/, libTabs())
    .replace(/<button type="button" data-act="foundry" data-what="Update All">[\s\S]*?<\/button>/, "");
};

const libCardBase = libCard;
// eslint-disable-next-line no-func-assign
libCard = function (m, o) {
  let html = libCardBase(m, o);
  const out = ST.uc.outOfRange.get(m.id), s = ST.uc.job?.rows.get(m.id);
  if (out) html = html.replace(/<div class="l2[^"]*">[\s\S]*?<\/div>/, `<div class="l2 warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${out}</span></div>`);
  if (!s) return html;
  const label = s.state === "download" ? `${s.pct}%` : s.state === "done" ? "done" : s.state === "failed" ? "failed" : s.state === "install" ? "installing" : s.state === "backup" ? "backup" : "waiting";
  const chip = `<span class="stw-upd spu-chip ${s.state}" data-tooltip="${s.state === "failed" ? esc(s.error) : `Updating to ${ST.uc.results.get(m.id).to}`}"><i class="fa-solid ${s.state === "failed" ? "fa-circle-xmark" : s.state === "done" ? "fa-check" : ["download", "install"].includes(s.state) ? "fa-spinner fa-spin" : "fa-clock"}"></i>${label}</span>`;
  return /<button type="button" class="stw-upd"[\s\S]*?<\/button>/.test(html) ? html.replace(/<button type="button" class="stw-upd"[\s\S]*?<\/button>/, chip) : html.replace(/(<div class="l1">[\s\S]*?)(<\/div>)/, `$1${chip}$2`);
};

const packageInfoBase = packageInfo;
// eslint-disable-next-line no-func-assign
packageInfo = function (m, kind) {
  return updateBox(m) + packageInfoBase(m, kind).replace(/<button type="button" data-act="foundry" data-what="Update if available">[\s\S]*?<\/button>/, "");
};

const railBase = rail;
// eslint-disable-next-line no-func-assign
rail = function () {
  const j = ST.uc.job;
  const line = j ? `<span class="spu-rail"><i class="fa-solid fa-spinner fa-spin"></i>Updating ${Math.min(j.done + 1, j.total)} of ${j.total}…</span>`
    : ST.uc.checking ? `<span class="spu-rail"><i class="fa-solid fa-spinner fa-spin"></i>Checking for updates…</span>`
      : `<span>${ALL_MODULES.length} modules · 3 systems · ${plural(ucCount(), "update")}</span>`;
  return railBase().replace(/<span>\d+ modules · 3 systems · 2 updates<\/span>/, line);
};

// ---------- actions ----------
A.pkgupdate = (id) => { ST.page = "library"; ST.panel = upIsSystem(id) ? { kind: "system", id } : { kind: "module", id }; ST.mtab = "package"; render(); };
A.ucheck = () => startCheck();
A.ustop = () => { ST.uc.checking = null; render(); notify("Stopped. The list shows the last full check."); };
A.utick = (id) => { ST.uc.ticked.has(id) ? ST.uc.ticked.delete(id) : ST.uc.ticked.add(id); render(); };
A.utickall = (key) => { const ids = [...ST.uc.results.values()].filter((r) => r.section === key).map((r) => r.id); const all = ids.every((id) => ST.uc.ticked.has(id)); ids.forEach((id) => (all ? ST.uc.ticked.delete(id) : ST.uc.ticked.add(id))); render(); };
A.ufix = (id) => { ST.uc.ticked.add(id); render(); };
A.ufold = (key, _el, e) => { if (e?.target.closest("a")) return; ST.uc.open.has(key) ? ST.uc.open.delete(key) : ST.uc.open.add(key); render(); };
A.ubackup = () => { ST.uc.backup = !ST.uc.backup; render(); };
A.ugo = () => askOrStart([...ST.uc.ticked]);
A.ugoone = (id) => askOrStart([id]);
A.uconfirm = (mode) => {
  const { ids, risky } = ST.uc.pending ?? { ids: [], risky: [] };
  ST.dialog = null; ST.uc.pending = null;
  if (mode === "withfix") {
    // The fixes join the run, which is judged again: they may have warnings of their own.
    const fixes = (ST.uc.lastRisks ?? []).flatMap((r) => r.ws.flatMap((w) => (w.fixes ?? []).map((f) => f.id)));
    askOrStart([...new Set([...ids, ...fixes])]);
    return;
  }
  if (mode === "others") risky.forEach((id) => ST.uc.ticked.delete(id));
  startUpdate(mode === "others" ? ids.filter((id) => !risky.includes(id)) : ids);
};
A.usumclose = () => { ST.uc.summary = null; render(); };
A.uopen = (id) => A.pkgupdate(id);
/** One package's check again. The sample finds its update (as if the access was renewed or its site came back), except offline. */
function recheck(id) {
  const r = ST.uc.results.get(id);
  if (!r || ST.uc.single.has(id)) return;
  ST.uc.single.add(id); render();
  setTimeout(() => {
    ST.uc.single.delete(id); ST.uc.checkedOne.set(id, Date.now());
    if (UPD_SCENE === "offline" || !r.later) { r.tries = (r.tries ?? 1) + 1; render(); return; }
    const now = { id, to: r.later, from: r.from, section: "ready" };
    ST.uc.results.set(id, now);
    becameReady(id);
  }, 1100);
}
/** A row that can be updated now: ticked, marked for a moment, counted. */
function becameReady(id) {
  ST.uc.ticked.add(id); ST.uc.fresh.add(id); ST.uc.open.add("ready"); ST.uc.reveal = id; syncMarks(); render();
  setTimeout(() => { ST.uc.fresh.delete(id); render(); }, 2200);
}
A.uretry = (id) => recheck(id);
A.urecheck = (id) => recheck(id);
/** A refused download, after renewing: install it now. Remembering the refusal only stopped the automatic tick. */
A.uagain = (id) => {
  if (ST.uc.job) { notify("It joins when the updates running now have finished. Try again then."); return; }
  const r = ST.uc.results.get(id);
  ST.uc.refused.delete(id); r.refuseDownload = false; r.section = "ready";
  becameReady(id);
  startUpdate([id]);
};
A.ucheckone = (id) => {
  ST.uc.single.add(id); render();
  setTimeout(() => { ST.uc.single.delete(id); ST.uc.checkedOne.set(id, Date.now()); render(); }, 900);
};

// The check that ran two hours ago (kept per server), so the cards show its marks before the tab opens.
applyCheck(answersFor(UPD_SCENE));
if (Q.get("lsub") === "updates") { ST.page = "library"; ST.lsub = "updates"; }
