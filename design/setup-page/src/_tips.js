
// ---------- Tooltips, as Foundry's TooltipManager shows them on the real page ----------
// Hover or keyboard focus on [data-tooltip] shows Foundry's #tooltip above the element after a short delay.
// Disabled buttons get no pointer events, so their explanation sits on a wrapper (see .mlw-tipwrap).
const TIP_DELAY = 400;
let tipTimer = null, tipFor = null, tipStart = 0;
function tipEl() {
  let el = document.getElementById("tooltip");
  if (!el) { el = document.createElement("aside"); el.id = "tooltip"; el.setAttribute("role", "tooltip"); document.body.append(el); }
  return el;
}
function showTip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  const el = tipEl();
  el.textContent = text;
  el.classList.add("active");
  const r = target.getBoundingClientRect(), t = el.getBoundingClientRect();
  const above = r.top - t.height - 8 > 4;
  const left = Math.max(6, Math.min(innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(above ? r.top - t.height - 8 : r.bottom + 8)}px`;
  target.setAttribute("aria-describedby", "tooltip");
}
function hideTip() {
  clearTimeout(tipTimer); tipTimer = null;
  if (tipFor) tipFor.removeAttribute("aria-describedby");
  tipFor = null;
  document.getElementById("tooltip")?.classList.remove("active");
}
function armTip(target, startedAt = performance.now()) {
  if (target === tipFor) return;
  hideTip();
  tipFor = target; tipStart = startedAt;
  const wait = Math.max(0, TIP_DELAY - (performance.now() - startedAt));
  tipTimer = setTimeout(() => { if (tipFor === target && target.isConnected) showTip(target); }, wait);
}
document.addEventListener("pointerover", (e) => { const t = e.target.closest?.("[data-tooltip]"); if (t) armTip(t); else if (tipFor) hideTip(); });
document.addEventListener("pointerdown", hideTip, true);
document.addEventListener("focusin", (e) => { const t = e.target.closest?.("[data-tooltip]"); if (t && e.target.matches(":focus-visible")) armTip(t); });
document.addEventListener("focusout", hideTip);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && tipFor) hideTip(); }, true);
// The mockup redraws the page on every change (a backup's progress redraws it several times a second),
// which replaces the hovered element. After each redraw, pick up whatever is under the pointer again.
let tipX = -1, tipY = -1;
document.addEventListener("pointermove", (e) => { tipX = e.clientX; tipY = e.clientY; }, { passive: true });
const renderWithoutTips = render;
// eslint-disable-next-line no-func-assign
render = function () {
  const shown = !!tipFor && document.getElementById("tooltip")?.classList.contains("active");
  const prevText = tipFor?.dataset.tooltip, prevStart = tipStart;
  const focusedTip = tipFor && tipFor === document.activeElement;
  renderWithoutTips();
  if (focusedTip) return hideTip();
  const under = tipX >= 0 ? document.elementFromPoint(tipX, tipY)?.closest?.("[data-tooltip]") : null;
  if (!under) { if (tipFor) hideTip(); return; }
  if (shown) { clearTimeout(tipTimer); tipFor = under; showTip(under); return; }
  // Same tooltip still under the pointer: keep counting the delay from the first hover.
  const same = under.dataset.tooltip === prevText;
  tipFor = null; armTip(under, same ? prevStart : performance.now());
};
