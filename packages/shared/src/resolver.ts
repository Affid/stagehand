// The apply algorithm (PRD 8.5): the target module set for a world, with
// everything the GM must see before confirming. Pure: no Foundry calls.
import type { PackageInfo } from "./package.ts";
import {
  findConflicts,
  findDependents,
  incompatibility,
  withoutDependents,
} from "./resolver/checks.ts";
import { requirementClosure } from "./resolver/requirements.ts";
import type {
  BlockedModule,
  IncompatibleModule,
  Plan,
  ResolveInput,
} from "./resolver/types.ts";

export type * from "./resolver/types.ts";

interface Folded {
  readonly set: readonly string[];
  readonly removed: ReadonlySet<string>;
  readonly missing: readonly string[];
}

/** Applies the commands' modes in queue order (P-6), steps 1-3. */
function fold(
  input: ResolveInput,
  byId: ReadonlyMap<string, PackageInfo>,
): Folded {
  const { companionId } = input;
  let set: readonly string[] = input.current;
  const removed = new Set<string>();
  const missing: string[] = [];
  for (const { mode, modules } of input.commands) {
    missing.push(...modules.filter((id) => !byId.has(id)));
    const preset = modules.filter((id) => byId.has(id));
    if (mode === "replace") set = [...new Set([companionId, ...preset])];
    if (mode === "add") set = [...new Set([...set, ...preset])];
    if (mode === "remove")
      set = set.filter((id) => id === companionId || !preset.includes(id));
    for (const id of preset)
      if (mode === "remove" && id !== companionId) removed.add(id);
      else removed.delete(id);
  }
  return { set, removed, missing: [...new Set(missing)] };
}

interface Expanded {
  readonly set: readonly string[];
  readonly additions: readonly string[];
  readonly blocked: readonly BlockedModule[];
}

/** Adds requirements; blocks new modules whose requirements fail (step 4). */
function expand(
  input: ResolveInput,
  set: readonly string[],
  removed: ReadonlySet<string>,
  byId: ReadonlyMap<string, PackageInfo>,
): Expanded {
  const start = new Set(input.current);
  const blocked: BlockedModule[] = [];
  const kept: string[] = [];
  const additions: string[] = [];
  for (const id of set) {
    const c = requirementClosure(id, byId, input.core, removed);
    const isNew = !start.has(id);
    if (isNew && c.missing.length > 0) {
      blocked.push({ id, reason: "missing-requirement", detail: c.missing });
    } else if (isNew && c.incompatible.length > 0) {
      blocked.push({
        id,
        reason: "incompatible-requirement",
        detail: c.incompatible,
      });
    } else {
      kept.push(id);
      additions.push(...c.found.filter((d) => !set.includes(d)));
    }
  }
  const unique = [...new Set(additions)].filter((d) => !kept.includes(d));
  return { set: [...kept, ...unique], additions: unique, blocked };
}

function dropIncompatible(
  input: ResolveInput,
  set: readonly string[],
  byId: ReadonlyMap<string, PackageInfo>,
): { set: string[]; incompatible: IncompatibleModule[] } {
  const incompatible: IncompatibleModule[] = [];
  const kept = set.filter((id) => {
    const pkg = byId.get(id);
    if (!pkg || input.current.includes(id)) return true;
    const problem = incompatibility(pkg, input.core, input.system);
    if (problem) incompatible.push(problem);
    return problem === undefined;
  });
  return { set: kept, incompatible };
}

export function resolvePlan(input: ResolveInput): Plan {
  const byId = new Map(input.installed.map((p) => [p.id, p]));
  const folded = fold(input, byId);
  const compatible = dropIncompatible(input, folded.set, byId);
  const expanded = expand(input, compatible.set, folded.removed, byId);
  const target = input.removeDependents
    ? withoutDependents(expanded.set, input.current, byId, input.companionId)
    : expanded.set;
  const start = input.current;
  const enable = target.filter((id) => !start.includes(id));
  const disable = start.filter((id) => !target.includes(id));
  return {
    start,
    target,
    enable,
    disable,
    changed: enable.length + disable.length > 0,
    dependencyAdditions: expanded.additions.filter((id) => !start.includes(id)),
    missing: folded.missing,
    blocked: expanded.blocked,
    incompatible: compatible.incompatible,
    conflicts: findConflicts(target, byId),
    dependents: findDependents(target, disable, byId),
  };
}
