// The target module set for an apply command (PRD 8.5 steps 1-4).
// Spike scope: modes, missing modules and required dependencies. Conflicts,
// compatibility and system checks come with the full resolver.

export type ApplyMode = "replace" | "add" | "remove";

export interface InstalledModule {
  readonly id: string;
  readonly requires: readonly string[];
}

export interface ApplyInput {
  readonly mode: ApplyMode;
  readonly current: readonly string[];
  readonly requested: readonly string[];
  readonly installed: readonly InstalledModule[];
  readonly companionId: string;
}

export interface BlockedModule {
  readonly id: string;
  readonly missing: readonly string[];
}

export interface ApplyResult {
  readonly target: readonly string[];
  readonly missing: readonly string[];
  readonly dependencyAdditions: readonly string[];
  readonly blocked: readonly BlockedModule[];
}

/** Every module `id` needs, directly or not; cycles are visited once. */
function closure(
  id: string,
  byId: ReadonlyMap<string, InstalledModule>,
): { readonly found: readonly string[]; readonly missing: readonly string[] } {
  const found: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [...(byId.get(id)?.requires ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next)) continue;
    seen.add(next);
    const mod = byId.get(next);
    if (!mod) {
      missing.push(next);
      continue;
    }
    found.push(next);
    queue.push(...mod.requires);
  }
  return { found, missing };
}

function baseTarget(input: ApplyInput, preset: readonly string[]): string[] {
  const { mode, current, companionId } = input;
  if (mode === "replace") return [...new Set([companionId, ...preset])];
  if (mode === "add") return [...new Set([...current, ...preset])];
  return current.filter((id) => id === companionId || !preset.includes(id));
}

export function computeTarget(input: ApplyInput): ApplyResult {
  const byId = new Map(input.installed.map((m) => [m.id, m]));
  const missing = input.requested.filter((id) => !byId.has(id));
  const preset = input.requested.filter((id) => byId.has(id));
  const base = baseTarget(input, preset);
  if (input.mode === "remove")
    return { target: base, missing, dependencyAdditions: [], blocked: [] };

  const blocked: BlockedModule[] = [];
  const kept: string[] = [];
  const additions: string[] = [];
  for (const id of base) {
    const deps = closure(id, byId);
    if (deps.missing.length > 0) {
      blocked.push({ id, missing: deps.missing });
      continue;
    }
    kept.push(id);
    additions.push(...deps.found.filter((d) => !base.includes(d)));
  }
  const dependencyAdditions = [...new Set(additions)];
  return {
    target: [...kept, ...dependencyAdditions],
    missing,
    dependencyAdditions,
    blocked,
  };
}
