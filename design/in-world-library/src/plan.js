// What applying presets does to the world: a small version of the shared
// resolver (packages/shared/src/resolver.ts), enough for the mockup. Add,
// Replace and Remove; required modules come along; Stagehand stays on (C-5).

const STAGEHAND = "stagehand";
const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));
const titleOf = (id) => MODULE_BY_ID[id]?.title ?? NOT_INSTALLED[id] ?? id;

/** `target` plus everything it requires (never what `keepOff` names), and which of those were added. */
function withRequirements(target, keepOff = new Set()) {
  const set = new Set(target);
  const added = [];
  const queue = [...set];
  while (queue.length) {
    const id = queue.shift();
    for (const req of MODULE_BY_ID[id]?.requires ?? []) {
      if (set.has(req) || keepOff.has(req) || !MODULE_BY_ID[req]) continue;
      set.add(req);
      added.push(req);
      queue.push(req);
    }
  }
  return { set, added };
}

function targetFor(base, installed, mode) {
  if (mode === "add") return new Set([...base, ...installed]);
  if (mode === "replace") return new Set([...installed, STAGEHAND]);
  return new Set([...base].filter((id) => id === STAGEHAND || !installed.includes(id)));
}

/** Modules turned off that others staying on still need: {id, requiredBy}. */
function dependentsOf(base, target) {
  const removed = [...base].filter((id) => !target.has(id));
  return removed
    .map((id) => ({ id, requiredBy: [...target].filter((s) => MODULE_BY_ID[s]?.requires.includes(id)) }))
    .filter((d) => d.requiredBy.length > 0);
}

function planFor(active, presetIds, mode) {
  const presets = PRESETS.filter((p) => presetIds.includes(p.id));
  const chosen = [...new Set(presets.flatMap((p) => p.modules))];
  const installed = chosen.filter((id) => MODULE_BY_ID[id]);
  const base = new Set(active);
  const reqs = mode === "remove" ? { set: targetFor(base, installed, mode), added: [] } : withRequirements(targetFor(base, installed, mode));
  const target = reqs.set;
  const added = reqs.added.filter((id) => !base.has(id));
  const enable = [...target].filter((id) => !base.has(id) && !added.includes(id));
  const disable = [...base].filter((id) => !target.has(id));
  return {
    presets, mode, target, enable, added, disable,
    missing: chosen.filter((id) => !MODULE_BY_ID[id]),
    dependents: mode === "remove" ? dependentsOf(base, target) : [],
    changed: enable.length + added.length + disable.length > 0,
  };
}

/** The world's modules after the plan; with `removeDependents`, those go too. */
function resultOf(plan, removeDependents) {
  const out = new Set(plan.target);
  if (removeDependents) for (const d of plan.dependents) for (const s of d.requiredBy) out.delete(s);
  out.add(STAGEHAND);
  return out;
}

// ---------- the world page: changes marked on the cards, then saved ----------

/** What saving the cards' changes does: switched-off modules stay off; requirements of the rest come along. */
function planFromTicks(saved, ticks, presets) {
  const base = new Set(saved);
  const removed = new Set([...base].filter((id) => !ticks.has(id)));
  const { set: target, added: reqs } = withRequirements(new Set(ticks), removed);
  const added = reqs.filter((id) => !base.has(id));
  const enable = [...target].filter((id) => !base.has(id) && !added.includes(id));
  const disable = [...base].filter((id) => !target.has(id));
  return {
    presets, target, enable, added, disable, missing: [],
    dependents: dependentsOf(base, target),
    changed: enable.length + added.length + disable.length > 0,
  };
}

/** A preset marked on the cards: the new switches, what it turned on, what isn't installed. */
function markPreset(ticks, presetIds, mode) {
  const presets = PRESETS.filter((p) => presetIds.includes(p.id));
  const chosen = [...new Set(presets.flatMap((p) => p.modules))];
  const installed = chosen.filter((id) => MODULE_BY_ID[id]);
  const next = targetFor(new Set(ticks), installed, mode);
  next.add(STAGEHAND);
  const from = new Map(installed.filter((id) => next.has(id) && !ticks.has(id))
    .map((id) => [id, presets.find((p) => p.modules.includes(id)).name]));
  return { ticks: next, from, missing: chosen.filter((id) => !MODULE_BY_ID[id]) };
}
