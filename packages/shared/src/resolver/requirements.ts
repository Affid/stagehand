// Required-module closure for one module (PRD 8.5 step 4).
import type { PackageInfo } from "../package.ts";
import {
  type CoreVersion,
  isUsable,
  testAvailability,
  testDependencyCompatibility,
} from "../version.ts";

export interface Closure {
  /** Installed, usable requirements, direct or not. */
  readonly found: readonly string[];
  /** Requirements that are not installed. */
  readonly missing: readonly string[];
  /** Installed requirements outside the required range or unusable on this core. */
  readonly incompatible: readonly string[];
}

export function requirementClosure(
  id: string,
  byId: ReadonlyMap<string, PackageInfo>,
  core: CoreVersion,
  skip: ReadonlySet<string>,
): Closure {
  const found: string[] = [];
  const missing: string[] = [];
  const incompatible: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [...(byId.get(id)?.requires ?? [])];
  for (let r = queue.shift(); r !== undefined; r = queue.shift()) {
    if (r.type !== "module" || seen.has(r.id) || skip.has(r.id)) continue;
    seen.add(r.id);
    const dep = byId.get(r.id);
    if (!dep) {
      missing.push(r.id);
      continue;
    }
    const usable = isUsable(testAvailability(dep.compatibility, core));
    if (!usable || !testDependencyCompatibility(r.compatibility, dep.version)) {
      incompatible.push(r.id);
      continue;
    }
    found.push(r.id);
    queue.push(...dep.requires);
  }
  return { found, missing, incompatible };
}

/** Module ids `pkg` requires directly. */
export const directRequirements = (pkg: PackageInfo | undefined): string[] =>
  (pkg?.requires ?? []).filter((r) => r.type === "module").map((r) => r.id);
