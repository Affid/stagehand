
// ---------- Configuration: our page in place of Foundry's Application Configuration window ----------
// Same settings, grouped by task. Saving sends Foundry's own request (game.post({action: "adminConfigure"}));
// Every change waits for a restart. Foundry has no restart command: on a server it can only stop (Setup's Shut down),
// and comes back if whatever started it (a service, Docker, a host) starts it again. The desktop app relaunches
// itself only after a Foundry update, not after saving settings.

const CFG_SAVED = {
  adminUsername: "", passwordSet: true, dataPath: "/srv/foundry/data", cssTheme: "dark", world: "", language: "en.core",
  port: 30000, upnp: false, unixSocket: "", compressStatic: true, compressSocket: true, sslCert: "", sslKey: "",
  awsConfig: "", fullscreen: false, telemetry: false, deleteNEDB: false, hotReload: false,
};
const CFG_ENV = { electron: false, proxySSL: false, certManaged: false, noBackups: false, build: "14.370" };
const CFG_LABELS = {
  adminUsername: "Administrator username", password: "Administrator password", dataPath: "User data path", cssTheme: "Setup theme",
  world: "Default world", language: "Default language", port: "Port", upnp: "UPnP", unixSocket: "Unix socket",
  compressStatic: "Compress static files", compressSocket: "Compress web socket data", sslCert: "SSL certificate", sslKey: "SSL key",
  awsConfig: "AWS configuration", fullscreen: "Full-screen mode", telemetry: "Share usage data", deleteNEDB: "Delete migrated NEDB files", hotReload: "Hot-reload package files",
};
const THEMES = { dark: "Foundry Virtual Tabletop", fantasy: "Classic Fantasy", scifi: "Science Fiction" };
ST.cfg = { ...CFG_SAVED };
ST.cfgWaiting = [];
/** What the running server uses: saved settings only apply after a restart. */
let CFG_RUNNING = { ...CFG_SAVED };

const cfgChanges = () => Object.keys(CFG_LABELS).filter((k) => (k === "password" ? !!ST.cfgPw?.next : ST.cfg[k] !== CFG_SAVED[k]));
function cfgErrors() {
  const e = {};
  const port = Number(ST.cfg.port);
  if (!ST.cfg.unixSocket && (!Number.isInteger(port) || port < 1 || port > 65535)) e.port = "A port is a whole number from 1 to 65535.";
  if (!ST.cfg.dataPath.startsWith("/") && !/^[A-Za-z]:\\/.test(ST.cfg.dataPath)) e.dataPath = "Use a full path, for example /srv/foundry/data.";
  if (!!ST.cfg.sslCert !== !!ST.cfg.sslKey) e.sslCert = "A certificate needs its key, and the other way round.";
  return e;
}

/** One setting row: label and hint on the left, the control on the right. */
const cfgRow = (key, control, hint = "", err = "") => `<div class="mlc-set${ST.cfg[key] !== CFG_SAVED[key] && key in CFG_SAVED ? " changed" : ""}">
  <div class="l"><strong>${CFG_LABELS[key] ?? key}</strong>${hint ? `<span>${hint}</span>` : ""}${err ? `<span class="err" role="alert"><i class="fa-solid fa-circle-exclamation"></i>${err}</span>` : ""}</div><div class="c">${control}</div></div>`;
const cfgSwitch = (key) => `<input type="checkbox" class="mls-switch" data-cfg="${key}" ${ST.cfg[key] ? "checked" : ""} aria-label="${CFG_LABELS[key]}">`;
const cfgText = (key, ph = "", type = "text") => `<input type="${type}" data-cfg="${key}" value="${esc(ST.cfg[key])}" placeholder="${esc(ph)}" aria-label="${CFG_LABELS[key]}">`;
const cfgSelect = (key, opts) => `<select data-cfg="${key}" aria-label="${CFG_LABELS[key]}">${Object.entries(opts).map(([v, l]) => `<option value="${v}"${String(ST.cfg[key]) === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

function cfgAccess() {
  const pw = ST.cfgPw;
  const pwState = CFG_SAVED.passwordSet
    ? '<span class="mlc-state ok"><i class="fa-solid fa-lock"></i>Set</span>'
    : '<span class="mlc-state bad"><i class="fa-solid fa-lock-open"></i>Not set: anyone who can reach this server can open Setup</span>';
  const pwFlow = !pw ? `${pwState}<button type="button" data-act="cfgpw">${CFG_SAVED.passwordSet ? "Change…" : "Set a password…"}</button>`
    : pw.step === "current" ? `<div class="mlc-pw"><input type="password" id="cfgpwcur" placeholder="Current password" aria-label="Current password" autocomplete="current-password">
        <button type="button" class="bright" data-act="cfgpwcheck">Continue</button><button type="button" data-act="cfgpwcancel">Cancel</button>${pw.err ? `<span class="err" role="alert">${pw.err}</span>` : ""}</div>`
    : pw.step === "new" ? `<div class="mlc-pw"><input type="password" id="cfgpwnew" placeholder="New password" aria-label="New password" autocomplete="new-password"><input type="password" id="cfgpwrep" placeholder="Repeat it" aria-label="Repeat the new password" autocomplete="new-password">
        <button type="button" class="bright" data-act="cfgpwset">Use it</button><button type="button" data-act="cfgpwcancel">Cancel</button>${pw.err ? `<span class="err" role="alert">${pw.err}</span>` : ""}</div>`
    : `<span class="mlc-state warn"><i class="fa-solid fa-clock"></i>New password chosen; saved with the other changes</span><button type="button" data-act="cfgpwcancel">Undo</button>`;
  return `<section class="mlw-box"><h4><span>Access</span></h4>
    ${cfgRow("password", pwFlow, "Protects this Setup page. Foundry asks for the current password before it accepts a new one.")}
    ${cfgRow("adminUsername", cfgText("adminUsername", "Optional"), "Asked together with the password, if you set one.")}</section>`;
}

function cfgStartup() {
  const worlds = { "": "None: open Setup", ...Object.fromEntries(WORLDS_X.map((w) => [w.id, w.title])) };
  return `<section class="mlw-box"><h4><span>Startup and appearance</span></h4>
    ${cfgRow("world", cfgSelect("world", worlds), "Launches by itself when Foundry starts.")}
    ${cfgRow("language", cfgSelect("language", { "en.core": "English (default)" }), "More appear when you install a language module.")}
    ${cfgRow("cssTheme", cfgSelect("cssTheme", THEMES), "Colours of Setup and Foundry's own windows.")}
    ${CFG_ENV.electron ? cfgRow("fullscreen", cfgSwitch("fullscreen"), "The desktop app opens without toolbars.") : ""}</section>`;
}

function cfgNetwork(err) {
  const https = CFG_ENV.proxySSL
    ? '<div class="mlc-https ok"><i class="fa-solid fa-shield-halved"></i><div><strong>HTTPS is handled by your reverse proxy</strong><span>Foundry doesn\'t need its own certificate.</span></div></div>'
    : CFG_ENV.certManaged
      ? '<div class="mlc-https ok"><i class="fa-solid fa-shield-halved"></i><div><strong>Encrypted with a Let\'s Encrypt certificate</strong><span>Foundry renews it by itself.</span></div><button type="button" data-act="foundry" data-what="Stop automatic renewal (Foundry asks to confirm)">Stop renewing…</button></div>'
      : CFG_SAVED.sslCert && CFG_SAVED.sslKey
        ? `<div class="mlc-https ok"><i class="fa-solid fa-shield-halved"></i><div><strong>${ST.cfgWaiting.includes("sslCert") ? "Your own certificate, after a restart" : "Encrypted with your own certificate"}</strong><span>Players connect over https.</span></div></div>`
      : ST.cfg.sslCert && ST.cfg.sslKey
        ? '<div class="mlc-https warn"><i class="fa-solid fa-shield-halved"></i><div><strong>Your own certificate, once saved</strong><span>Save, then restart Foundry; players then connect over https.</span></div></div>'
        : `<div class="mlc-https warn"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Not encrypted (http)</strong><span>Voice and video between players, and some browser features, need HTTPS unless everyone connects on this computer.</span></div>
            <button type="button" class="bright" data-act="foundry" data-what="Automatically Generate Certificate: Foundry asks you to accept Let's Encrypt's terms, needs port 80 reachable from the internet, and falls back to a self-signed certificate">Get a free certificate…</button></div>`;
  const own = ST.cfgOwnCert || ST.cfg.sslCert || ST.cfg.sslKey;
  const ownCert = CFG_ENV.proxySSL || CFG_ENV.certManaged ? "" : own
    ? `${cfgRow("sslCert", cfgText("sslCert", "Path to the .pem certificate"), "Absolute, or relative to the Config folder.", err.sslCert)}${cfgRow("sslKey", cfgText("sslKey", "Path to the -key.pem key"))}`
    : '<a class="mlc-more" data-act="cfgowncert">Use my own certificate instead</a>';
  const adv = ST.cfgAdv
    ? `${cfgRow("unixSocket", cfgText("unixSocket", "Optional, for example /run/foundry.sock"), "Used instead of the port when set.")}
       ${cfgRow("compressStatic", cfgSwitch("compressStatic"), "Smaller downloads for players.")}
       ${cfgRow("compressSocket", cfgSwitch("compressSocket"), "Recommended for network performance.")}
       <a class="mlc-more" data-act="cfgadv">Fewer options</a>`
    : '<a class="mlc-more" data-act="cfgadv">Advanced: Unix socket, compression</a>';
  return `<section class="mlw-box"><h4><span>Network and HTTPS</span></h4>
    ${cfgRow("port", `<div class="mlc-port">${cfgText("port", "30000", "number")}<label><input type="checkbox" data-cfg="upnp" ${ST.cfg.upnp ? "checked" : ""}>UPnP</label></div>`, "Players connect on this port. UPnP asks your router to open it.", err.port)}
    ${https}${ownCert}${adv}</section>`;
}

function cfgStorage(err) {
  const backups = CFG_ENV.noBackups
    ? '<span class="mlc-state warn"><i class="fa-solid fa-ban"></i>Turned off when the server was started (--noBackups)</span>'
    : '<span class="mlc-state ok"><i class="fa-solid fa-check"></i>On</span> <a data-act="srvbackups">Backups</a>';
  return `<section class="mlw-box"><h4><span>Data and storage</span></h4>
    ${cfgRow("dataPath", cfgText("dataPath"), "Where worlds, modules and systems live. Changing it copies Foundry's settings there; it doesn't move your worlds or modules.", err.dataPath)}
    <div class="mlc-set"><div class="l"><strong>Backups</strong><span>Set when the server starts, not here.</span></div><div class="c">${backups}</div></div>
    ${cfgRow("awsConfig", cfgText("awsConfig", "Optional: path to an AWS settings file"), "Lets worlds store files in Amazon S3. Foundry checks the file when you save.")}</section>`;
}

function cfgOther() {
  return `<section class="mlw-box"><h4><span>Other</span></h4>
    ${cfgRow("telemetry", cfgSwitch("telemetry"), 'A small amount of anonymous usage data for the Foundry team. <a data-act="foundry" data-what="Open foundryvtt.com: what usage data is shared">What\'s shared</a>')}
    ${cfgRow("hotReload", cfgSwitch("hotReload"), "For module and system developers: reload CSS, HTML and translations without a refresh.")}
    ${cfgRow("deleteNEDB", cfgSwitch("deleteNEDB"), "Deletes the old database files left after the version 11 migration.")}</section>`;
}

function serverConfigPage() {
  const err = cfgErrors(), changes = cfgChanges(), bad = Object.keys(err).length;
  const pending = changes.length
    ? `<div class="mlc-pending" role="status"><i class="fa-solid fa-pen"></i><span><b>${plural(changes.length, "change")}</b> not saved: ${changes.map((k) => CFG_LABELS[k]).join(", ")}</span>
        <button type="button" data-act="cfgdiscard">Discard</button>${bad ? `<span class="mlw-tipwrap" data-tooltip="Fix the ${plural(bad, "problem")} first"><button type="button" class="bright" disabled>Save…</button></span>` : '<button type="button" class="bright" data-act="cfgsave">Save…</button>'}</div>`
    : "";
  const waiting = ST.cfgWaiting.length
    ? `<div class="mlc-waiting" role="status"><i class="fa-solid fa-rotate"></i><span><b>Saved. They apply after a restart:</b> ${ST.cfgWaiting.map((k) => CFG_LABELS[k]).join(", ")}.</span>
        <a class="mlw-mock" data-act="cfgrestarted">Mockup: Foundry restarted</a><button type="button" data-act="cfgstop">${CFG_ENV.electron ? "Quit Foundry…" : "Shut down now…"}</button></div>`
    : "";
  const head = `<div class="mlb-head"><div><h2>Configuration</h2><p>Foundry ${CFG_ENV.build} · running on ${CFG_RUNNING.unixSocket ? "a Unix socket" : `port ${CFG_RUNNING.port}`} · data in <code>${esc(CFG_RUNNING.dataPath)}</code></p></div></div>`;
  // The bar sits at the bottom in space that is always kept free, so the settings never move when it appears.
  const bar = pending || waiting ? `<div class="mlc-bar">${pending || waiting}</div>` : "";
  return `<section id="setup-packages" class="application framed mls-main mlb-page mlc-page"><div class="mls-body-main">${head}
    <div class="mlc-cols"><div class="col">${cfgAccess()}${cfgStartup()}${cfgOther()}</div><div class="col">${cfgNetwork(err)}${cfgStorage(err)}</div></div>${bar}</div></section>`;
}

/** A setting's value as people read it. */
function cfgShow(k, v) {
  if (k === "world") return v ? world(v)?.title ?? v : "None: open Setup";
  if (k === "cssTheme") return THEMES[v] ?? v;
  if (k === "language") return v === "en.core" ? "English (default)" : v;
  if (typeof v === "boolean") return v ? "On" : "Off";
  return v === "" || v == null ? "Not set" : String(v);
}
function cfgDialog() {
  if (ST.dialog !== "cfgsave") return "";
  const changes = cfgChanges();
  const rows = changes.map((k) => {
    const from = cfgShow(k, CFG_SAVED[k]), to = k === "password" ? "a new password" : cfgShow(k, ST.cfg[k]);
    return `<li><strong>${CFG_LABELS[k]}</strong><span>${k === "password" ? to : `${esc(from)} → <b>${esc(to)}</b>`}</span></li>`;
  }).join("");
  const body = `<div class="mls-launch-body"><ul class="mlc-diff">${rows}</ul>
    <div class="mls-check warn"><i class="fa-solid fa-rotate"></i><span>Foundry keeps running with the old settings until it restarts. After saving you can shut it down from here; how it comes back depends on how it was started.</span></div>
    ${changes.includes("port") || changes.includes("unixSocket") ? `<p class="ml-muted">After the restart, open Setup at the new address${ST.cfg.unixSocket ? "" : `: port ${esc(ST.cfg.port)}`}.</p>` : ""}</div>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button><button type="button" class="bright" data-act="cfgdosave"><i class="fa-solid fa-floppy-disk"></i>Save ${plural(changes.length, "change")}</button>`;
  return `<div class="mls-backdrop" data-act="closedialog"></div>${fwindow({ title: "Save configuration", icon: "fa-solid fa-gears", x: Math.round(innerWidth / 2 - 250), y: 140, w: 500, body, footer, cls: "mls-dialog" })}`;
}

A.srvconfig = () => { ST.page = "config"; ST.pop = null; ST.panel = null; render(); };
A.cfgdiscard = () => { ST.cfg = { ...CFG_SAVED }; ST.cfgPw = null; render(); };
A.cfgsave = () => { ST.dialog = "cfgsave"; render(); };
A.cfgdosave = () => {
  const changes = cfgChanges();
  Object.assign(CFG_SAVED, ST.cfg);
  if (changes.includes("password")) CFG_SAVED.passwordSet = true;
  ST.cfgPw = null; ST.dialog = null;
  ST.cfgWaiting = [...new Set([...ST.cfgWaiting, ...changes])];
  render();
};
A.cfgrestarted = () => { ST.cfgWaiting = []; CFG_RUNNING = { ...CFG_SAVED }; render(); };
A.cfgadv = () => { ST.cfgAdv = !ST.cfgAdv; render(); };
A.cfgowncert = () => { ST.cfgOwnCert = true; render(); document.querySelector('[data-cfg="sslCert"]')?.focus(); };
A.cfgpw = () => { ST.cfgPw = { step: CFG_SAVED.passwordSet ? "current" : "new" }; render(); document.getElementById(ST.cfgPw.step === "current" ? "cfgpwcur" : "cfgpwnew")?.focus(); };
A.cfgpwcancel = () => { ST.cfgPw = null; render(); };
// Foundry checks the current password with game.post({action: "adminPassword", adminPassword}); the mockup accepts any.
A.cfgpwcheck = () => {
  if (!document.getElementById("cfgpwcur")?.value) { ST.cfgPw.err = "Enter the current password."; render(); return; }
  ST.cfgPw = { step: "new" }; render(); document.getElementById("cfgpwnew")?.focus();
};
A.cfgpwset = () => {
  const a = document.getElementById("cfgpwnew")?.value ?? "", b = document.getElementById("cfgpwrep")?.value ?? "";
  if (a.length < 8) { ST.cfgPw.err = "Use at least 8 characters."; render(); return; }
  if (a !== b) { ST.cfgPw.err = "The two don't match."; render(); return; }
  ST.cfgPw = { step: "done", next: true }; render();
};
const cfgValue = (el) => (el.dataset.cfg === "port" ? (el.value === "" ? "" : Number(el.value)) : el.value.trim());
const isTyped = (el) => el.tagName === "INPUT" && /^(text|number|password|search)$/.test(el.type);
/** Update what depends on typed values (save bar, changed marks, errors, HTTPS box) without replacing any field. */
function cfgRefresh() {
  const cur = document.querySelector(".mlc-page");
  if (!cur) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = serverConfigPage();
  const swap = (sel) => {
    const a = cur.querySelector(sel), b = tmp.querySelector(sel);
    if (a && b) { if (a.outerHTML !== b.outerHTML) a.replaceWith(b); } else if (a && !b) a.remove(); else if (!a && b) cur.querySelector(".mls-body-main").append(b);
  };
  swap(".mlc-bar"); swap(".mlc-https");
  const oldRows = cur.querySelectorAll(".mlc-set"), newRows = tmp.querySelectorAll(".mlc-set");
  if (oldRows.length !== newRows.length) { renderSoon(); return; }
  oldRows.forEach((row, i) => {
    const n = newRows[i];
    if (row.className !== n.className) row.className = n.className;
    const l = row.querySelector(".l"), nl = n.querySelector(".l");
    if (l && nl && l.innerHTML !== nl.innerHTML) l.innerHTML = nl.innerHTML;
  });
}
document.addEventListener("input", (e) => {
  const el = e.target.closest?.("[data-cfg]");
  if (!el || !isTyped(el)) return;
  ST.cfg[el.dataset.cfg] = cfgValue(el);
  cfgRefresh();
});
document.addEventListener("change", (e) => {
  const el = e.target.closest?.("[data-cfg]");
  if (!el) return;
  if (isTyped(el)) { ST.cfg[el.dataset.cfg] = cfgValue(el); cfgRefresh(); return; }
  ST.cfg[el.dataset.cfg] = el.type === "checkbox" ? el.checked : el.value.trim();
  render();
});

function cfgStopDialog() {
  if (ST.dialog !== "cfgstop") return "";
  const body = CFG_ENV.electron
    ? `<div class="mls-launch-body"><p>Foundry closes. Open it again to use the new settings.</p></div>`
    : `<div class="mls-launch-body"><p>Foundry stops, and this page goes offline until it's back.</p>
      <ul class="mlc-how"><li><i class="fa-solid fa-rotate"></i><span><b>Started by a service, Docker or your host?</b> If it restarts Foundry automatically, Foundry is back in a moment with the new settings, and this page reconnects.</span></li>
      <li><i class="fa-solid fa-terminal"></i><span><b>Started by hand?</b> It stays off until you start it again the same way.</span></li></ul>
      <p class="ml-muted">Foundry can't tell which, so it doesn't promise a restart.</p></div>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button><button type="button" class="del" data-act="cfgdostop"><i class="fa-solid fa-power-off"></i>${CFG_ENV.electron ? "Quit Foundry" : "Shut down Foundry"}</button>`;
  return `<div class="mls-backdrop" data-act="closedialog"></div>${fwindow({ title: CFG_ENV.electron ? "Quit Foundry" : "Shut down Foundry", icon: "fa-solid fa-power-off", x: Math.round(innerWidth / 2 - 250), y: 160, w: 500, body, footer, cls: "mls-dialog" })}`;
}
A.cfgstop = () => { ST.dialog = "cfgstop"; render(); };
A.cfgdostop = () => { ST.dialog = null; render(); notify("Mockup: Foundry shuts down (its own Shut down). If a service restarts it, this page reconnects with the new settings."); };
