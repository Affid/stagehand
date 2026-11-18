// Stagehand's own dialogs, drawn as Foundry's DialogV2 (markup captured from
// 14.370): Add a preset (marks its changes on the cards, as Setup's world page
// does), and the review before saving (the companion's diff sections from
// packages/module/src/dialog.ts, with Setup's "Turns on / Turns off").

const MODES = [
  { id: "add", label: "Add", hint: "Turn these modules on. Everything else stays as it is." },
  { id: "replace", label: "Replace", hint: "This world gets exactly these modules. Stagehand stays on." },
  { id: "remove", label: "Remove", hint: "Turn these modules off. Everything else stays as it is." },
];

const pick = { presets: new Set(), mode: "add" };

function dialogFrame(id, icon, title, body, buttons) {
  return `<dialog id="${id}" class="application dialog stagehand-dialog" open>
    <header class="window-header">
      <i class="window-icon fa-fw fa-solid ${icon}" inert></i>
      <h1 class="window-title">${esc(title)}</h1>
      <button type="button" class="header-control icon fa-solid fa-xmark" data-tooltip-text="Close Window" aria-label="Close Window" data-action="cancel"></button>
    </header>
    <section class="window-content"><form class="dialog-form standard-form" autocomplete="off">
      <div class="dialog-content standard-form">${body}</div>
      <footer class="form-footer">${buttons}</footer>
    </form></section>
  </dialog>`;
}

const button = (action, icon, label, extra = "") =>
  `<button type="button" data-action="${action}"${extra}><i class="fa-solid ${icon}" inert></i><span>${label}</span></button>`;

function showDialog(html, actions) {
  closeDialogs();
  const host = document.getElementById("windows");
  host.insertAdjacentHTML("beforeend", `<div class="stagehand-backdrop"></div>${html}`);
  const dlg = host.querySelector("dialog.stagehand-dialog");
  dlg.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el && !el.disabled) actions[el.dataset.action]?.(el);
  });
  dlg.addEventListener("change", () => actions.change?.());
  dlg.querySelector("footer button:not([disabled])")?.focus();
  return dlg;
}

function closeDialogs() {
  document.querySelectorAll(".stagehand-dialog, .stagehand-backdrop").forEach((el) => el.remove());
}

// ---------- Add a preset ----------

function presetRow(p) {
  const on = p.modules.filter((id) => S.ticks.has(id)).length;
  return `<label class="stagehand-preset">
    <input type="checkbox" name="preset" value="${esc(p.id)}"${pick.presets.has(p.id) ? " checked" : ""}>
    <span class="name">${esc(p.name)}</span>
    <span class="meta" data-tooltip-text="${esc(p.modules.map(titleOf).join(", "))}">${p.modules.length} modules · ${on} on here</span>
    <span class="about">${esc(p.description)}</span>
  </label>`;
}

function modeRow(m) {
  return `<label class="stagehand-mode">
    <input type="radio" name="mode" value="${m.id}"${pick.mode === m.id ? " checked" : ""}>
    <span class="name">${m.label}</span><span class="about">${m.hint}</span>
  </label>`;
}

function openPicker() {
  const body = `<p class="hint">Presets from this server's Stagehand library. Their changes show on the cards; Save Module Settings applies them.</p>
    <fieldset><legend>Presets</legend><div class="stagehand-presets">${PRESETS.map(presetRow).join("")}</div></fieldset>
    <fieldset><legend>How</legend><div class="stagehand-modes">${MODES.map(modeRow).join("")}</div></fieldset>`;
  const mark = button("mark", "fa-check", "Mark Changes", pick.presets.size ? "" : " disabled");
  const dlg = showDialog(dialogFrame("stagehand-pick", "fa-layer-group", "Stagehand: Add a Preset", body, mark + button("cancel", "fa-xmark", "Cancel")), {
    change: () => {
      pick.presets = new Set([...dlg.querySelectorAll('input[name="preset"]:checked')].map((i) => i.value));
      pick.mode = dlg.querySelector('input[name="mode"]:checked')?.value ?? "add";
      dlg.querySelector('[data-action="mark"]').disabled = pick.presets.size === 0;
    },
    mark: () => markChosen(),
    cancel: closeDialogs,
  });
}

function markChosen() {
  const result = markPreset(S.ticks, [...pick.presets], pick.mode);
  const mode = MODES.find((m) => m.id === pick.mode).label;
  S.ticks = result.ticks;
  result.from.forEach((name, id) => S.fromPreset.set(id, name));
  S.marked = [...S.marked, ...PRESETS.filter((p) => pick.presets.has(p.id)).map((p) => `${p.name} (${mode})`)];
  pick.presets = new Set();
  closeDialogs();
  render();
  if (result.missing.length) notify("warning", `Stagehand: ${result.missing.map(titleOf).join(", ")} isn't installed on this server, so it was skipped.`);
}

// ---------- review before saving ----------

function section(title, items) {
  if (!items.length) return "";
  return `<h4>${esc(title)} · ${items.length}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function reviewBody(plan) {
  const parts = [
    `<p>Saving changes this world's modules and reloads the world once.</p>`,
    section("Presets", plan.presets),
    section("Turns on", plan.enable.map(titleOf)),
    section("Added as dependencies", plan.added.map(titleOf)),
    section("Turns off", plan.disable.map(titleOf)),
    section("Still needed by modules that stay", plan.dependents.map((d) => `${titleOf(d.id)}, needed by ${d.requiredBy.map(titleOf).join(" and ")}`)),
  ];
  if (plan.dependents.length)
    parts.push(`<label class="checkbox"><input type="checkbox" name="removeDependents"> Also turn off the modules that need a removed one</label>`);
  return `<div class="stagehand-diff">${parts.join("")}</div>`;
}

function openReview() {
  const plan = planFromTicks([...S.saved], S.ticks, S.marked);
  const buttons = button("apply", "fa-check", "Save &amp; Reload", plan.changed ? "" : " disabled") + button("cancel", "fa-arrow-left", "Back");
  const dlg = showDialog(dialogFrame("stagehand-diff", "fa-floppy-disk", "Stagehand: Review Changes", reviewBody(plan), buttons), {
    apply: () => applyPlan(plan, dlg.querySelector('input[name="removeDependents"]')?.checked === true),
    cancel: closeDialogs,
  });
}

function applyPlan(plan, removeDependents) {
  if (plan.dependents.length && !removeDependents) {
    notify("warning", "Stagehand: choose to turn off the modules that need it too, or go back.");
    return;
  }
  const n = plan.enable.length + plan.added.length + plan.disable.length;
  S.saved = resultOf(plan, removeDependents);
  S.ticks = new Set(S.saved);
  S.fromPreset = new Map();
  S.marked = [];
  closeDialogs();
  closeWindow();
  reloadWorld(`Stagehand: saved ${n} module change${n === 1 ? "" : "s"}.`);
}
