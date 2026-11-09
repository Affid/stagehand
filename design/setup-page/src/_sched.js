
// ---------- Next session: a date picker with a clear time zone, and a repeating schedule ----------
// Foundry stores one `nextSession` (UTC). The schedule is ours; we move Foundry's value to the
// next date on it once a session has passed (when Setup opens, or from the companion in the world).

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const TZ_CHOICES = [...new Set([BROWSER_TZ, "Europe/Berlin", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"])];
const FREQS = { none: "Doesn't repeat", w1: "Every week", w2: "Every 2 weeks", m1: "Every month (same date)", dates: "On chosen dates" };
const DEFAULT_TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00"];

function tzOffsetMin(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000;
}
/** A wall-clock date and time in a time zone, as a UTC timestamp (handles daylight saving). */
function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMin(guess, tz) * 60000;
  return guess - tzOffsetMin(first, tz) * 60000;
}
const fmtIn = (ms, tz, opts) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(new Date(ms));
const whenIn = (ms, tz) => `${fmtIn(ms, tz, { weekday: "short", day: "numeric", month: "short" })}, ${fmtIn(ms, tz, { hour: "2-digit", minute: "2-digit" })}`;
function tzLabel(tz, ms) {
  const part = (style) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: style }).formatToParts(new Date(ms)).find((x) => x.type === "timeZoneName")?.value ?? "";
  const off = part("shortOffset").replace("GMT", "UTC");
  const long = part("long");
  const name = !long || /^GMT|^UTC|^Coordinated/.test(long) ? (tz === "UTC" ? "UTC" : `${cityOf(tz)} time`) : long;
  return `${name} (${off === "UTC" ? "UTC+0" : off})`;
}
const cityOf = (tz) => (tz === "UTC" ? "UTC" : tz.split("/").pop().replace(/_/g, " "));
function addDays(date, n) { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function addMonths(date, n) { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10); }
const relDays = (ms) => {
  const day = (t) => Math.floor((t + tzOffsetMin(t, BROWSER_TZ) * 60000) / 864e5);
  const n = day(ms) - day(ST.now);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 1 ? `in ${n} days` : `${-n} days ago`;
};

ST.now = zonedToUtc("2026-11-06", "12:00", "Europe/Berlin");
const SCHEDULES = {
  strahd: { start: "2026-11-10", time: "19:00", tz: "Europe/Berlin", freq: "w1", skips: new Set(["2026-12-22"]) },
  vaults: { start: "2026-11-13", time: "18:30", tz: "Europe/London", freq: "w2", skips: new Set() },
  heist: { start: "2026-11-14", time: "15:00", tz: "Europe/Berlin", freq: "dates", skips: new Set(),
    dates: new Map([["2026-11-14", "15:00"], ["2026-11-27", "19:30"], ["2026-12-05", "15:00"], ["2026-12-30", "18:00"], ["2027-01-16", "15:00"]]) },
};

/** The schedule's dates from now on: { date, ms, skipped }. */
function upcoming(s, count = 5) {
  if (!s) return [];
  if (s.freq === "dates") {
    return [...s.dates].map(([date, time]) => ({ date, time, ms: zonedToUtc(date, time, s.tz), skipped: false }))
      .filter((x) => x.ms >= ST.now).sort((a, b) => a.ms - b.ms).slice(0, count);
  }
  const out = [];
  for (let k = 0, date = s.start; out.length < count && k < 120; k++) {
    const ms = zonedToUtc(date, s.time, s.tz);
    if (ms >= ST.now) out.push({ date, ms, skipped: s.skips.has(date) });
    if (s.freq === "none") break;
    date = s.freq === "m1" ? addMonths(s.start, k + 1) : addDays(date, s.freq === "w2" ? 14 : 7);
  }
  return out;
}
const nextOf = (s) => upcoming(s, 12).find((x) => !x.skipped) ?? null;
function ruleText(s) {
  if (!s || s.freq === "none") return "";
  if (s.freq === "dates") { const n = upcoming(s, 99).length; return `On ${plural(n, "chosen date")} still to come`; }
  const [y, m, d] = s.start.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return s.freq === "m1" ? `Every month on the ${d}${[, "st", "nd", "rd"][d % 10 > 3 || [11, 12, 13].includes(d % 100) ? 0 : d % 10] ?? "th"} at ${s.time}` : `${s.freq === "w2" ? "Every other" : "Every"} ${wd} at ${s.time}`;
}

function sessionView(w) {
  const s = SCHEDULES[w.id], n = nextOf(s);
  const moved = ST.sMoved?.[w.id] ? `<p class="mlw-moved"><i class="fa-solid fa-forward"></i>${esc(ST.sMoved[w.id])}</p>` : "";
  if (!n) {
    return `<div class="mlw-next none"><i class="fa-solid fa-calendar-plus"></i><div><span>No next session set. Players see it on the join screen.</span></div></div>${moved}`;
  }
  const custom = s.freq === "dates";
  // A rule never ends, so it shows the next three; chosen dates show four and count the rest.
  const all = upcoming(s, custom ? 99 : 3), shown = all.slice(0, custom ? 4 : 3);
  const rows = shown.map((x) => {
    const isNext = x.ms === n.ms;
    const act = ST.wlock.has(w.id) ? "<span></span>" : custom ? `<a data-act="sdrop" data-id="${x.date}">Remove</a>` : `<a data-act="sskip" data-id="${x.date}">${x.skipped ? "Restore" : "Skip"}</a>`;
    return `<li class="${x.skipped ? "skipped" : ""}${isNext ? " next" : ""}"><span class="d">${whenIn(x.ms, s.tz)}</span>
      ${isNext ? '<span class="mlw-pill ok">next</span>' : x.skipped ? '<span class="mlw-pill">skipped</span>' : "<span></span>"}${act}</li>`;
  }).join("") + (custom && all.length > shown.length ? `<li class="more"><span>and ${plural(all.length - shown.length, "more date")}</span><span></span><a data-act="sedit">Show all</a></li>` : "");
  const rule = s.freq !== "none"
    ? `<div class="mlw-rule"><i class="fa-solid ${custom ? "fa-calendar-days" : "fa-repeat"}"></i><span>${esc(ruleText(s))}</span>
        <i class="fa-regular fa-circle-question mlw-why" data-tooltip="Foundry keeps one next session for players. When it passes, Stagehand moves it to the next date here, when this page opens or the world launches.${custom ? " Past dates drop off." : ""}" aria-label="How the next session moves on"></i>
        <a class="mlw-mock" data-act="sjump">Mockup: a week passes</a></div><ol class="mlw-upcoming">${rows}</ol>` : "";
  return `<div class="mlw-next"><i class="fa-solid fa-calendar-day"></i><div><strong>${whenIn(n.ms, s.tz)}</strong>
      <span data-tooltip="Players see it in their own time zone">${relDays(n.ms)} · ${esc(tzLabel(s.tz, n.ms))}${whenIn(n.ms, BROWSER_TZ) !== whenIn(n.ms, s.tz) ? ` · <b>${whenIn(n.ms, BROWSER_TZ)}</b> your time` : ""}</span></div></div>${moved}${rule}
`;
}

function calendar(d) {
  const [y, m] = d.month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const draft = { ...d, skips: new Set() };
  const marked = d.freq === "dates" ? new Set(d.dates.keys()) : new Set(upcoming(draft, 40).map((x) => x.date));
  const today = fmtIn(ST.now, BROWSER_TZ, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
  const cells = [...Array(lead).fill("<span></span>"), ...Array.from({ length: days }, (_, i) => {
    const date = `${d.month}-${String(i + 1).padStart(2, "0")}`;
    const past = date < today;
    const picked = d.freq === "dates" ? marked.has(date) : date === d.start;
    const cls = [picked ? "sel" : "", date === today ? "today" : "", d.freq !== "dates" && marked.has(date) && date !== d.start ? "rep" : ""].join(" ");
    return `<button type="button" class="${cls}" ${past ? "disabled" : `data-act="sday" data-id="${date}"`} aria-label="${date}"${picked ? ' aria-pressed="true"' : ""}>${i + 1}</button>`;
  })].join("");
  const title = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `<div class="mlw-cal"><header><button type="button" class="icon" data-act="smonth" data-id="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
    <strong>${title}</strong><button type="button" class="icon" data-act="smonth" data-id="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button></header>
    <div class="dow">${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((x) => `<span>${x}</span>`).join("")}</div><div class="days">${cells}</div></div>`;
}

/** Times you already use across your worlds' schedules, most used first; Foundry-evening defaults fill the rest. */
function usedTimes(current) {
  const n = new Map();
  Object.values(SCHEDULES).forEach((x) => (x.freq === "dates" ? [...x.dates.values()] : [x.time]).forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)));
  const mine = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  const list = [...new Set([...mine, ...DEFAULT_TIMES])].slice(0, 5);
  if (current && !list.includes(current)) list[list.length - 1] = current;
  return { list: list.sort(), fromYou: new Set(mine) };
}
/** Time zones: the schedule's own, this browser's, the ones your other worlds use; "Find another" searches every zone. */
const ALL_ZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : TZ_CHOICES;
const offsetOf = (z) => tzLabel(z, ST.now).match(/\((UTC[^)]*)\)/)?.[1] ?? "";
const TZ_LIMIT = 40;
/** Match the start of the city's name or of one of its words (or the region, for "Asia"), never the middle of a word. */
function tzMatches(q) {
  const t = q.trim().toLowerCase().replace(/_/g, " ");
  if (!t) return { hits: [], total: 0 };
  const scored = ALL_ZONES.map((z) => {
    const city = cityOf(z).toLowerCase(), region = z.split("/")[0].toLowerCase();
    const score = city.startsWith(t) ? 0 : city.split(/[ -]/).some((w) => w.startsWith(t)) ? 1 : t.length > 1 && region.startsWith(t) ? 2 : offsetOf(z).toLowerCase() === t ? 3 : -1;
    return { z, score, city };
  }).filter((x) => x.score >= 0).sort((a, b) => a.score - b.score || a.city.localeCompare(b.city));
  return { hits: scored.slice(0, TZ_LIMIT).map((x) => x.z), total: scored.length };
}
function tzList() {
  const q = (ST.tzq ?? "").trim();
  if (!q) return '<li class="hint">Type a city or region, for example Tokyo, Chicago or Asia.</li>';
  const { hits, total } = tzMatches(q);
  if (!hits.length) return '<li class="hint">No time zone matches. Try a nearby big city.</li>';
  return hits.map((z, i) => `<li role="option" id="tz-${i}" aria-selected="${i === (ST.tzi ?? 0)}" class="${i === (ST.tzi ?? 0) ? "on" : ""}" data-act="tzpick" data-id="${z}">
    <span>${esc(cityOf(z))}</span><span class="r">${esc(z.split("/")[0])}</span><span class="o">${esc(offsetOf(z))}</span></li>`).join("")
    + (total > hits.length ? `<li class="hint more">${total - hits.length} more. Keep typing to narrow it down.</li>` : "");
}
function tzSelect(d) {
  if (ST.sAllZones) {
    return `<div class="mlw-tzfind"><div class="in"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="tzq" value="${esc(ST.tzq ?? "")}" placeholder="Find a time zone" autocomplete="off"
      role="combobox" aria-expanded="true" aria-controls="tzlist" aria-activedescendant="tz-${ST.tzi ?? 0}" aria-label="Find a time zone"><button type="button" data-act="tzback">Cancel</button></div>
      <ul id="tzlist" role="listbox" aria-label="Time zones">${tzList()}</ul></div>`;
  }
  const used = [...new Set(Object.values(SCHEDULES).map((x) => x.tz))];
  const opt = (z, note = "") => `<option value="${z}"${z === d.tz ? " selected" : ""}>${esc(cityOf(z))}${note}</option>`;
  const top = [...new Set([d.tz, BROWSER_TZ, ...used])];
  return `<div class="mlw-tzrow"><select data-sched="tz" aria-label="Time zone">${top.map((z) => opt(z, z === BROWSER_TZ ? " (this browser)" : used.includes(z) && z !== d.tz ? " (used in your worlds)" : "")).join("")}</select>
    <button type="button" data-act="tzfind"><i class="fa-solid fa-magnifying-glass"></i>Find another</button></div>`;
}
const focusTz = () => { const el = document.getElementById("tzq"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
A.tzfind = () => { ST.sAllZones = true; ST.tzq = ""; ST.tzi = 0; render(); focusTz(); };
A.tzback = () => { ST.sAllZones = false; render(); document.querySelector("select[data-sched=tz]")?.focus(); };
A.tzpick = (z) => { ST.sDraft.tz = z; ST.sAllZones = false; render(); document.querySelector("select[data-sched=tz]")?.focus(); };
document.addEventListener("input", (e) => {
  if (e.target.id !== "tzq") return;
  ST.tzq = e.target.value; ST.tzi = 0;
  document.getElementById("tzlist").innerHTML = tzList();
  e.target.setAttribute("aria-activedescendant", "tz-0");
});
document.addEventListener("keydown", (e) => {
  if (e.target.id !== "tzq") return;
  const n = tzMatches(ST.tzq ?? "").hits.length;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!n) return;
    ST.tzi = ((ST.tzi ?? 0) + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
    document.getElementById("tzlist").innerHTML = tzList();
    e.target.setAttribute("aria-activedescendant", `tz-${ST.tzi}`);
    document.getElementById(`tz-${ST.tzi}`)?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    const z = tzMatches(ST.tzq ?? "").hits[ST.tzi ?? 0];
    if (z) A.tzpick(z);
  } else if (e.key === "Escape") {
    e.preventDefault(); e.stopPropagation(); A.tzback();
  }
}, true);

function sessionEditor(w) {
  const d = ST.sDraft;
  const custom = d.freq === "dates";
  const ms = zonedToUtc(d.start, d.time, d.tz);
  const times = usedTimes(d.time);
  const quick = times.list.map((t) => `<button type="button" class="${t === d.time ? "on" : ""}" data-act="stime" data-id="${t}"${times.fromYou.has(t) ? ' data-tooltip="You use this time"' : ""}>${t}</button>`).join("");
  const [hh, mm] = d.time.split(":");
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => `<option${h === hh ? " selected" : ""}>${h}</option>`).join("");
  const mins = [...new Set(["00", "15", "30", "45", mm])].sort().map((m) => `<option${m === mm ? " selected" : ""}>${m}</option>`).join("");
  const freqOpts = Object.entries(FREQS).map(([k, v]) => `<option value="${k}"${k === d.freq ? " selected" : ""}>${v}</option>`).join("");
  const firstMs = custom ? (upcoming({ ...d, skips: new Set() }, 1)[0]?.ms ?? ms) : ms;
  const others = ["Europe/London", "America/New_York", "Australia/Sydney"].filter((z) => z !== d.tz).slice(0, 3)
    .map((z) => `<span><b>${fmtIn(firstMs, z, { hour: "2-digit", minute: "2-digit" })}</b> ${esc(cityOf(z))}${fmtIn(firstMs, z, { day: "numeric" }) !== fmtIn(firstMs, d.tz, { day: "numeric" }) ? ` (${fmtIn(firstMs, z, { weekday: "short" })})` : ""}</span>`).join("");
  const chosen = custom ? [...d.dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => {
    const past = zonedToUtc(date, t, d.tz) < ST.now;
    const [y, m, dd] = date.split("-").map(Number);
    const label = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "") + (y !== 2026 ? ` ${y}` : "");
    return `<li class="${past ? "past" : ""}"><span class="d">${label}</span><input type="text" class="tt" value="${t}" data-sdate="${date}" aria-label="Time on ${label}" maxlength="5" pattern="[0-2][0-9]:[0-5][0-9]"><button type="button" class="icon" data-act="sday" data-id="${date}" aria-label="Remove ${label}"><i class="fa-solid fa-xmark"></i></button></li>`;
  }).join("") : "";
  const summary = custom
    ? `<div class="sum"><i class="fa-solid fa-calendar-check"></i><div><strong>${d.dates.size ? `${plural(d.dates.size, "date")}, next ${whenIn(firstMs, d.tz)}` : "No dates chosen yet"} <span>${esc(cityOf(d.tz))} time</span></strong>
        <span class="others">${d.dates.size ? `Players see it in their own time, for example ${others}` : "Click days on the calendar to add them."}</span></div></div>`
    : `<div class="sum"><i class="fa-solid fa-calendar-check"></i><div><strong>${whenIn(ms, d.tz)} <span>${esc(cityOf(d.tz))} time</span></strong>
        <span class="others">Players see it in their own time, for example ${others}</span></div></div>`;
  return `<div class="mlw-sched${custom ? " custom" : ""}">
    ${calendar(d)}
    <div class="side">
      <label>Repeats</label><div><select data-sched="freq" aria-label="Repeats">${freqOpts}</select>${d.freq !== "none" && !custom ? `<span class="tzl">${esc(ruleText(d))}</span>` : custom ? '<span class="tzl">Click days on the calendar to add or remove them.</span>' : ""}</div>
      <label>${custom ? "Usual time" : "Time"}</label><div class="t"><div class="hm"><select data-sched="hh" aria-label="Hour">${hours}</select><span>:</span><select data-sched="mm" aria-label="Minutes">${mins}</select><span class="h24">24-hour</span></div><div class="chips">${quick}</div>${custom ? '<span class="tzl">New dates get this time; change any date below.</span>' : ""}</div>
      <label>Time zone</label><div>${tzSelect(d)}<span class="tzl">${esc(tzLabel(d.tz, firstMs))}</span></div>
    </div>
    ${custom ? `<ol class="mlw-chosen">${chosen || '<li class="none">No dates yet.</li>'}</ol>` : ""}
    ${summary}
    <div class="bar"><button type="button" class="bright" data-act="ssave"${custom && !d.dates.size ? " disabled" : ""}>Save</button><button type="button" data-act="scancel">Cancel</button>
      ${SCHEDULES[w.id] ? '<span class="ml-spacer"></span><button type="button" data-act="sclear">No next session</button>' : ""}</div></div>`;
}

function sessionBox(w) {
  const editing = ST.aboutEdit === "next";
  const link = editing || ST.wlock.has(w.id) ? "" : `${savedMark("next")}<a data-act="sedit">${SCHEDULES[w.id] ? "Change" : "Set a date"}</a>`;
  return `<section class="mlw-box mlw-sess"><h4><span>Next session</span>${link}</h4>${editing ? sessionEditor(w) : sessionView(w)}</section>`;
}

A.sedit = () => {
  const s = SCHEDULES[ST.world];
  const start = s ? (nextOf(s)?.date ?? s.start) : addDays(fmtIn(ST.now, BROWSER_TZ, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-"), 4);
  ST.sDraft = { start, time: s?.time ?? "19:00", tz: s?.tz ?? BROWSER_TZ, freq: s?.freq ?? "none", month: start.slice(0, 7), dates: new Map(s?.dates ?? []) };
  ST.sAllZones = false;
  ST.aboutEdit = "next"; render();
};
A.scancel = () => { ST.aboutEdit = null; render(); };
A.sday = (date) => {
  const d = ST.sDraft;
  if (d.freq !== "dates") { d.start = date; render(); return; }
  if (d.dates.has(date)) d.dates.delete(date); else d.dates.set(date, d.time);
  render();
};
A.sdrop = (date) => { SCHEDULES[ST.world].dates.delete(date); if (!SCHEDULES[ST.world].dates.size) delete SCHEDULES[ST.world]; render(); };
A.stime = (t) => { ST.sDraft.time = t; render(); };
A.smonth = (dir) => { const [y, m] = ST.sDraft.month.split("-").map(Number); ST.sDraft.month = new Date(Date.UTC(y, m - 1 + Number(dir), 1)).toISOString().slice(0, 7); render(); };
A.ssave = () => {
  const d = ST.sDraft, prev = SCHEDULES[ST.world];
  SCHEDULES[ST.world] = { start: d.freq === "dates" ? [...d.dates.keys()].sort()[0] : d.start, time: d.time, tz: d.tz, freq: d.freq,
    skips: prev && prev.freq === d.freq ? prev.skips : new Set(), dates: d.freq === "dates" ? new Map(d.dates) : undefined };
  if (ST.sMoved) delete ST.sMoved[ST.world];
  ST.aboutEdit = null; flashSaved("next");
};
A.sclear = () => { delete SCHEDULES[ST.world]; ST.aboutEdit = null; flashSaved("next"); };
A.sskip = (date) => { const s = SCHEDULES[ST.world]; s.skips.has(date) ? s.skips.delete(date) : s.skips.add(date); render(); };
A.sjump = () => {
  const s = SCHEDULES[ST.world], before = nextOf(s);
  ST.now += 7 * 864e5;
  const after = nextOf(s);
  ST.sMoved = { ...(ST.sMoved ?? {}), [ST.world]: before && after && before.ms !== after.ms ? `${whenIn(before.ms, s.tz)} has passed, so the next session moved to ${whenIn(after.ms, s.tz)}.` : "" };
  render();
};
document.addEventListener("change", (e) => {
  const el = e.target.closest?.("[data-sched]");
  if (!el || !ST.sDraft) return;
  const k = el.dataset.sched;
  if (k === "freq" && el.value === "dates" && !ST.sDraft.dates.size) {
    const seed = upcoming({ ...ST.sDraft, freq: ST.sDraft.freq === "none" ? "w1" : ST.sDraft.freq, skips: new Set() }, ST.sDraft.freq === "none" ? 1 : 4);
    seed.forEach((x) => ST.sDraft.dates.set(x.date, ST.sDraft.time));
  }
  if (k === "hh" || k === "mm") { const [h, m] = ST.sDraft.time.split(":"); ST.sDraft.time = k === "hh" ? `${el.value}:${m}` : `${h}:${el.value}`; } else ST.sDraft[k] = el.value;
  renderSoon();
});

document.addEventListener("change", (e) => {
  const el = e.target.closest?.("[data-sdate]");
  if (!el || !ST.sDraft) return;
  const v = el.value.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) ST.sDraft.dates.set(el.dataset.sdate, v);
  renderSoon();
});
