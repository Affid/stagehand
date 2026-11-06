// ---------- Ideas from the UX review: the modules x worlds grid, review at launch,
// intake for new installs, copying a world's module set, and problem flags per world. ----------

/** "?review=launch": no permanent Next launch column; changes are reviewed when you press Launch. */
const REVIEW_AT_LAUNCH = Q.get("review") === "launch" || Q.get("calm") === "1";

// Modules installed since the library was last sorted. They start in no world, folder or tag.
const LATE = new Set(["modular-av-livekit-krisp", "dice-so-nice", "sequencer"]);
const MORE_INSTALLS = ["item-piles", "monks-tokenbar", "tidy5e-sheet"];
function addInstalled(id) {
  const m = EXTRA_MODULES.find((x) => x.id === id);
  if (!m || MOD[id]) return;
  ALL_MODULES.push(m);
  ALL_MODULES.sort((a, b) => a.title.localeCompare(b.title));
  MOD[id] = m;
}
LATE.forEach((id) => { addInstalled(id); delete FOLDER_OF[id]; delete TAGS_OF[id]; });
ST.fresh = new Set(LATE);
ST.intakeFolder = {};
ST.copy = null;
ST.dialog = null;

// ---------- problems across worlds ----------
const worldProblems = (wid) => (world(wid)?.noCompanion ? [] : problems(wid));
function warnIfBroken(wid) {
  const probs = worldProblems(wid);
  if (probs.length) notify(`${esc(world(wid).title)} now has ${plural(probs.length, "problem")}: ${esc(probs[0].text)} Open it to fix.`, "warning");
}
function railFlag(w) {
  if (w.noCompanion) return w.att ? `<span class="flag a" data-tooltip="${esc(w.att)}"><i class="fa-solid fa-triangle-exclamation"></i></span>` : "<span></span>";
  const n = diff(w.id).length, probs = problems(w.id);
  if (probs.length) return `<span class="flag p" data-tooltip="${esc(probs.map((p) => p.text).join(" "))}"><i class="fa-solid fa-triangle-exclamation"></i>${n ? `${n} queued` : "problem"}</span>`;
  if (n) return `<span class="flag q" data-tooltip="Changes for the next launch">${n} queued</span>`;
  return w.att ? `<span class="flag a" data-tooltip="${esc(w.att)}"><i class="fa-solid fa-triangle-exclamation"></i></span>` : "<span></span>";
}

// ---------- the modules x worlds grid (Library > By world) ----------
function gridColHead(w) {
  const n = w.noCompanion ? 0 : diff(w.id).length, probs = worldProblems(w.id);
  const sub = w.noCompanion ? '<span class="ml-muted">companion off</span>'
    : `${onCount(w.id)} on${n ? ` · <b class="q">${n} queued</b>` : ""}${probs.length ? ` <i class="fa-solid fa-triangle-exclamation warn" data-tooltip="${esc(probs.map((p) => p.text).join(" "))}"></i>` : ""}`;
  return `<th class="w${w.noCompanion ? " na" : ""}" scope="col"><div class="wh">
    <a data-act="world" data-id="${w.id}" data-tooltip="Open ${esc(w.title)}"><span class="thumb" style="--img:url(${IMG[w.img]});background-position:${w.pos}"></span><span class="t">${esc(w.title)}</span></a>
    ${w.noCompanion ? "" : `<button type="button" class="ml-hbtn" data-act="gcolmenu" data-id="${w.id}" aria-label="${esc(w.title)}: actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>`}</div>
    <div class="sub">${sub}</div></th>`;
}

function gridCell(w, m, probIds) {
  if (w.noCompanion) return `<td class="na"><span data-tooltip="The companion is off there, so its modules are unknown">–</span></td>`;
  const now = desired(w.id, m.id), was = baseOn(w.id, m.id);
  const delta = now === was ? "" : now ? "plus" : "minus";
  const prob = probIds.get(m.id);
  const tip = prob ? prob : delta ? `${now ? "Turns on" : "Turns off"} at ${w.title}'s next launch` : `${now ? "On" : "Off"} in ${w.title}`;
  return `<td class="${delta}${prob ? " prob" : ""}"><input type="checkbox" class="mls-switch" data-act="gcell" data-id="${w.id}" data-mid="${m.id}" ${now ? "checked" : ""} aria-label="${esc(m.title)} in ${esc(w.title)}" data-tooltip="${esc(tip)}"></td>`;
}

function gridGroupRow(g) {
  const collapsed = ST.collapsed.has(g.key);
  const style = g.color && g.kind === "folder" ? `--sidebar-folder-color:${g.color}` : g.color ? `--ml-c:${g.color}` : "";
  const cells = worldOrder().map((w) => {
    if (w.noCompanion || !g.modules.length) return '<td class="na"></td>';
    const on = g.modules.filter((m) => desired(w.id, m.id)).length;
    const all = on === g.modules.length;
    return `<td><button type="button" class="mls-gcount${all ? " full" : on ? " some" : ""}" data-act="gridgroup" data-id="${esc(g.key)}" data-wid="${w.id}" data-tooltip="Turn all ${all ? "off" : "on"} in ${esc(w.title)}">${on}/${g.modules.length}</button></td>`;
  }).join("");
  return `<tr class="grp ${g.kind}" data-group="${esc(g.key)}" style="${style}"><th scope="rowgroup" data-act="collapse" data-id="${esc(g.key)}" aria-expanded="${!collapsed}">
    <i class="fa-solid fa-chevron-${collapsed ? "right" : "down"} fa-fw"></i><i class="fa-solid ${g.kind === "tag" ? "fa-tag" : g.icon} fa-fw gi"></i><span>${esc(g.name)}</span><span class="ml-muted">${g.modules.length}</span></th>${cells}</tr>`;
}

/** Columns never get narrower than this: past it the grid scrolls sideways, names pinned on the left. */
const GRID_COL_MIN = 92, GRID_MOD_W = 250;
function gridBody() {
  const probIds = new Map(WORLDS_X.map((w) => [w.id, new Map(worldProblems(w.id).map((p) => [p.id, p.text]))]));
  const rows = groupsFor(ST.group, ALL_MODULES).map((g) => {
    const head = gridGroupRow(g);
    if (ST.collapsed.has(g.key)) return head;
    return head + g.modules.map((m) => {
      const viewing = ST.panel?.kind === "module" && ST.panel.id === m.id;
      const tags = tagsOf(m.id).slice(0, 3).map((t) => `<i class="ml-dot" style="--ml-c:${t.color}" data-tooltip="Tag: ${esc(t.name)}"></i>`).join("");
      return `<tr data-mid="${m.id}" class="${viewing ? "viewing" : ""}"><th scope="row" data-act="gridmod" data-id="${m.id}"><div class="mh"><span class="t">${esc(m.title)}</span>${ST.fresh.has(m.id) ? '<span class="mls-newtag">New</span>' : ""}<span class="dots">${tags}</span></div></th>
        ${worldOrder().map((w) => gridCell(w, m, probIds.get(w.id))).join("")}</tr>`;
    }).join("");
  }).join("");
  const queued = WORLDS_X.filter((w) => !w.noCompanion && diff(w.id).length);
  const legend = `<div class="mls-gridlegend"><span><i class="sw plus"></i>turns on at the next launch</span><span><i class="sw minus"></i>turns off</span><span><i class="sw prob"></i>needs attention</span>
    <span class="ml-spacer"></span><span>${queued.length ? `${plural(queued.length, "world")} change${queued.length === 1 ? "s" : ""} at ${queued.length === 1 ? "its" : "their"} next launch: ${queued.map((w) => `<a data-act="world" data-id="${w.id}">${esc(w.title)}</a>`).join(", ")}` : "Nothing queued."}</span></div>`;
  return `<div class="ml-row">${groupSelect()}<input type="search" data-filter="grid" value="${esc(ST.q)}" placeholder="Filter modules"><span class="ml-spacer"></span>
    <span class="ml-muted" style="font-size:12px">Click a name for details, a switch to queue a change, a world to open it.</span></div>
    <div class="mls-gridwrap"><table class="mls-grid" style="min-width:${GRID_MOD_W + worldOrder().length * GRID_COL_MIN}px"><colgroup><col class="mod">${worldOrder().map(() => "<col>").join("")}</colgroup>
    <thead><tr><th class="mod" scope="col">Module</th>${worldOrder().map(gridColHead).join("")}</tr></thead><tbody>${rows}</tbody></table></div>${legend}`;
}

A.gcell = (wid, el) => { setDesired(wid, el.dataset.mid, !desired(wid, el.dataset.mid)); render(); warnIfBroken(wid); };
A.gridgroup = (key, el) => {
  const wid = el.dataset.wid, g = groupsFor(ST.group, ALL_MODULES).find((x) => esc(x.key) === key);
  const ids = g?.modules.map((m) => m.id) ?? [];
  const on = !ids.every((id) => desired(wid, id));
  ids.forEach((id) => { if (on || id !== "module-library") setDesired(wid, id, on); });
  render(); warnIfBroken(wid);
};
A.gridmod = (id) => { ST.panel = ST.panel?.id === id ? null : { kind: "module", id }; ST.mtab = "library"; render(); };
A.gcolmenu = (wid, el) => { openPop("gcolmenu", el, { wid }); render(); };
A.gdiscard = () => { const wid = ST.pop.wid; [...ST.changes.keys()].filter((k) => k.startsWith(`${wid}:`)).forEach((k) => ST.changes.delete(k)); ST.presetQueue[wid] = []; ST.pop = null; render(); notify(`Discarded the queued changes for ${esc(world(wid).title)}.`); };
A.copyto = () => { ST.pop = { ...ST.pop, kind: "copyto" }; render(); };
A.docopyto = (to) => { const from = ST.pop.wid; A.world(to); startCopy(from, to); };

// ---------- copy a world's module set ----------
function startCopy(from, to) {
  ST.copy = { from, to, mode: "match", skip: new Set() };
  ST.panel = { kind: "copy" };
  ST.pop = null;
  render();
}
function copyPlan() {
  const { from, to, mode, skip } = ST.copy;
  const differs = ALL_MODULES.filter((m) => desired(from, m.id) !== desired(to, m.id) && !(m.id === "module-library"));
  const on = differs.filter((m) => desired(from, m.id));
  const off = mode === "match" ? differs.filter((m) => !desired(from, m.id)) : [];
  const same = ALL_MODULES.length - differs.length;
  const picked = [...on, ...off].filter((m) => !skip.has(m.id));
  return { on, off, same, picked };
}
function copyPanel(close) {
  const c = ST.copy, src = world(c.from), dst = world(c.to);
  const { on, off, same, picked } = copyPlan();
  const list = (mods, sign) => mods.length
    ? mods.map((m) => `<li><label><input type="checkbox" data-act="copyskip" data-id="${m.id}" ${c.skip.has(m.id) ? "" : "checked"}><span class="s ${sign === "+" ? "plus" : "minus"}">${sign === "+" ? "+" : "−"}</span>${esc(m.title)}</label></li>`).join("")
    : '<li class="none">Nothing.</li>';
  const opt = (id, label, hint) => `<label class="mls-radio${c.mode === id ? " on" : ""}"><input type="radio" name="copymode" data-act="copymode" data-id="${id}" ${c.mode === id ? "checked" : ""}><span><b>${label}</b><br><span class="ml-muted">${hint}</span></span></label>`;
  return `<aside class="application framed mls-panel" aria-label="Copy modules"><h2 class="divider">Copy modules</h2>${close}
    <div class="scroll"><p class="lead">From <b>${esc(src.title)}</b> to <b>${esc(dst.title)}</b>. Nothing changes until ${esc(dst.title)} next launches.</p>
      <div class="mls-radios">${opt("match", "Match exactly", "Turn on what it has, turn off what it lacks")}${opt("add", "Only add", "Turn on what it has; keep everything else")}</div>
      <div class="mls-chg"><h4><span>Turns on · ${on.length}</span></h4><ul class="mls-mods">${list(on, "+")}</ul></div>
      ${c.mode === "match" ? `<div class="mls-chg"><h4><span>Turns off · ${off.length}</span></h4><ul class="mls-mods">${list(off, "-")}</ul></div>` : ""}
      ${worldProblems(c.from).length ? `<div class="mls-check warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(src.title)} has a problem of its own: ${esc(worldProblems(c.from)[0].text)} Copying it brings that along.</span></div>` : ""}
      <p class="ml-muted" style="margin:0">${plural(same, "module")} already match. The companion stays on either way.${src.system !== dst.system ? ` <b>${esc(src.title)}</b> uses ${esc(src.system)}; some of its modules may not suit ${esc(dst.system)}.` : ""}</p></div>
    <footer><button type="button" data-act="closepanel">Cancel</button><button type="button" class="bright" data-act="copyapply"${picked.length ? "" : " disabled"}><i class="fa-solid fa-copy"></i>Queue ${plural(picked.length, "change")}</button></footer></aside>`;
}
A.copyfrom = (_id, el) => { openPop("copyfrom", el); render(); };
A.docopyfrom = (from) => startCopy(from, ST.world);
A.copymode = (mode) => { ST.copy.mode = mode; render(); };
A.copyskip = (id) => { ST.copy.skip.has(id) ? ST.copy.skip.delete(id) : ST.copy.skip.add(id); render(); };
A.copyapply = () => {
  const { picked } = copyPlan(), { from, to } = ST.copy;
  picked.forEach((m) => setDesired(to, m.id, desired(from, m.id)));
  ST.copy = null; ST.panel = null; render();
  notify(`Queued ${plural(picked.length, "change")} for ${esc(world(to).title)}, copied from ${esc(world(from).title)}.`);
  warnIfBroken(to);
};
function copyFromPop(x, y) {
  const rows = WORLDS_X.filter((w) => w.id !== ST.world).map((w) => {
    if (w.noCompanion) return `<li class="dis"><i class="fa-solid fa-globe"></i><span>${esc(w.title)}</span><span class="ml-muted">companion off</span></li>`;
    const d = ALL_MODULES.filter((m) => m.id !== "module-library" && desired(w.id, m.id) !== desired(ST.world, m.id)).length;
    return `<li data-act="docopyfrom" data-id="${w.id}"><i class="fa-solid fa-globe"></i><span>${esc(w.title)}</span><span class="ml-muted">${onCount(w.id)} on · ${d ? `${d} differ` : "same"}</span></li>`;
  }).join("");
  return pop(x - 300, y, `Copy modules into ${esc(world().title)} from…`, `<ul class="mls-pick">${rows}</ul><div class="mls-pop-note">You review the difference before anything is queued.</div>`, 340);
}

// ---------- intake: sorting newly installed modules ----------
const SUGGEST = { "modular-av-livekit-krisp": { folder: "voice", tags: ["audio", "beta"], with: "modular-av-livekit", why: "Same family as Modular A/V: LiveKit" } };
function intakeBand() {
  if (!ST.fresh.size) return "";
  const names = [...ST.fresh].map((id) => `<b>${short(id)}</b>`).join(", ");
  return `<div class="mls-intake-band"><i class="fa-solid fa-box-open"></i><span>${plural(ST.fresh.size, "new module")} since you last sorted: ${names}. They sit in Unfiled and are off in every world.</span>
    <button type="button" class="bright" data-act="intake"><i class="fa-solid fa-wand-magic-sparkles"></i>Sort them</button><button type="button" data-act="intakelater">Later</button></div>`;
}
function intakeItem(m) {
  const s = SUGGEST[m.id];
  const chosen = ST.intakeFolder[m.id] ?? FOLDER_OF[m.id] ?? s?.folder ?? "";
  const opts = [`<option value="">Unfiled</option>`, ...FOLDERS.map((f) => `<option value="${f.id}"${chosen === f.id ? " selected" : ""}>${esc(f.name)}${s?.folder === f.id ? " (suggested)" : ""}</option>`)].join("");
  const tags = TAGS.map((t) => {
    const on = (TAGS_OF[m.id] ?? []).includes(t.id), sug = s?.tags.includes(t.id) && !on;
    return `<span class="ml-chip mls-tchip${on ? " on" : ""}${sug ? " sug" : ""}" data-act="intaketag" data-id="${t.id}" data-mid="${m.id}" data-tooltip="${sug ? "Suggested" : on ? "Remove" : "Add"}"><i class="ml-dot" style="--ml-c:${t.color}"></i>${esc(t.name)}</span>`;
  }).join("");
  const withOn = s?.with ? WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, s.with)) : [];
  // With many worlds, show the ones that matter (on, suggested) and keep the rest one click away.
  const all = WORLDS_X.filter((w) => !w.noCompanion);
  const open = ST.intakeAllWorlds?.has(m.id) || all.length <= 6;
  const chipOf = (w) => {
    const on = desired(w.id, m.id), sug = withOn.includes(w) && !on;
    return `<span class="ml-chip mls-tchip${on ? " on" : ""}${sug ? " sug" : ""}" data-act="intakeworld" data-id="${w.id}" data-mid="${m.id}">${on ? '<i class="fa-solid fa-check"></i>' : ""}${esc(w.title)}</span>`;
  };
  // Collapsed: only where it's on; the suggestion box above offers the suggested worlds in one click.
  const key = all.filter((w) => desired(w.id, m.id));
  const rest = all.length - key.length;
  const worlds = open ? all.map(chipOf).join("") + (all.length > 6 ? `<a class="mls-morew" data-act="intakeworlds" data-id="${m.id}">Fewer</a>` : "")
    : `${key.map(chipOf).join("") || '<span class="ml-muted">In no world yet</span>'}<a class="mls-morew" data-act="intakeworlds" data-id="${m.id}">${key.length ? `${rest} more world${rest === 1 ? "" : "s"}…` : `Choose from ${all.length} worlds…`}</a>`;
  const hint = s ? `<div class="mls-sug"><i class="fa-solid fa-lightbulb"></i><span>${esc(s.why)}. ${s.with ? `${short(s.with)} is on in ${plural(WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, s.with)).length, "world")}.` : ""}</span><a data-act="intakeaccept" data-id="${m.id}">Use suggestions</a></div>` : "";
  return `<div class="mls-intake-item"><div class="hd"><strong>${esc(m.title)}</strong><span class="ml-muted">${esc(m.author)} · v${m.version ?? "0.1.0"}</span></div>
    <p class="desc">${esc(m.shortDesc ?? m.description ?? "")}</p>${hint}
    <div class="mls-kv"><span>Folder</span><select data-change="ifolder" data-id="${m.id}">${opts}</select>
      <span>Tags</span><div class="chips">${tags}</div>
      <span>Turn on</span><div class="chips">${worlds}</div></div>
    <div class="acts"><a data-act="gridmod" data-id="${m.id}">Package details</a><button type="button" data-act="intakedone" data-id="${m.id}"><i class="fa-solid fa-check"></i>Done</button></div></div>`;
}
function intakePanel(close) {
  const items = [...ST.fresh].map((id) => MOD[id]).filter(Boolean);
  const body = items.length ? items.map(intakeItem).join("") : '<p class="lead">All sorted. New installs show up here next time.</p>';
  return `<aside class="application framed mls-panel" aria-label="New modules"><h2 class="divider">New modules · ${items.length}</h2>${close}
    <div class="scroll"><p class="lead">File each one, tag it and choose where it runs. World changes wait for that world's next launch.</p>${body}</div>
    <footer><button type="button" data-act="closepanel">Later</button><button type="button" class="bright" data-act="intakeall"${items.length ? "" : " disabled"}><i class="fa-solid fa-check-double"></i>Done with all</button></footer></aside>`;
}
const commitFolder = (id) => { const f = ST.intakeFolder[id] ?? FOLDER_OF[id] ?? SUGGEST[id]?.folder; if (f) FOLDER_OF[id] = f; delete ST.intakeFolder[id]; };
A.intake = () => { ST.panel = { kind: "intake" }; ST.lsub = "modules"; render(); };
A.intakelater = () => { ST.fresh.clear(); render(); notify("They stay in Unfiled. The Library marks new installs again next time."); };
A.intaketag = (tid, el) => { const id = el.dataset.mid, cur = TAGS_OF[id] ?? []; TAGS_OF[id] = cur.includes(tid) ? cur.filter((t) => t !== tid) : [...cur, tid]; render(); };
A.intakeworld = (wid, el) => { setDesired(wid, el.dataset.mid, !desired(wid, el.dataset.mid)); render(); warnIfBroken(wid); };
A.intakeworlds = (id) => { ST.intakeAllWorlds ??= new Set(); ST.intakeAllWorlds.has(id) ? ST.intakeAllWorlds.delete(id) : ST.intakeAllWorlds.add(id); render(); };
A.intakeaccept = (id) => {
  const s = SUGGEST[id];
  ST.intakeFolder[id] = s.folder;
  TAGS_OF[id] = [...new Set([...(TAGS_OF[id] ?? []), ...s.tags])];
  WORLDS_X.filter((w) => !w.noCompanion && desired(w.id, s.with)).forEach((w) => setDesired(w.id, id, true));
  render();
};
A.intakedone = (id) => { commitFolder(id); ST.fresh.delete(id); render(); notify(`${short(id)} is sorted.`); };
A.intakeall = () => { const n = ST.fresh.size; ST.fresh.forEach(commitFolder); ST.fresh.clear(); render(); notify(`Sorted ${plural(n, "module")}.`); };
function installMore() {
  const id = MORE_INSTALLS.find((x) => !MOD[x]);
  if (!id) { notify("Mockup: Foundry's installer would open here."); return; }
  addInstalled(id); LATE.add(id); ST.fresh.add(id); render();
  notify(`Mockup: Foundry's installer would open. Pretend you installed ${esc(MOD[id].title)}: it is waiting under New modules.`);
}

// ---------- review at launch ----------
function pendingStrip(w) {
  if (!REVIEW_AT_LAUNCH || CALM || w.noCompanion) return "";
  const n = diff(w.id).length, probs = problems(w.id);
  if (!n && !probs.length) return "";
  return `<div class="mls-pending${probs.length ? " warn" : ""}"><i class="fa-solid ${probs.length ? "fa-triangle-exclamation" : "fa-clock-rotate-left"}"></i>
    <span><b>${plural(n, "change")}</b> wait${n === 1 ? "s" : ""} for the next launch${probs.length ? ` · ${plural(probs.length, "problem")}: ${esc(probs[0].text)}` : ""}</span>
    <a data-act="show" data-id="changes">Show ${n === 1 ? "it" : "them"}</a><a data-act="launch">Review</a><a data-act="discard">Discard</a></div>`;
}
function launchDialog() {
  if (ST.dialog !== "launch") return "";
  const w = world(), d = diff(w.id), probs = problems(w.id);
  const row = (c) => `<li><span class="s ${c.on ? "plus" : "minus"}">${c.on ? "+" : "−"}</span><span>${short(c.id)}</span><a class="x" data-act="undo" data-id="${c.id}" data-tooltip="Undo"><i class="fa-solid fa-xmark"></i></a></li>`;
  const ons = d.filter((c) => c.on), offs = d.filter((c) => !c.on);
  const presets = (ST.presetQueue[w.id] ?? []).map((pid) => PRESETS.find((p) => p.id === pid)?.name).filter(Boolean);
  const check = probs.length
    ? probs.map((p) => `<div class="mls-check warn"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(p.text)} <a data-act="fix" data-id="${p.id}" data-on="${p.on}">${p.fix}</a></span></div>`).join("")
    : `<div class="mls-check ok"><i class="fa-solid fa-circle-check"></i><span>Dependencies are met and nothing conflicts. ${onCount(w.id, baseOn)} → ${onCount(w.id)} modules on.</span></div>`;
  const body = `<div class="mls-launch-body">${check}
    <div class="cols"><div class="mls-chg"><h4><span>Turns on · ${ons.length}</span></h4><ul>${ons.map(row).join("") || '<li class="none" style="grid-template-columns:1fr">Nothing.</li>'}</ul></div>
    <div class="mls-chg"><h4><span>Turns off · ${offs.length}</span></h4><ul>${offs.map(row).join("") || '<li class="none" style="grid-template-columns:1fr">Nothing.</li>'}</ul></div></div>
    ${presets.length ? `<p class="ml-muted">Includes the preset${presets.length > 1 ? "s" : ""} ${presets.map(esc).join(", ")}.</p>` : ""}
    ${bfirstRow(w)}</div>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button><button type="button" data-act="launchplain">Launch without changes</button>
    <button type="button" class="bright" data-act="launchapply"${d.length ? "" : " disabled"}><i class="fa-solid fa-play"></i>Apply ${plural(d.length, "change")} and launch</button>`;
  const x = Math.round(innerWidth / 2 - 280), y = Math.max(80, Math.round(innerHeight / 2 - 260));
  return `<div class="mls-backdrop" data-act="closedialog"></div>${fwindow({ title: `Launch ${esc(w.title)}`, icon: "fa-solid fa-play", x, y, w: 560, body, footer, cls: "mls-dialog" })}`;
}
A.closedialog = () => { ST.dialog = null; render(); };
A.launchplain = () => { const n = diff(ST.world).length; ST.dialog = null; markPlayed(ST.world); render(); notify(`Mockup: ${esc(world().title)} launches as it is. The ${plural(n, "change")} stay${n === 1 ? "s" : ""} queued.`); };
function bfirstRow(w) {
  if (backedUpForQueue(w.id)) return `<p class="mls-bdone"><i class="fa-solid fa-circle-check"></i>Backed up ${esc(backupsOf(w.id)[0]?.rel ?? "just now")}, before these changes.</p>`;
  const on = ST.bfirst ?? true, last = backupsOf(w.id)[0];
  return `<label class="mls-bfirst"><input type="checkbox" data-act="bfirst" ${on ? "checked" : ""}><span><b>Back up ${esc(w.title)} first</b><br><span class="ml-muted">${last ? `About ${esc(last.size)}. The latest backup is from ${esc(last.rel)}.` : "It has no backups yet."} If the changes go wrong, you restore it from the Backups tab.</span></span></label>`;
}
A.bfirst = () => { ST.bfirst = !(ST.bfirst ?? true); render(); };
A.launchapply = () => {
  markPlayed(ST.world);
  const n = diff(ST.world).length, w = world(), go = () => notify(`Mockup: ${esc(w.title)} launches, and the companion applies ${plural(n, "change")} and reloads once.`);
  ST.dialog = null;
  if ((ST.bfirst ?? true) && !backedUpForQueue(w.id)) { ST.wtab = "backups"; runBackup(w.id, { note: "Before queued changes", then: go }); return; }
  render(); go();
};

/** Extra popovers for the ideas; called from overlay() for kinds it doesn't know. */
function ideasPop(p, x, y) {
  switch (p.kind) {
    case "copyfrom": return copyFromPop(x, y);
    case "gcolmenu": return menu(x - 180, y, [[["fa-globe", "Open world", "world", p.wid], ["fa-copy", "Copy this set to…", "copyto"]], [["fa-trash", "Discard its changes", "gdiscard"]]]);
    case "copyto": return pop(x - 180, y, `Copy ${esc(world(p.wid).title)}'s modules to…`, worldPick("docopyto", "You review the difference on that world's page.").replace(`data-act="docopyto" data-id="${p.wid}"`, ""), 300);
    default: return calmPop(p, x, y);
  }
}
