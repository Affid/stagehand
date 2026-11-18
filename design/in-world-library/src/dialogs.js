// Stagehand's own dialogs, drawn as Foundry's DialogV2 (markup captured from
// 14.370): choose presets and a mode, then the diff and confirmation that the
// companion already shows for queued changes (packages/module/src/dialog.ts).

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

// ---------- 1. choose presets and a mode ----------

function presetRow(p) {
  const on = p.modules.filter((id) => S.saved.has(id)).length;
  const titles = p.modules.map(titleOf).join(", ");
  return `<label class="stagehand-preset">
    <input type="checkbox" name="preset" value="${esc(p.id)}"${pick.presets.has(p.id) ? " checked" : ""}>
    <span class="name">${esc(p.name)}</span>
    <span class="meta" data-tooltip-text="${esc(titles)}">${p.modules.length} modules · ${on} on here</span>
    <span class="about">${esc(p.description)}</span>
  </label>`;
}

function modeRow(m) {
  return `<label class="stagehand-mode">
    <input type="radio" name="mode" value="${m.id}"${pick.mode === m.id ? " checked" : ""}>
    <span class="name">${m.label}</span><span class="about">${m.hint}</span>
  </label>`;
}

function pickerBody() {
  const unsaved = isDirty()
    ? `<p class="stagehand-warning"><i class="fa-solid fa-triangle-exclamation" inert></i> Changes you haven't saved in Module Management are dropped when the world reloads.</p>`
    : "";
  return `<p class="hint">Presets from this server's Stagehand library. Applying one changes this world's modules and reloads the world once.</p>
    <fieldset><legend>Presets</legend><div class="stagehand-presets">${PRESETS.map(presetRow).join("")}</div></fieldset>
    <fieldset><legend>How</legend><div class="stagehand-modes">${MODES.map(modeRow).join("")}</div></fieldset>
    ${unsaved}`;
}

function openPicker() {
  const next = button("next", "fa-arrow-right", "Review Changes", pick.presets.size ? "" : " disabled");
  const dlg = showDialog(dialogFrame("stagehand-pick", "fa-layer-group", "Stagehand: Apply Presets", pickerBody(), next + button("cancel", "fa-xmark", "Cancel")), {
    change: () => {
      pick.presets = new Set([...dlg.querySelectorAll('input[name="preset"]:checked')].map((i) => i.value));
      pick.mode = dlg.querySelector('input[name="mode"]:checked')?.value ?? "add";
      dlg.querySelector('[data-action="next"]').disabled = pick.presets.size === 0;
    },
    next: () => openDiff(planFor([...S.saved], [...pick.presets], pick.mode)),
    cancel: closeDialogs,
  });
}

// ---------- 2. the diff and confirmation ----------

function section(title, items) {
  if (!items.length) return "";
  return `<h4>${esc(title)}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function diffBody(plan) {
  const mode = MODES.find((m) => m.id === plan.mode).label;
  const parts = [
    `<p>Changes from the presets you chose. Applying reloads the world once.</p>`,
    plan.changed ? "" : `<p>No change: the world already matches.</p>`,
    section("Presets", plan.presets.map((p) => `${p.name} (${mode})`)),
    section("Enable", plan.enable.map(titleOf)),
    section("Added as dependencies", plan.added.map(titleOf)),
    section("Disable", plan.disable.map(titleOf)),
    section("Not installed (skipped)", plan.missing.map(titleOf)),
    section("Still needed by modules that stay", plan.dependents.map((d) => `${titleOf(d.id)}, needed by ${d.requiredBy.map(titleOf).join(" and ")}`)),
  ];
  if (plan.dependents.length)
    parts.push(`<label class="checkbox"><input type="checkbox" name="removeDependents"> Also disable the modules that need a removed one</label>`);
  return `<div class="stagehand-diff">${parts.join("")}</div>`;
}

function openDiff(plan) {
  const buttons = button("apply", "fa-check", "Apply &amp; Reload", plan.changed ? "" : " disabled") + button("back", "fa-arrow-left", "Back") + button("cancel", "fa-xmark", "Cancel");
  const dlg = showDialog(dialogFrame("stagehand-diff", "fa-layer-group", "Stagehand: Apply Presets", diffBody(plan), buttons), {
    apply: () => applyPlan(plan, dlg.querySelector('input[name="removeDependents"]')?.checked === true),
    back: openPicker,
    cancel: closeDialogs,
  });
}

function applyPlan(plan, removeDependents) {
  if (plan.dependents.length && !removeDependents) {
    notify("warning", "Stagehand: choose to disable the dependent modules too, or go back.");
    return;
  }
  const names = plan.presets.map((p) => p.name).join(", ");
  const mode = MODES.find((m) => m.id === plan.mode).label;
  S.saved = resultOf(plan, removeDependents);
  S.ticks = new Set(S.saved);
  pick.presets = new Set();
  closeDialogs();
  closeWindow();
  reloadWorld(`Stagehand: applied ${names} (${mode}).`);
}
