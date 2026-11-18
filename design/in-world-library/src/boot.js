// The mockup's state, its stand-ins for Foundry's tooltip, notifications and
// reload, and start-up. Query: lib=0 (no library on the server),
// role=gm|assistant|player, theme=dark|light, reset=1 (forget folds and layout).

const Q = new URLSearchParams(location.search);
const KEY = "stagehand-in-world-mock:";

function load(key) {
  try { return JSON.parse(localStorage.getItem(KEY + key) ?? "null"); } catch { return null; }
}
function store(key, value) {
  try { localStorage.setItem(KEY + key, JSON.stringify(value)); } catch { /* storage refused: per-page only */ }
}
if (Q.get("reset")) ["layout", "collapsed", "groupBy"].forEach((k) => { try { localStorage.removeItem(KEY + k); } catch { /* ignore */ } });

const S = {
  library: Q.get("lib") !== "0",
  role: ["gm", "assistant", "player"].includes(Q.get("role")) ? Q.get("role") : "gm",
  /** The world's saved module list, and the switches as they are now. */
  saved: new Set(ACTIVE),
  ticks: new Set(ACTIVE),
  /** Setup's world page ("cards") or Foundry's own list ("foundry"); kept per user. */
  layout: load("layout") === "foundry" ? "foundry" : "cards",
  show: "all",
  /** Setup's Group by: folder, tag, author or smart group; kept per user. */
  groupBy: ["tag", "author", "smart"].includes(load("groupBy")) ? load("groupBy") : "folder",
  filter: "all",
  search: "",
  expanded: false,
  collapsed: new Set(load("collapsed") ?? []),
  /** The module in the panel, and its tab. */
  selected: "modular-av-livekit",
  ptab: "library",
  /** Modules a preset turned on (for "From the preset X"), and the presets marked so far. */
  fromPreset: new Map(),
  marked: [],
  windowOpen: false,
};

// ---------- Foundry's notifications ----------

function notify(type, message) {
  const li = document.createElement("li");
  li.className = `notification ${type}`;
  li.innerHTML = `<p>${esc(message)}</p>`;
  document.getElementById("notifications").append(li);
  setTimeout(() => li.remove(), 5000);
}

// ---------- Foundry's tooltip (data-tooltip-text) ----------

const tip = document.getElementById("tooltip");
function showTip(el) {
  tip.textContent = el.dataset.tooltipText;
  tip.hidden = false;
  tip.classList.add("active");
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
  const above = r.top - t.height - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}
function hideTip() { tip.hidden = true; tip.classList.remove("active"); }
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest?.("[data-tooltip-text]");
  if (el) showTip(el); else hideTip();
});
document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-tooltip-text]"); if (el) showTip(el); });
document.addEventListener("focusout", hideTip);

// ---------- the world reloading ----------

function reloadWorld(message) {
  const veil = document.getElementById("reload");
  veil.hidden = false;
  setTimeout(() => {
    veil.hidden = true;
    if (message) notify("info", message);
  }, 1100);
}

// ---------- start ----------

const theme = Q.get("theme") === "light" ? "theme-light" : "theme-dark";
document.body.classList.replace("theme-dark", theme);
document.getElementById("interface").classList.replace("theme-dark", theme);
document.getElementById("whoami").textContent = { gm: "Gamemaster [GM]", assistant: "Assistant [Assistant GM]", player: "Mia [Player]" }[S.role];
document.getElementById("open-modules").addEventListener("click", openWindow);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.querySelector(".stagehand-dialog")) closeDialogs();
  else closeWindow();
});
openWindow();
